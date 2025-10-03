<script lang="ts">
  type RawViewerMode = 'hex' | 'hexEdit' | 'digests' | 'cString' | 'base64';

  export type ByteSourceOption = {
    id: string;
    label: string;
    bytes: Uint8Array;
    hexdump?: string;
  };

  const EMPTY_BYTES = new Uint8Array();

  interface Props {
    sources?: ByteSourceOption[];
    initialMode?: RawViewerMode;
    emptyMessage?: string;
    readonly?: boolean;
    onchange?: (newBytes: Uint8Array) => void;
  }

  let {
    sources = [],
    initialMode = 'hex',
    emptyMessage = 'No bytes available.',
    readonly = true,
    onchange,
  }: Props = $props();

  let viewerMode = $state<RawViewerMode>(initialMode);
  let digestEntries = $state<Array<{ algorithm: string; value: string }>>([]);
  let digestError = $state<string | null>(null);
  let digestLoading = $state(false);
  let digestRequestId = 0; // Non-reactive counter

  // User-selected source, null means "use default"
  let userSelectedSourceId = $state<string | null>(null);

  const MODE_OPTIONS = $derived([
    { id: 'hex' as RawViewerMode, label: 'Hex' },
    ...(readonly
      ? []
      : [{ id: 'hexEdit' as RawViewerMode, label: 'Edit Hex' }]),
    { id: 'base64' as RawViewerMode, label: 'Base64' },
    { id: 'cString' as RawViewerMode, label: 'C String' },
    { id: 'digests' as RawViewerMode, label: 'Digests' },
  ]);

  const resolvedSources = $derived(
    sources.length > 0
      ? sources
      : [{ id: 'default', label: 'Bytes', bytes: EMPTY_BYTES }]
  );

  // Automatically manage selected source
  const selectedSourceId = $derived.by(() => {
    if (
      !resolvedSources ||
      !Array.isArray(resolvedSources) ||
      resolvedSources.length === 0
    ) {
      return null;
    }

    // If user has made a selection and it's still valid, use it
    if (
      userSelectedSourceId &&
      resolvedSources.some((src) => src.id === userSelectedSourceId)
    ) {
      return userSelectedSourceId;
    }

    // Otherwise, default to first available source
    return resolvedSources[0].id;
  });

  const cEscapedString = $derived(
    viewerMode === 'cString' ? toCEscapedString(currentBytes) : ''
  );

  const base64String = $derived(
    viewerMode === 'base64' ? toBase64(currentBytes) : ''
  );

  // Convert to derived values
  const currentSource = $derived.by(() => {
    if (!resolvedSources || !Array.isArray(resolvedSources)) {
      return null;
    }
    return resolvedSources.find((src) => src.id === selectedSourceId) ?? null;
  });

  const currentBytes = $derived(currentSource?.bytes ?? EMPTY_BYTES);

  const currentHexdump = $derived.by(() => {
    if (!currentSource) return '(empty)';
    return currentSource.hexdump ?? formatHexdump(currentBytes);
  });

  let hexEditValue = $state('');
  let hexEditError = $state<string | null>(null);

  $effect(() => {
    if (viewerMode === 'digests') {
      void refreshDigests(currentBytes);
    } else {
      // Cancel any pending digest requests by incrementing the counter
      digestRequestId++;
      digestError = null;
      digestEntries = [];
      digestLoading = false;
    }
  });

  // Sync hexEditValue when switching to edit mode or currentBytes changes
  $effect(() => {
    if (viewerMode === 'hexEdit') {
      hexEditValue = formatHexForEdit(currentBytes);
    }
  });

  function selectSource(id: string) {
    userSelectedSourceId = id;
  }

  function selectMode(mode: RawViewerMode) {
    viewerMode = mode;
  }

  // Generate address column (read-only)
  function formatAddresses(bytes: Uint8Array, cols = 16): string {
    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i += cols) {
      lines.push(i.toString(16).padStart(8, '0').toUpperCase());
    }
    // Add one more line for when editing
    if (bytes.length === 0 || bytes.length % cols === 0) {
      lines.push(bytes.length.toString(16).padStart(8, '0').toUpperCase());
    }
    return lines.join('\n');
  }

  // Generate ASCII column (read-only)
  function formatAscii(bytes: Uint8Array, cols = 16): string {
    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i += cols) {
      const slice = bytes.slice(i, i + cols);
      const ascii = Array.from(slice)
        .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
        .join('');
      lines.push(ascii);
    }
    // Add one more line for when editing
    if (bytes.length === 0 || bytes.length % cols === 0) {
      lines.push('');
    }
    return lines.join('\n');
  }

  // Format bytes as hex with spaces (16 bytes per line) for middle column
  function formatHexForEdit(bytes: Uint8Array, cols = 16): string {
    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i += cols) {
      const slice = bytes.slice(i, i + cols);
      const hexLine = Array.from(slice)
        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      lines.push(hexLine);
    }
    return lines.join('\n');
  }

  // For hex edit mode, derive values from the current input text
  const liveEditBytes = $derived.by(() => {
    if (viewerMode !== 'hexEdit') return currentBytes;
    const { bytes, error } = parseHexText(hexEditValue);
    // Only use new bytes if valid, otherwise keep current
    return bytes !== null ? bytes : currentBytes;
  });

  const hexAddresses = $derived(formatAddresses(liveEditBytes));
  const hexAscii = $derived(formatAscii(liveEditBytes));

  // Parse hex text back to bytes
  function parseHexText(hexText: string): {
    bytes: Uint8Array | null;
    error: string | null;
  } {
    // Remove all whitespace and newlines
    const cleaned = hexText.replace(/\s+/g, '').toUpperCase();

    // Empty is OK
    if (cleaned.length === 0) {
      return { bytes: new Uint8Array(), error: null };
    }

    // Must be even number of hex chars
    if (cleaned.length % 2 !== 0) {
      return {
        bytes: null,
        error: 'Hex string must have even number of characters',
      };
    }

    // Validate hex chars
    if (!/^[0-9A-F]*$/.test(cleaned)) {
      return { bytes: null, error: 'Invalid hex characters (use 0-9, A-F)' };
    }

    // Convert to bytes
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
    }

    return { bytes, error: null };
  }

  function handleHexInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    hexEditValue = textarea.value;

    // Validate in real-time to show errors immediately
    const { error } = parseHexText(hexEditValue);
    hexEditError = error;
  }

  function handleHexBlur() {
    // Auto-format on blur
    const { bytes, error } = parseHexText(hexEditValue);

    if (error) {
      hexEditError = error;
      return;
    }

    hexEditError = null;

    if (bytes && onchange) {
      onchange(bytes);
    }

    // Reformat to clean layout
    hexEditValue = formatHexForEdit(bytes);
  }

  async function refreshDigests(bytes: Uint8Array) {
    const requestId = ++digestRequestId;
    digestLoading = true;
    digestError = null;

    try {
      if (!bytes || bytes.length === 0) {
        digestEntries = [];
        return;
      }

      const subtle = globalThis.crypto?.subtle;
      if (!subtle) {
        throw new Error('Web Crypto API is not available in this environment.');
      }

      const algorithms: AlgorithmIdentifier[] = ['SHA-256', 'SHA-1', 'SHA-512'];
      const results: Array<{ algorithm: string; value: string }> = [];

      for (const algorithm of algorithms) {
        const digestBuffer = await subtle.digest(algorithm, bytes);
        results.push({
          algorithm:
            typeof algorithm === 'string' ? algorithm : String(algorithm),
          value: bufferToHex(digestBuffer),
        });
      }

      if (requestId === digestRequestId) {
        digestEntries = results;
      }
    } catch (error: any) {
      if (requestId === digestRequestId) {
        digestError = error?.message || String(error);
        digestEntries = [];
      }
    } finally {
      if (requestId === digestRequestId) {
        digestLoading = false;
      }
    }
  }

  function bufferToHex(buffer: ArrayBuffer): string {
    const view = new Uint8Array(buffer);
    return Array.from(view)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function toCEscapedString(bytes: Uint8Array): string {
    if (!bytes || bytes.length === 0) {
      return '""';
    }

    let result = '"';
    for (const byte of bytes) {
      switch (byte) {
        case 0x5c:
          result += '\\';
          break;
        case 0x22:
          result += '"';
          break;
        case 0x0a:
          result += '\n';
          break;
        case 0x0d:
          result += '\r';
          break;
        case 0x09:
          result += '\t';
          break;
        case 0x00:
          result += '\0';
          break;
        default:
          if (byte >= 0x20 && byte <= 0x7e) {
            result += String.fromCharCode(byte);
          } else {
            result += `\\x${byte.toString(16).padStart(2, '0')}`;
          }
      }
    }
    result += '"';
    return result;
  }

  function formatHexdump(bytes: Uint8Array, columns = 16): string {
    if (!bytes || bytes.length === 0) {
      return '(empty)';
    }

    const lines: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += columns) {
      const slice = bytes.slice(offset, offset + columns);
      const hexParts = Array.from(slice).map((byte) =>
        byte.toString(16).padStart(2, '0')
      );
      const ascii = Array.from(slice)
        .map((byte) =>
          byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.'
        )
        .join('');

      const hexColumn = hexParts.join(' ').padEnd(columns * 3 - 1, ' ');
      const line = `${offset.toString(16).padStart(8, '0')}  ${hexColumn}  |${ascii}|`;
      lines.push(line);
    }

    return lines.join('\n');
  }

  function toBase64(bytes: Uint8Array): string {
    if (!bytes || bytes.length === 0) {
      return '';
    }

    if (typeof globalThis.btoa === 'function') {
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      return globalThis.btoa(binary);
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }

    // Fallback: hex then base64 via TextEncoder (unlikely path)
    const text = String.fromCharCode(...bytes);
    return globalThis.btoa ? globalThis.btoa(text) : '';
  }
