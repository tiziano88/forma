<script lang="ts">
  import { onMount } from 'svelte';
  import { StructuralViewer } from 'shared-ui';
  import { StructuralEditor } from '@lintx/core';

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
    const availableTypes = editor.getAvailableTypes();
    const decodedData = editor.getDecodedData();
    
    editorState = {
      decodedData: decodedData,
      rootMessageType: editor.getRootMessageType(),
      availableTypes: availableTypes,
      currentType: editor.getCurrentType(),
      hexView: editor.getHexView('encoded'),
      originalHexView: editor.getHexView('original'),
      encodedBytes: editor.getEncodedBytes(),
      originalBytes: editor.getOriginalBytes(),
      isReady: !!decodedData,
    };
    
    console.log('[Webview] State updated:');
    console.log('  - availableTypes:', availableTypes);
    console.log('  - availableTypes.length:', availableTypes?.length);
    console.log('  - decodedData:', decodedData);
    console.log('  - currentType:', editor.getCurrentType());
    console.log('  - rootMessageType:', editor.getRootMessageType());
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
    try {
      console.log('[Webview] handleVsCodeMessage called');
      const msg = event.data || {};
      console.log('[Webview] Received message:', msg);

      switch (msg.type) {
      case 'initWithConfig': {
        console.log('[Webview] Initializing with payload:', msg.payload);
        console.log('[Webview] Payload keys:', Object.keys(msg.payload));
        console.log('[Webview] Data length:', msg.payload.data?.length);
        console.log('[Webview] Type name:', msg.payload.typeName);
        console.log('[Webview] Schema descriptor length:', msg.payload.schemaDescriptor?.length);
        
        const initData = {
          data: new Uint8Array(msg.payload.data || []),
          typeName: msg.payload.typeName,
          schemaDescriptor: msg.payload.schemaDescriptor ? new Uint8Array(msg.payload.schemaDescriptor) : undefined,
        };
        console.log('[Webview] About to call editor.initialize with:', initData);
        
        try {
          await editor.initialize(initData);
          console.log('[Webview] editor.initialize completed successfully');
        } catch (error) {
          console.error('[Webview] Error during editor.initialize:', error);
          console.error('[Webview] Error stack:', error.stack);
        }
        
        schemaFileName = msg.payload.schemaName || 'Pre-compiled Schema';
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
    } catch (error) {
      console.error('[Webview] Error in handleVsCodeMessage:', error);
      console.error('[Webview] Error stack:', error.stack);
    }
  }

  // Setup message listener immediately
  if (vscode) {
    window.addEventListener('message', handleVsCodeMessage);
    vscode.postMessage({ type: 'ready' });
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-base-200 via-base-100 to-base-300/60">
  {#if isSaving}
    <div class="toast toast-top toast-end">
      <div class="alert alert-info shadow-lg">
        <span class="loading loading-spinner loading-sm"></span>
        <span>Saving …</span>
      </div>
    </div>
  {/if}

  <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 pb-12 pt-8 sm:px-4 lg:px-6">
    <header class="flex flex-col gap-4 rounded-2xl border border-base-300/60 bg-base-100/80 p-4 shadow-lg shadow-base-300/25 backdrop-blur">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="space-y-1">
          <div class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Forma Structural Editor
          </div>
          <h1 class="text-xl font-semibold leading-snug text-base-content md:text-2xl">
            Inspect and edit structured protobuf data
          </h1>
          <p class="text-sm text-base-content/70">
            Schema&nbsp;· {schemaFileName} &nbsp;&mdash;&nbsp; Data&nbsp;· {dataFileName}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <div class="badge badge-outline border-primary/40 bg-primary/10 px-3 py-1 text-primary">
            {editorState?.availableTypes?.length ?? 0} types
          </div>
          <div class="badge badge-outline border-accent/40 bg-accent/10 px-3 py-1 text-accent">
            {editorState?.decodedData ? 'Decoded' : 'Raw bytes'}
          </div>
        </div>
      </div>

      {#if errorMessage}
        <div class="alert alert-error border border-error/40 bg-error/10 text-sm shadow-sm">
          <span class="font-medium">Error:</span>
          <span>{errorMessage}</span>
        </div>
      {/if}
    </header>

    <main class="grid gap-4 lg:grid-cols-12">
      <section class="lg:col-span-12">
        {#if editorState?.availableTypes && editorState.availableTypes.length > 0}
          <StructuralViewer
            decodedData={editorState.decodedData}
            rootMessageType={editorState.rootMessageType}
            availableTypes={editorState.availableTypes}
            currentType={editorState.currentType}
            hexView={editorState.hexView}
            originalHexView={editorState.originalHexView}
            encodedBytes={editorState.encodedBytes}
            originalBytes={editorState.originalBytes}
            {editor}
            on:change={(e) => editor.updateDecodedData(e.detail)}
            on:typechange={(e) => editor.setCurrentType(e.detail)}
          />
        {:else}
          <div class="rounded-3xl border border-dashed border-base-300 bg-base-100/60 p-10 text-center shadow-inner">
            <div class="mx-auto flex max-w-md flex-col items-center gap-4">
              <div class="rounded-full bg-base-300/80 p-4 text-base-content/70">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v12m6-6H6" />
                </svg>
              </div>
              <h2 class="text-xl font-semibold">Load a schema and data file to begin</h2>
              <p class="text-sm leading-relaxed text-base-content/70">
                {#if errorMessage}
                  Error: {errorMessage}
                {:else}
                  The editor becomes interactive once both a schema descriptor and data payload are provided from Forma or the CLI tools.
                {/if}
              </p>
            </div>
          </div>
        {/if}
      </section>
    </main>
  </div>
</div>
