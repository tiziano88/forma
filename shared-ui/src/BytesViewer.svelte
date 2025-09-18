<script lang="ts">
  type RawViewerMode = 'hex' | 'digests' | 'cString';

  export type ByteSourceOption = {
    id: string;
    label: string;
    bytes: Uint8Array;
    hexdump?: string;
  };

  const EMPTY_BYTES = new Uint8Array();

  export let sources: ByteSourceOption[] = [];
  export let selectedSourceId: string | null = null;
  export let initialMode: RawViewerMode = 'hex';
  export let emptyMessage = 'No bytes available.';

  let viewerMode: RawViewerMode = initialMode;
  let digestEntries: Array<{ algorithm: string; value: string }> = [];
  let digestError: string | null = null;
  let digestLoading = false;
  let digestRequestId = 0;
  let cEscapedString = '';

  $: resolvedSources = sources.length > 0
    ? sources
    : [{ id: 'default', label: 'Bytes', bytes: EMPTY_BYTES }];

  $: {
    if (!selectedSourceId || !resolvedSources.some((src) => src.id === selectedSourceId)) {
      selectedSourceId = resolvedSources[0]?.id ?? null;
    }
  }

  $: currentSource = resolvedSources.find((src) => src.id === selectedSourceId) ?? null;
  $: currentBytes = currentSource?.bytes ?? EMPTY_BYTES;
  $: currentHexdump = currentSource?.hexdump ?? formatHexdump(currentBytes);

  $: if (viewerMode === 'digests') {
    void refreshDigests(currentBytes);
  } else {
    digestRequestId++;
    digestError = null;
    digestEntries = [];
    digestLoading = false;
  }

  $: if (viewerMode === 'cString') {
    cEscapedString = toCEscapedString(currentBytes);
  } else if (viewerMode !== 'cString') {
    cEscapedString = '';
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
          algorithm: typeof algorithm === 'string' ? algorithm : String(algorithm),
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
          result += '\"';
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
      const hexParts = Array.from(slice).map((byte) => byte.toString(16).padStart(2, '0'));
      const ascii = Array.from(slice)
        .map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.'))
        .join('');

      const hexColumn = hexParts.join(' ').padEnd(columns * 3 - 1, ' ');
      const line = `${offset.toString(16).padStart(8, '0')}  ${hexColumn}  |${ascii}|`;
      lines.push(line);
    }

    return lines.join('\n');
  }
</script>

<div class="space-y-3">
  {#if resolvedSources.length > 1}
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <span class="label-text">Source</span>
        <select
          class="select select-bordered select-xs"
          bind:value={selectedSourceId}
        >
          {#each resolvedSources as source}
            <option value={source.id}>{source.label}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span class="label-text">Viewer</span>
        <select
          class="select select-bordered select-xs"
          bind:value={viewerMode}
        >
          <option value="hex">Hexdump</option>
          <option value="digests">Digests</option>
          <option value="cString">C Escaped String</option>
        </select>
      </div>
    </div>
  {:else}
    <div class="flex flex-wrap items-center gap-3">
      <div class="label-text">Viewer</div>
      <select
        class="select select-bordered select-xs"
        bind:value={viewerMode}
      >
        <option value="hex">Hexdump</option>
        <option value="digests">Digests</option>
        <option value="cString">C Escaped String</option>
      </select>
    </div>
  {/if}

  {#if viewerMode === 'hex'}
    <pre class="whitespace-pre overflow-auto max-h-60 p-2 bg-base-100 rounded border border-base-300 text-xs font-mono">{currentHexdump}</pre>
  {:else if viewerMode === 'digests'}
    {#if digestLoading}
      <div class="text-sm opacity-70">Calculating digests...</div>
    {:else if digestError}
      <div class="text-sm text-error">{digestError}</div>
    {:else if digestEntries.length === 0}
      <div class="text-sm opacity-70">{emptyMessage}</div>
    {:else}
      <ul class="space-y-1 text-xs font-mono break-all">
        {#each digestEntries as entry}
          <li><span class="font-semibold">{entry.algorithm}:</span> {entry.value}</li>
        {/each}
      </ul>
    {/if}
  {:else if viewerMode === 'cString'}
    <pre class="whitespace-pre-wrap break-words overflow-auto max-h-60 p-2 bg-base-100 rounded border border-base-300 text-xs font-mono">{cEscapedString}</pre>
  {/if}
</div>