</script>

<div class="space-y-3">
  <div class="flex flex-col gap-3">
    {#if resolvedSources.length > 1}
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="text-xs text-editor-secondary">Source</span>
          <div class="join join-xs">
            {#each resolvedSources as source}
              <button
                type="button"
                class="btn btn-xs btn-outline join-item"
                class:btn-active={selectedSourceId === source.id}
                class:btn-primary={selectedSourceId === source.id}
                onclick={() => selectSource(source.id)}
              >
                {source.label}
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-xs text-editor-secondary">Viewer</span>
      <div class="join join-xs">
        {#each MODE_OPTIONS as option}
          <button
            type="button"
            class="btn btn-xs btn-outline join-item"
            class:btn-active={viewerMode === option.id}
            class:btn-primary={viewerMode === option.id}
            onclick={() => selectMode(option.id)}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  </div>

  {#if viewerMode === 'hex'}
    <pre class="code-block">{currentHexdump}</pre>
  {:else if viewerMode === 'hexEdit'}
    <div class="hex-editor-container">
      <div class="hex-editor-grid">
        <!-- Address column (read-only) -->
        <textarea
          class="hex-column hex-address"
          value={hexAddresses}
          readonly
          spellcheck="false"
        ></textarea>

        <!-- Hex bytes column (editable) -->
        <textarea
          class="hex-column hex-bytes"
          class:hex-editor-error={hexEditError}
          value={hexEditValue}
          oninput={handleHexInput}
          onblur={handleHexBlur}
          placeholder="00 00 00 00"
          spellcheck="false"
        ></textarea>

        <!-- ASCII column (read-only) -->
        <textarea
          class="hex-column hex-ascii"
          value={hexAscii}
          readonly
          spellcheck="false"
        ></textarea>
      </div>
      {#if hexEditError}
        <div class="text-error text-xs mt-1">{hexEditError}</div>
      {/if}
      <div class="text-xs text-editor-muted mt-1">
        {liveEditBytes.length} bytes
      </div>
    </div>
  {:else if viewerMode === 'digests'}
    {#if digestLoading}
      <div class="flex items-center gap-2 text-sm text-editor-muted">
        <span class="loading loading-spinner loading-xs"></span>
        Calculating digests...
      </div>
    {:else if digestError}
      <div class="alert-error px-3 py-2">
        {digestError}
      </div>
    {:else if digestEntries.length === 0}
      <div class="empty-state px-3 py-4">
        {emptyMessage}
      </div>
    {:else}
      <ul class="data-list">
        {#each digestEntries as entry}
          <li>
            <span class="font-semibold">{entry.algorithm}:</span>
            {entry.value}
          </li>
        {/each}
      </ul>
    {/if}
  {:else if viewerMode === 'cString'}
    <pre class="code-block--wrap">{cEscapedString}</pre>
  {:else if viewerMode === 'base64'}
    <pre class="code-block--break-all">{base64String || emptyMessage}</pre>
  {/if}
</div>

<style>
  .hex-editor-container {
    @apply flex flex-col gap-2;
  }

  .hex-editor-grid {
    @apply flex gap-4 font-mono text-sm;
    line-height: 1.5;
  }

  .hex-column {
    @apply border rounded-xl px-3 py-2 resize-none overflow-x-hidden text-sm box-content;
    border-color: var(--editor-border-primary);
    background: var(--editor-bg-secondary);
    color: var(--editor-text-primary);
    font-family: monospace;
    line-height: inherit;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    height: auto;
    min-height: 2.5rem;
  }

  .hex-column:focus {
    @apply outline-none;
    border-color: var(--editor-border-hover);
  }

  .hex-address {
    @apply cursor-default;
    width: 8ch;
    color: var(--editor-muted, #666);
  }

  .hex-bytes {
    width: 47ch;
  }

  .hex-ascii {
    @apply cursor-default;
    width: 16ch;
    color: var(--editor-muted, #666);
  }

  .hex-editor-error {
    border-color: var(--error-color, #ef4444) !important;
    background-color: rgba(239, 68, 68, 0.05);
  }
</style>
