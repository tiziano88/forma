<script lang="ts">
  import { onMount, tick } from "svelte";
  import StructuralViewer from "./lib/StructuralViewer.svelte";
  import { StructuralEditor } from "core/src/StructuralEditor";
  import type { EditorData } from "core/src/types";

  // VS Code webview bridge logic
  type VSCodeAPI = { postMessage: (msg: any) => void };
  // @ts-ignore
  const acquire =
    typeof acquireVsCodeApi === "function" ? acquireVsCodeApi : null;
  const vscode: VSCodeAPI | null = acquire ? acquire() : null;

  const editor = new StructuralEditor();

  let schemaFileName = "No schema loaded";
  let dataFileName = "No data loaded";
  let errorMessage = "";
  let editorState: any = null; // This will hold all reactive state from the editor

  // --- UI Event Handlers ---

  async function loadFile(kind: "schema" | "data") {
    errorMessage = "";
    try {
      if (vscode) {
        // VS Code environment
        const file = await postMessageWithResponse("pickFile", { kind });
        if (kind === "schema") {
          await editor.setSchema(
            new TextDecoder().decode(new Uint8Array(file.content))
          );
          schemaFileName = file.name;
        } else {
          await editor.setData(new Uint8Array(file.content));
          dataFileName = file.name;
        }
      } else {
        // Web environment
        const [handle] = await (window as any).showOpenFilePicker({
          /* ... */
        });
        const file = await handle.getFile();
        if (kind === "schema") {
          const text = await file.text();
          await editor.setSchema(text);
          schemaFileName = file.name;
        } else {
          const buffer = await file.arrayBuffer();
          await editor.setData(new Uint8Array(buffer));
          dataFileName = file.name;
        }
      }
    } catch (err: any) {
      errorMessage = err?.message || String(err);
    }
  }

  async function loadSampleData() {
    errorMessage = "";
    try {
      let sample: { schema: string; data: number[] };
      if (vscode) {
        sample = await postMessageWithResponse("getSample");
      } else {
        const schemaRes = await fetch("/sample.proto");
        const dataRes = await fetch("/sample.binpb");
        sample = {
          schema: await schemaRes.text(),
          data: Array.from(new Uint8Array(await dataRes.arrayBuffer())),
        };
      }
      await editor.initialize({
        schemaText: sample.schema,
        data: new Uint8Array(sample.data),
      });
      schemaFileName = "sample.proto";
      dataFileName = "sample.binpb";
    } catch (err: any) {
      errorMessage = err?.message || String(err);
    }
  }

  async function onSave() {
    errorMessage = "";
    try {
      const bytes = editor.getEncodedBytes();
      if (vscode) {
        await postMessageWithResponse("saveData", {
          name: dataFileName,
          content: Array.from(bytes),
        });
      } else {
        // Web environment save logic would go here
        alert("Save functionality not implemented for web yet.");
      }
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
      hexView: editor.getHexView("encoded"),
      originalHexView: editor.getHexView("original"),
      isReady: !!editor.getDecodedData(),
    };
  }

  editor.on("change", () => {
    errorMessage = "";
    updateState();
  });

  editor.on("error", (event) => {
    errorMessage = event.payload?.message || "An unknown error occurred.";
    updateState();
  });

  // --- VS Code Communication ---

  let messageQueue: any[] = [];
  let isReady = false;

  onMount(() => {
    if (vscode) {
      isReady = true;
      // Process any messages that arrived before we were ready
      while(messageQueue.length > 0) {
        handleVsCodeMessage(messageQueue.shift());
      }
      window.addEventListener("message", handleVsCodeMessage);
      vscode.postMessage({ type: "ready" });
    }
  });

  // Listen for messages immediately
  if (typeof window !== 'undefined' && !isReady) {
    window.addEventListener('message', (event: MessageEvent) => {
      if (isReady) return;
      messageQueue.push(event);
    });
  }

  async function handleVsCodeMessage(event: MessageEvent) {
    const msg = event.data || {};
    if (msg.type === "initWithConfig" && msg.payload) {
      const p = msg.payload as {
        schema: string;
        data: number[];
        typeName?: string;
        dataName?: string;
        schemaName?: string;
      };
      await editor.initialize({
        schemaText: p.schema,
        data: new Uint8Array(p.data || []),
        typeName: p.typeName,
      });
      schemaFileName = p.schemaName || "Schema";
      dataFileName = p.dataName || "Data";
    }
  }

  let reqId = 0;
  const pendingRequests = new Map<number, (data: any) => void>();
  function postMessageWithResponse(type: string, payload?: any): Promise<any> {
    if (!vscode) return Promise.reject(new Error("Not in VS Code"));
    const id = ++reqId;
    vscode.postMessage({ type, requestId: id, payload });
    return new Promise((resolve) => pendingRequests.set(id, resolve));
  }

  if (typeof window !== "undefined") {
    window.addEventListener("message", (event: MessageEvent) => {
      const msg = event.data || {};
      if (msg.requestId && pendingRequests.has(msg.requestId)) {
        pendingRequests.get(msg.requestId)!(msg.payload);
        pendingRequests.delete(msg.requestId);
      }
    });
  }
</script>

<div class="p-4 sm:p-6 lg:p-8">
  <div class="max-w-4xl mx-auto">
    <header class="text-center mb-8">
      <h1 class="text-4xl font-bold">Structural Editor</h1>
      <p class="text-lg mt-2">
        Load a Protobuf schema (.proto) and a binary data file (.binpb) to begin
        editing.
      </p>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <button class="btn btn-primary" on:click={() => loadFile("schema")}
            >Load Schema (.proto)</button
          >
          <span class="text-sm mt-2">{schemaFileName}</span>
        </div>
      </div>
      <div class="card bg-base-200 shadow-xl">
        <div class="card-body">
          <button class="btn btn-secondary" on:click={() => loadFile("data")}
            >Load Data (.binpb)</button
          >
          <span class="text-sm mt-2">{dataFileName}</span>
        </div>
      </div>
    </div>

    <div class="mb-8">
      <button class="btn btn-accent w-full" on:click={loadSampleData}
        >Load Sample Data</button
      >
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
          <div class="mt-4 space-y-2 text-left">
            {#if schemaFileName === 'No schema loaded'}
              <p>❌ <span class="font-semibold">Schema:</span> Missing</p>
            {:else}
              <p>✅ <span class="font-semibold">Schema:</span> {schemaFileName}</p>
            {/if}
            {#if dataFileName === 'No data loaded'}
              <p>❌ <span class="font-semibold">Data:</span> Missing</p>
            {:else}
              <p>✅ <span class="font-semibold">Data:</span> {dataFileName}</p>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
