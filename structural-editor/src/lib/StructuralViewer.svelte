<script lang="ts">
  import type * as protobuf from 'protobufjs';
  import ObjectViewer from './ObjectViewer.svelte';
  import { decodeWithSchema, encodeFrom, sanitizeDataForSave, listMessageTypeNames } from './core';
  import type { StructuralViewerProps, StructuralEditorInit, SaveCallback } from './types';

  export let init: StructuralEditorInit | null = null;
  export let onSave: SaveCallback | undefined;

  let availableTypeNames: string[] = [];
  let selectedTypeName: string | null = null;
  let rootMessageType: protobuf.Type | null = null;
  let decodedDataObject: any = null;
  let errorMessage = '';
  let hexSource: 'original' | 'encoded' = 'encoded';

  $: encodedBytes = (init && rootMessageType && decodedDataObject)
    ? encodeFrom(rootMessageType, sanitizeDataForSave(decodedDataObject, rootMessageType))
    : (init ? init.data : new Uint8Array());

  $: hexText = init ? formatHex(hexSource === 'encoded' ? encodedBytes : init.data) : '';

  $: if (init) {
    try {
      availableTypeNames = listMessageTypeNames(init.schemaText);
      selectedTypeName = init.typeName && availableTypeNames.includes(init.typeName) ? init.typeName : null;
    } catch (e) {
      availableTypeNames = [];
      selectedTypeName = null;
    }
  }

  $: if (init) {
    parseAndDecode();
  }

  async function parseAndDecode() {
    if (!init) return;
    try {
      errorMessage = '';
      decodedDataObject = null;
      const { type, decoded } = decodeWithSchema(init.schemaText, init.data, selectedTypeName || init.typeName || null);
      rootMessageType = type;
      decodedDataObject = decoded;
    } catch (err: any) {
      console.error('Error processing files:', err);
      errorMessage = err?.message || String(err);
    }
  }

  function handleTypeChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    selectedTypeName = v ? v : null;
    parseAndDecode();
  }

  async function save() {
    if (!onSave || !rootMessageType || !decodedDataObject) return;
    const objectToSave = sanitizeDataForSave(decodedDataObject, rootMessageType);
    const errMsg = rootMessageType.verify(objectToSave);
    if (errMsg) throw new Error(`Verification failed: ${errMsg}`);
    const buffer = encodeFrom(rootMessageType, objectToSave);
    await onSave(buffer, init?.dataName);
    alert('Save successful!');
  }

  function toHex(n: number, width = 2) {
    return n.toString(16).toUpperCase().padStart(width, '0');
  }
  function formatHex(data: Uint8Array, cols = 16): string {
    let out: string[] = [];
    for (let i = 0; i < data.length; i += cols) {
      const slice = data.subarray(i, Math.min(i + cols, data.length));
      const addr = toHex(i, 8);
      const hex = Array.from(slice).map(b => toHex(b)).join(' ');
      const pad = '   '.repeat(cols - slice.length);
      const ascii = Array.from(slice).map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
      out.push(`${addr}  ${hex}${pad}  |${ascii}|`);
    }
    return out.join('\n');
  }
</script>

{#if init}
  <div class="mb-4 card bg-base-200 shadow-xl">
    <div class="card-body">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div class="text-sm opacity-70">Schema</div>
          <div class="font-mono">{init.schemaName ?? 'Schema'}</div>
        </div>
        <div>
          <div class="text-sm opacity-70">Data</div>
          <div class="font-mono">{init.dataName ?? 'Data'}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="mb-4 card bg-base-200 shadow-xl">
    <div class="card-body">
      <label class="label">Root Message Type</label>
      <select class="select select-bordered w-full" value={selectedTypeName ?? ''} on:change={handleTypeChange}>
        <option value=''>Auto (last in schema)</option>
        {#each availableTypeNames as name}
          <option value={name}>{name}</option>
        {/each}
      </select>
    </div>
  </div>

  {#if errorMessage}
    <div role="alert" class="alert alert-error mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span>Error: {errorMessage}</span>
    </div>
  {/if}

  {#if decodedDataObject && rootMessageType}
    <div class="mb-4">
      <button class="btn btn-success w-full" on:click={save} disabled={!onSave}>Save Changes</button>
    </div>
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <ObjectViewer object={decodedDataObject} type={rootMessageType} />
      </div>
    </div>
  {/if}

  {#if init}
    <div class="mt-6 card bg-base-200 shadow-xl">
      <div class="card-body">
        <div class="flex items-center justify-between mb-2">
          <div class="font-semibold">Hex Viewer</div>
          <div class="flex items-center gap-2">
            <label class="label-text">Source</label>
            <select class="select select-bordered select-sm" bind:value={hexSource}>
              <option value="encoded">Current (encoded)</option>
              <option value="original">Original</option>
            </select>
          </div>
        </div>
        <pre class="whitespace-pre overflow-auto max-h-80 p-3 bg-base-100 rounded border border-base-300 text-xs font-mono">{hexText}</pre>
      </div>
    </div>
  {/if}
{/if}
