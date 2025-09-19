<script lang="ts">
  import { onMount } from "svelte";
  import { StructuralViewer } from "shared-ui";
  import { StructuralEditor } from "@lintx/core";
  // Removed protobufjs imports - now using google-protobuf via core package

  const editor = new StructuralEditor();

  let schemaFileName = $state("No schema loaded");
  let dataFileName = $state("No data loaded");
  let errorMessage = $state("");
  let editorState = $state<any>(null);

  let schemaFileHandle = $state<FileSystemFileHandle | null>(null);
  let dataFileHandle = $state<FileSystemFileHandle | null>(null);

  // --- UI Event Handlers ---

  async function loadFile(kind: "schema" | "data") {
    errorMessage = "";
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description:
              kind === "schema" ? "Protobuf Schema" : "Protobuf Data",
            accept: {
              "application/octet-stream":
                kind === "schema"
                  ? [".proto", ".desc", ".proto.bin"]
                  : [".bin", ".binpb", ".binarypb"],
            },
          },
        ],
        multiple: false,
      });

      const file = await handle.getFile();
      if (kind === "schema") {
        if (file.name.endsWith(".desc") || file.name.endsWith(".proto.bin")) {
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
      if (err.name !== "AbortError") {
        errorMessage = err?.message || String(err);
      }
    }
  }

  async function loadTestSample() {
    errorMessage = "";
    try {
      const [schemaRes, dataRes] = await Promise.all([
        // fetch("/sample.desc"),
        // fetch("/sample-data.binpb"),
        fetch("/rv.binpb"),
        fetch("/data.binpb"),
      ]);

      const schemaDesc = new Uint8Array(await schemaRes.arrayBuffer());
      const dataBytes = new Uint8Array(await dataRes.arrayBuffer());

      await editor.initialize({
        schemaDescriptor: schemaDesc,
        data: dataBytes,
        // typeName: ".example.Person",
        typeName: ".oak.attestation.v1.ReferenceValues",
      });

      schemaFileName = "sample.desc";
      dataFileName = "sample-data.binpb";
      schemaFileHandle = null;
      dataFileHandle = null;
    } catch (err: any) {
      errorMessage = err?.message || String(err);
    }
  }

  async function onSave() {
    errorMessage = "";
    if (!dataFileHandle) {
      alert("Please load a data file first to enable saving.");
      return;
    }
    try {
      const bytes = editor.getEncodedBytes();
      const writable = await dataFileHandle.createWritable();
      await writable.write(bytes);
      await writable.close();
      alert("File saved successfully!");
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
      encodedBytes: editor.getEncodedBytes(),
      originalBytes: editor.getOriginalBytes(),
      isReady: !!editor.getDecodedData(),
    };
    console.log("[WebApp] Editor state updated:", $state.snapshot(editorState));
  }

  editor.on("change", () => {
    errorMessage = "";
    updateState();
  });

  editor.on("error", (event) => {
    errorMessage = event.payload?.message || "An unknown error occurred.";
    updateState();
  });

  onMount(() => {
    console.log("xxxyyyzzz: Web App Component Mounted");
    // Create a public directory in the web-app package and copy sample files
    // This is a workaround for Vite dev server to serve these files.
    const setupSampleFiles = async () => {
      try {
        await fetch("/sample.proto");
        await fetch("/sample.binpb");
      } catch {
        console.warn(
          "Sample files not found. You may need to copy them to the 'public' directory of the 'web-app' package."
        );
      }
    };
    setupSampleFiles();
  });
</script>

<div class="main-container p-4 sm:p-6 lg:p-8">
  <div class="max-w-4xl mx-auto">
    <div class="navbar-editor">
      <div class="flex-1">
        <a href="/" class="btn btn-ghost text-xl">Forma</a>
      </div>
      <div class="flex-none gap-2">
        <div class="tooltip" data-tip={schemaFileName}>
          <button
            class="btn btn-sm btn-outline"
            onclick={() => loadFile("schema")}>Load Schema</button
          >
        </div>
        <div class="tooltip" data-tip={dataFileName}>
          <button
            class="btn btn-sm btn-outline"
            onclick={() => loadFile("data")}>Load Data</button
          >
        </div>
        <button class="btn btn-sm btn-secondary" onclick={loadTestSample}
          >Load Test Sample</button
        >
      </div>
    </div>

    {#if errorMessage}
      <div role="alert" class="alert-error mb-4">
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
        encodedBytes={editorState.encodedBytes}
        originalBytes={editorState.originalBytes}
        {editor}
        onsave={onSave}
        onchange={(data) => editor.updateDecodedData(data)}
        ontypechange={(type) => editor.setCurrentType(type)}
      />
    {:else if !errorMessage}
      <div class="placeholder-state">
        <div class="mx-auto flex max-w-md flex-col items-center gap-4">
          <h2 class="text-xl font-semibold text-editor-primary">Editor Not Ready</h2>
          <p class="text-sm leading-relaxed text-editor-secondary">
            Load both a schema and data file to begin editing.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
