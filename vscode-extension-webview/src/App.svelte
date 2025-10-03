<script lang="ts">
  import { onMount } from 'svelte';
  import { StructuralViewer } from 'shared-ui';
  import {
    StructuralEditor,
    type MessageValue,
    type MessageType,
    type Bytes,
  } from '@lintx/core';

  // VSCode webview message types
  type ToVSCodeMessage =
    | { type: 'ready' }
    | { type: 'contentChanged'; payload: number[] }
    | { type: 'save' }
    | { requestId: string; payload: number[] | { error: string } };

  type FromVSCodeMessage =
    | {
        type: 'initWithConfig';
        payload: {
          data: number[];
          typeName?: string;
          schemaDescriptor?: number[];
          schemaName?: string;
          dataName?: string;
        };
      }
    | { type: 'updateContent'; payload: number[] }
    | { type: 'getEncodedBytes'; requestId: string }
    | { type: 'saveResponse'; success: boolean; error?: string };

  type VSCodeAPI = { postMessage: (msg: ToVSCodeMessage) => void };
  // @ts-ignore
  const acquire =
    typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi : null;
  const vscode: VSCodeAPI | null = acquire ? acquire() : null;

  const editor = new StructuralEditor();

  let schemaFileName = $state('No schema loaded');
  let dataFileName = $state('No data loaded');
  let isInitialized = $state(false);
  let isSaving = $state(false);

  // Watch for changes to editor state and notify VSCode
  $effect(() => {
    const encodedBytes = editor.encodedBytes;

    console.log('[Webview] Editor state changed');
    console.log('  - availableTypes:', editor.availableTypes);
    console.log('  - availableTypes.length:', editor.availableTypes?.length);
    console.log('  - decodedData:', editor.decodedData);
    console.log('  - currentType:', editor.selectedTypeName);
    console.log('  - rootMessageType:', editor.rootMessageType);

    if (isInitialized) {
      vscode?.postMessage({
        type: 'contentChanged',
        payload: Array.from(encodedBytes),
      });
    }
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
          console.log(
            '[Webview] Schema descriptor length:',
            msg.payload.schemaDescriptor?.length
          );

          const initData = {
            data: new Uint8Array(msg.payload.data || []),
            typeName: msg.payload.typeName,
            schemaDescriptor: msg.payload.schemaDescriptor
              ? new Uint8Array(msg.payload.schemaDescriptor)
              : undefined,
          };
          console.log(
            '[Webview] About to call editor.initialize with:',
            initData
          );

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
          setTimeout(() => {
            isSaving = false;
          }, 1000);
          try {
            vscode?.postMessage({
              requestId: msg.requestId,
              payload: Array.from(editor.encodedBytes),
            });
          } catch (err: any) {
            vscode?.postMessage({
              requestId: msg.requestId,
              payload: { error: err.message },
            });
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
    {#if editor.availableTypes && editor.availableTypes.length > 0}
      <StructuralViewer
        {editor}
        onchange={(data) => editor.updateDecodedData(data)}
        ontypechange={(type) => editor.setCurrentType(type || '')}
        onsave={() => {}}
      />
    {:else}
      <div class="placeholder-state">
        <div class="mx-auto flex max-w-md flex-col items-center gap-4">
          <div
            class="rounded-full p-4"
            style="background: var(--editor-bg-tertiary); color: var(--editor-text-secondary);"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 6v12m6-6H6"
              />
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-editor-primary">
            Load a schema and data file to begin
          </h2>
          <p class="text-sm leading-relaxed text-editor-secondary">
            The editor becomes interactive once both a schema descriptor and
            data payload are provided from Forma or the CLI tools.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
