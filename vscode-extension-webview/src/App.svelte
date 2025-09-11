<script lang="ts">
  import { onMount } from 'svelte';
  import { StructuralViewer } from 'shared-ui';
  import { StructuralEditor } from 'core';

  // Standard VS Code webview API
  type VSCodeAPI = { postMessage: (msg: any) => void };
  // @ts-ignore
  const acquire = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi : null;
  const vscode: VSCodeAPI | null = acquire ? acquire() : null;

  const editor = new StructuralEditor();

  let schemaFileName = 'No schema loaded';
  let dataFileName = 'No data loaded';
  let errorMessage = '';
  let editorState: any = null;
  let isInitialized = false;
  let isSaving = false;

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
  }

  editor.on('change', () => {
    updateState();
    console.log('[Webview] Editor change event fired. New state:', editorState);
    if (isInitialized) {
      vscode?.postMessage({
        type: 'contentChanged',
        payload: Array.from(editor.getEncodedBytes()),
      });
    }
  });

  editor.on('error', (event) => {
    errorMessage = event.payload?.message || 'An unknown error occurred.';
    updateState();
  });

  // --- VS Code Communication ---
  async function handleVsCodeMessage(event: MessageEvent) {
    const msg = event.data || {};
    console.log('[Webview] Received message:', msg);

    switch (msg.type) {
      case 'initWithConfig': {
        console.log('[Webview] Initializing with payload:', msg.payload);
        await editor.initialize({
          schemaText: msg.payload.schema,
          schemaDescriptor: new Uint8Array(msg.payload.schemaDescriptor || []),
          data: new Uint8Array(msg.payload.data || []),
          typeName: msg.payload.typeName,
        });
        schemaFileName = msg.payload.schemaName || 'Schema';
        dataFileName = msg.payload.dataName || 'Data';
        isInitialized = true;
        break;
      }
      case 'updateContent': {
        isInitialized = false;
        await editor.setData(new Uint8Array(msg.payload));
        isInitialized = true;
        break;
      }
      case 'getEncodedBytes': {
        isSaving = true;
        setTimeout(() => { isSaving = false; }, 1000);
        try {
          const content = editor.getEncodedBytes();
          vscode?.postMessage({ requestId: msg.requestId, payload: Array.from(content) });
        } catch (err: any) {
          vscode?.postMessage({ requestId: msg.requestId, payload: { error: err.message } });
        }
        break;
      }
    }
  }

  // Setup message listener immediately
  if (vscode) {
    window.addEventListener('message', handleVsCodeMessage);
    vscode.postMessage({ type: 'ready' });
  }
</script>

<div class="p-4 sm:p-6 lg:p-8 relative">
  {#if isSaving}
    <div class="toast toast-top toast-center">
      <div class="alert alert-info">
        <span>Saving...</span>
      </div>
    </div>
  {/if}

  <div class="max-w-4xl mx-auto">
    <div class="navbar bg-base-200 rounded-box mb-4">
      <div class="flex-1">
        <span class="text-xl font-bold">Forma Editor</span>
      </div>
      <div class="flex-none gap-2">
        <div class="tooltip" data-tip={schemaFileName}>
          <span class="text-sm opacity-70">{schemaFileName}</span>
        </div>
        <div class="tooltip" data-tip={dataFileName}>
          <span class="text-sm opacity-70">{dataFileName}</span>
        </div>
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
        on:change={(e) => editor.updateDecodedData(e.detail)}
        on:typechange={(e) => editor.setCurrentType(e.detail)}
      />
    {:else if !errorMessage}
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body items-center text-center">
          <h2 class="card-title">Editor Not Ready</h2>
          <p class="opacity-70">Please wait for data to be loaded.</p>
        </div>
      </div>
    {/if}
  </div>
</div>