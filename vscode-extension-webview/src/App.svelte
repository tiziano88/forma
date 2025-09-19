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

  let schemaFileName = $state('No schema loaded');
  let dataFileName = $state('No data loaded');
  let errorMessage = $state('');
  let editorState = $state<any>(null);
  let isInitialized = $state(false);
  let isSaving = $state(false);

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
    console.log('[Webview] Editor change event fired. New state:', $state.snapshot(editorState));
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
          console.error('[Webview] Error stack:', (error as Error).stack);
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
      console.error('[Webview] Error stack:', (error as Error).stack);
    }
  }

  // Setup message listener immediately
  if (vscode) {
    window.addEventListener('message', handleVsCodeMessage);
    vscode.postMessage({ type: 'ready' });
  }
</script>

<div class="min-h-screen main-gradient">
  {#if isSaving}
    <div class="toast toast-top toast-end">
      <div class="alert alert-info shadow-lg">
        <span class="loading loading-spinner loading-sm"></span>
        <span>Saving …</span>
      </div>
    </div>
  {/if}

  <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 pb-12 pt-8 sm:px-4 lg:px-6">
    <header class="app-header">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="space-y-1">
          <div class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold status-primary">
            Forma Structural Editor
          </div>
          <h1 class="text-xl font-semibold leading-snug text-editor-primary md:text-2xl">
            Inspect and edit structured protobuf data
          </h1>
          <p class="text-sm text-editor-secondary">
            Schema&nbsp;· {schemaFileName} &nbsp;&mdash;&nbsp; Data&nbsp;· {dataFileName}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <div class="badge-editor-outline px-3 py-1">
            {editorState?.availableTypes?.length ?? 0} types
          </div>
          <div class="badge-editor-accent px-3 py-1">
            {editorState?.decodedData ? 'Decoded' : 'Raw bytes'}
          </div>
        </div>
      </div>

      {#if errorMessage}
        <div class="alert-error text-sm shadow-sm">
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
            onchange={(data) => editor.updateDecodedData(data)}
            ontypechange={(type) => editor.setCurrentType(type || '')}
            onsave={() => {}}
          />
        {:else}
          <div class="placeholder-state">
            <div class="mx-auto flex max-w-md flex-col items-center gap-4">
              <div class="rounded-full p-4" style="background: var(--editor-bg-tertiary); color: var(--editor-text-secondary);">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v12m6-6H6" />
                </svg>
              </div>
              <h2 class="text-xl font-semibold text-editor-primary">Load a schema and data file to begin</h2>
              <p class="text-sm leading-relaxed text-editor-secondary">
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
