<script lang="ts">
  import { onMount } from 'svelte';
  import StructuralViewer from './lib/StructuralViewer.svelte';
  import type { StructuralEditorInit, SaveCallback } from './lib/types';

  // VS Code webview bridge
  type VSCodeAPI = { postMessage: (msg: any) => void, getState: () => any, setState: (s: any) => void } | null;
  // @ts-ignore acquireVsCodeApi is injected by VS Code webviews
  const acquire = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi : null;
  const vscode: VSCodeAPI = acquire ? acquire() : null;
  let reqId = 0;
  const pending = new Map<number, (data: any) => void>();
  if (typeof window !== 'undefined') {
    window.addEventListener('message', (event: MessageEvent) => {
      const msg = event.data || {};
      if (msg && typeof msg === 'object' && 'requestId' in msg) {
        const resolver = pending.get(msg.requestId);
        if (resolver) {
          pending.delete(msg.requestId);
          resolver(msg);
        }
      }
    });
    // Listen for push-style init when opened from VS Code command
    window.addEventListener('message', (event: MessageEvent) => {
      const msg = event.data || {};
      if (msg && msg.type === 'initWithConfig' && msg.payload) {
        const p = msg.payload as { schema: string; data: number[]; typeName?: string; dataName?: string; schemaName?: string };
        schemaText = p.schema;
        dataBuffer = new Uint8Array(p.data || []);
        schemaFileName = p.schemaName || 'Schema';
        dataFileName = p.dataName || 'Data';
        typeNameOverride = p.typeName || null;
      }
    });
  }
  function postRequest<T = any>(type: string, payload?: any): Promise<T> {
    if (!vscode) return Promise.reject(new Error('Not running inside VS Code'));
    const id = ++reqId;
    vscode.postMessage({ type, requestId: id, payload });
    return new Promise<T>((resolve) => pending.set(id, (msg) => resolve(msg.payload as T)));
  }

  onMount(() => {
    if (vscode) {
      vscode.postMessage({ type: 'ready' });
    }
  });

  // Chrome state
  let schemaHandle: FileSystemFileHandle | null = null;
  let dataHandle: FileSystemFileHandle | null = null;
  let schemaText: string | null = null;
  let dataBuffer: Uint8Array | null = null;
  let typeNameOverride: string | null = null;

  let schemaFileName = 'No schema loaded';
  let dataFileName = 'No data loaded';

  let errorMessage = '';

  // Build viewer init only when both are present
  let current: StructuralEditorInit | null = null;
  $: current = (schemaText && dataBuffer)
    ? { schemaText, data: dataBuffer, typeName: typeNameOverride, schemaName: schemaFileName, dataName: dataFileName }
    : null;

  async function loadFile(kind: 'schema' | 'data') {
    try {
      if (vscode) {
        const file = await postRequest<{ name: string; content: number[] }>('pickFile', { kind });
        if (kind === 'schema') {
          schemaHandle = null;
          schemaFileName = file.name;
          schemaText = new TextDecoder().decode(new Uint8Array(file.content));
        } else {
          dataHandle = null;
          dataFileName = file.name;
          dataBuffer = new Uint8Array(file.content);
        }
      } else {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: kind === 'schema' ? 'Protobuf Schema' : 'Protobuf Data',
              accept: { 'application/octet-stream': kind === 'schema' ? ['.proto'] : ['.bin'] },
            },
          ],
          multiple: false,
        });
        if (kind === 'schema') {
          schemaHandle = handle;
          schemaFileName = schemaHandle.name;
          const f = await schemaHandle.getFile();
          schemaText = await f.text();
        } else {
          dataHandle = handle;
          dataFileName = dataHandle.name;
          const f = await dataHandle.getFile();
          dataBuffer = new Uint8Array(await f.arrayBuffer());
        }
      }
    } catch (err: any) {
      console.error('Error opening file:', err);
      errorMessage = err?.message || String(err);
    }
  }

  async function loadSampleData() {
    try {
      errorMessage = '';
      schemaHandle = null;
      dataHandle = null;
      schemaFileName = 'sample.proto';
      dataFileName = 'sample.bin';
      let schema: string;
      let buffer: Uint8Array;
      if (vscode) {
        const payload = await postRequest<{ schema: string; data: number[] }>('getSample');
        schema = payload.schema;
        buffer = new Uint8Array(payload.data);
      } else {
        const schemaResponse = await fetch('/sample.proto');
        if (!schemaResponse.ok) throw new Error('Failed to load sample.proto');
        schema = await schemaResponse.text();
        const dataResponse = await fetch('/sample.bin');
        if (!dataResponse.ok) throw new Error('Failed to load sample.bin');
        buffer = new Uint8Array(await dataResponse.arrayBuffer());
      }
      schemaText = schema;
      dataBuffer = buffer;
      typeNameOverride = null;
    } catch (err: any) {
      console.error('Error loading sample data:', err);
      errorMessage = err?.message || String(err);
    }
  }

  const onSave: SaveCallback = async (bytes, suggestedName) => {
    if (vscode) {
      await postRequest('saveData', { name: suggestedName || dataFileName || 'data.bin', content: Array.from(bytes) });
      return;
    }
    if (!dataHandle) {
      errorMessage = 'Cannot save: no file handle available. Load a data file first.';
      throw new Error(errorMessage);
    }
    const writable = await dataHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
  };
</script>

<div class="p-4 sm:p-6 lg:p-8">
  <div class="max-w-4xl mx-auto">
    <header class="text-center mb-8">
      <h1 class="text-4xl font-bold">Structural Editor</h1>
      <p class="text-lg mt-2">Load a Protobuf schema (.proto) and a binary data file (.bin) to begin editing.</p>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <button class="btn btn-primary" on:click={() => loadFile('schema')}>Load Schema (.proto)</button>
          <span class="text-sm mt-2">{schemaFileName}</span>
        </div>
      </div>
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <button class="btn btn-secondary" on:click={() => loadFile('data')}>Load Data (.bin)</button>
          <span class="text-sm mt-2">{dataFileName}</span>
        </div>
      </div>
    </div>

    <div class="mb-8">
      <button class="btn btn-accent w-full" on:click={loadSampleData}>Load Sample Data</button>
    </div>

    {#if errorMessage}
      <div role="alert" class="alert alert-error mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Error: {errorMessage}</span>
      </div>
    {/if}

    <StructuralViewer init={current} {onSave} />
  </div>
</div>
