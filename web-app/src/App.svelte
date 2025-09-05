<script lang="ts">
  import { onMount } from 'svelte';
  import StructuralViewer from './lib/StructuralViewer.svelte';
  import { StructuralEditor } from 'core/src/StructuralEditor';

  const editor = new StructuralEditor();

  let schemaFileName = 'No schema loaded';
  let dataFileName = 'No data loaded';
  let errorMessage = '';
  let editorState: any = null;

  let schemaFileHandle: FileSystemFileHandle | null = null;
  let dataFileHandle: FileSystemFileHandle | null = null;

  // --- UI Event Handlers ---

  async function loadFile(kind: 'schema' | 'data') {
    errorMessage = '';
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description: kind === 'schema' ? 'Protobuf Schema' : 'Protobuf Data',
          accept: { 'application/octet-stream': kind === 'schema' ? ['.proto'] : ['.bin', '.binpb'] },
        }],
        multiple: false,
      });

      const file = await handle.getFile();
      if (kind === 'schema') {
        const text = await file.text();
        await editor.setSchema(text);
        schemaFileName = file.name;
        schemaFileHandle = handle;
      } else {
        const buffer = await file.arrayBuffer();
        await editor.setData(new Uint8Array(buffer));
        dataFileName = file.name;
        dataFileHandle = handle;
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        errorMessage = err?.message || String(err);
      }
    }
  }

  async function loadSampleData() {
    errorMessage = '';
    try {
      const schemaRes = await fetch('/sample.proto');
      const dataRes = await fetch('/sample.binpb');
      const sample = {
        schema: await schemaRes.text(),
        data: new Uint8Array(await dataRes.arrayBuffer()),
      };
      await editor.initialize({
        schemaText: sample.schema,
        data: sample.data,
      });
      schemaFileName = 'sample.proto';
      dataFileName = 'sample.binpb';
      schemaFileHandle = null;
      dataFileHandle = null;
    } catch (err: any) {
      errorMessage = err?.message || String(err);
    }
  }

  async function onSave() {
    errorMessage = '';
    if (!dataFileHandle) {
      alert('Please load a data file first to enable saving.');
      return;
    }
    try {
      const bytes = editor.getEncodedBytes();
      const writable = await dataFileHandle.createWritable();
      await writable.write(bytes);
      await writable.close();
      alert('File saved successfully!');
    } catch (err: any) {
      errorMessage = err?.message || String(err);
    }
  }

  // --- Editor State Management ---

  function updateState() {
    editorState = {
      decodedData: editor.getDecodedData(),
      availableTypes: editor.getAvailableTypes(),
      currentType: editor.getCurrentType(),
      hexView: editor.getHexView('encoded'),
      originalHexView: editor.getHexView('original'),
      isReady: !!editor.getDecodedData(),
    };
  }

  editor.on('change', () => {
    errorMessage = '';
    updateState();
  });

  editor.on('error', (event) => {
    errorMessage = event.payload?.message || 'An unknown error occurred.';
    updateState();
  });

  onMount(() => {
    // Create a public directory in the web-app package and copy sample files
    // This is a workaround for Vite dev server to serve these files.
    const setupSampleFiles = async () => {
      try {
        await fetch('/sample.proto');
        await fetch('/sample.binpb');
      } catch {
        console.warn("Sample files not found. You may need to copy them to the 'public' directory of the 'web-app' package.");
      }
    };
    setupSampleFiles();
  });

</script>

<div class="p-4 sm:p-6 lg:p-8">
  <div class="max-w-4xl mx-auto">
    <header class="text-center mb-8">
      <h1 class="text-4xl font-bold">Structural Editor (Web)</h1>
      <p class="text-lg mt-2">
        Load a Protobuf schema (.proto) and a binary data file (.binpb) to begin editing.
      </p>
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
          <button class="btn btn-secondary" on:click={() => loadFile('data')}>Load Data (.binpb)</button>
          <span class="text-sm mt-2">{dataFileName}</span>
        </div>
      </div>
    </div>

    <div class="mb-8">
      <button class="btn btn-accent w-full" on:click={loadSampleData}>Load Sample Data</button>
    </div>

    {#if errorMessage}
      <div role="alert" class="alert alert-error mb-4">
        <span>Error: {errorMessage}</span>
      </div>
    {/if}

    {#if editorState?.isReady}
      <StructuralViewer
        decodedData={editorState.decodedData}
        availableTypes={editorState.availableTypes}
        currentType={editorState.currentType}
        hexView={editorState.hexView}
        originalHexView={editorState.originalHexView}
        on:save={onSave}
        on:change={(e) => editor.updateDecodedData(e.detail)}
        on:typechange={(e) => editor.setCurrentType(e.detail)}
      />
    {/if}
  </div>
</div>
