<script lang="ts">
  import { onMount } from 'svelte';
  import { StructuralViewer } from 'shared-ui';
  import { StructuralEditor } from '@lintx/core';

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
          accept: { 'application/octet-stream': kind === 'schema' ? ['.proto', '.desc'] : ['.bin', '.binpb'] },
        }],
        multiple: false,
      });

      const file = await handle.getFile();
      if (kind === 'schema') {
        if (file.name.endsWith('.desc')) {
          const buffer = await file.arrayBuffer();
          await editor.setSchemaDescriptor(new Uint8Array(buffer));
        } else {
          const text = await file.text();
          await editor.setSchema(text);
        }
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
      rootMessageType: editor.getRootMessageType(),
      availableTypes: editor.getAvailableTypes(),
      currentType: editor.getCurrentType(),
      hexView: editor.getHexView('encoded'),
      originalHexView: editor.getHexView('original'),
      isReady: !!editor.getDecodedData(),
    };
    console.log('[WebApp] Editor state updated:', editorState);
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
    console.log("xxxyyyzzz: Web App Component Mounted");
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
    <div class="navbar bg-base-200 rounded-box mb-4">
      <div class="flex-1">
        <a href="/" class="btn btn-ghost text-xl">Forma</a>
      </div>
      <div class="flex-none gap-2">
        <div class="tooltip" data-tip={schemaFileName}>
          <button class="btn btn-sm btn-outline" on:click={() => loadFile('schema')}>Load Schema</button>
        </div>
        <div class="tooltip" data-tip={dataFileName}>
          <button class="btn btn-sm btn-outline" on:click={() => loadFile('data')}>Load Data</button>
        </div>
        <button class="btn btn-sm btn-accent" on:click={loadSampleData}>Load Sample</button>
      </div>
    </div>

    {#if errorMessage}
      <div role="alert" class="alert alert-error mb-4">
        <span>Error: {errorMessage}</span>
      </div>
    {/if}

    {#if editorState?.isReady}
      <StructuralViewer
        decodedData={editorState.decodedData}
        rootMessageType={editorState.rootMessageType}
        availableTypes={editorState.availableTypes}
        currentType={editorState.currentType}
        hexView={editorState.hexView}
        originalHexView={editorState.originalHexView}
        on:save={onSave}
        on:change={(e) => editor.updateDecodedData(e.detail)}
        on:typechange={(e) => editor.setCurrentType(e.detail)}
      />
    {:else if !errorMessage}
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body items-center text-center">
          <h2 class="card-title">Editor Not Ready</h2>
          <p class="opacity-70">Load both a schema and data file to begin editing.</p>
        </div>
      </div>
    {/if}
  </div>
</div>