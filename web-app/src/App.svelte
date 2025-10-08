<script lang="ts">
  import { onMount } from "svelte";
  import { StructuralViewer } from "shared-ui";
  import { StructuralEditor, defaultValue, resolveRef } from "@lintx/core";
  import type { Schema, Annotations, Type, Value } from "@lintx/core";
  import { dockerfileSchema, dockerfileAnnotations } from "@lintx/core/examples/dockerfile";
  import { cargoTomlSchema, cargoTomlAnnotations } from "@lintx/core/examples/cargo-toml";
  import SchemaExplorer from "./SchemaExplorer.svelte";
  import ValueEditor from "./ValueEditor.svelte";

  const editor = new StructuralEditor();

  let schemaFileName = $state("No schema loaded");
  let dataFileName = $state("No data loaded");
  let errorMessage = $state("");

  let schemaFileHandle = $state<FileSystemFileHandle | null>(null);
  let dataFileHandle = $state<FileSystemFileHandle | null>(null);

  // Which sample is active?
  type SampleKind = 'none' | 'proto' | 'dockerfile' | 'cargo-toml';
  let activeSample = $state<SampleKind>('none');
  let abstractSchema = $state<Schema | null>(null);
  let abstractAnnotations = $state<Annotations | null>(null);
  let abstractRootType = $state<Type | null>(null);
  let rootValue = $state<Value | null>(null);
  let dropdownOpen = $state(false);

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
      activeSample = 'none';
      abstractSchema = null;
      abstractAnnotations = null;
      abstractRootType = null;
      rootValue = null;
    } catch (err: any) {
      if (err.name !== "AbortError") {
        errorMessage = err?.message || String(err);
      }
    }
  }

  async function loadProtoSample() {
    errorMessage = "";
    dropdownOpen = false;
    abstractSchema = null;
    abstractAnnotations = null;
    try {
      const [schemaRes, dataRes] = await Promise.all([
        fetch("/rv.binpb"),
        fetch("/data.binpb"),
      ]);

      const schemaDesc = new Uint8Array(await schemaRes.arrayBuffer());
      const dataBytes = new Uint8Array(await dataRes.arrayBuffer());

      await editor.initialize({
        schemaDescriptor: schemaDesc,
        data: dataBytes,
        typeName: ".oak.attestation.v1.ReferenceValues",
      });

      schemaFileName = "rv.binpb";
      dataFileName = "data.binpb";
      schemaFileHandle = null;
      dataFileHandle = null;
      activeSample = 'proto';
    } catch (err: any) {
      errorMessage = err?.message || String(err);
    }
  }

  function loadDockerfileSample() {
    errorMessage = "";
    dropdownOpen = false;
    // Clear proto editor state
    editor.decodedData = null;
    editor.dataBytes = null;
    activeSample = 'dockerfile';
    abstractSchema = dockerfileSchema;
    abstractAnnotations = dockerfileAnnotations;
    // Create empty root value
    if (dockerfileSchema.root) {
      const rootDef = dockerfileSchema.definitions[dockerfileSchema.root];
      if (rootDef) {
        abstractRootType = rootDef;
        rootValue = defaultValue(dockerfileSchema, rootDef);
      }
    }
  }

  function loadCargoTomlSample() {
    errorMessage = "";
    dropdownOpen = false;
    // Clear proto editor state
    editor.decodedData = null;
    editor.dataBytes = null;
    activeSample = 'cargo-toml';
    abstractSchema = cargoTomlSchema;
    abstractAnnotations = cargoTomlAnnotations;
    // Create empty root value
    if (cargoTomlSchema.root) {
      const rootDef = cargoTomlSchema.definitions[cargoTomlSchema.root];
      if (rootDef) {
        abstractRootType = rootDef;
        rootValue = defaultValue(cargoTomlSchema, rootDef);
      }
    }
  }

  async function onSave() {
    errorMessage = "";
    if (!dataFileHandle) {
      alert("Please load a data file first to enable saving.");
      return;
    }
    try {
      // Save main data file
      const writable = await dataFileHandle.createWritable();
      await writable.write(editor.encodedBytes);
      await writable.close();

      // Save presentation file if there are any comments
      if (editor.isPresentationDirty() || editor.presentationManager.getTotalCommentCount() > 0) {
        const dataFileName = dataFileHandle.name;
        const presentationFileName = dataFileName.replace(/\.(binpb|bin|binarypb)$/, '.presentation.forma.binpb');

        // Offer download of presentation file
        const blob = new Blob([editor.getPresentationData()], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = presentationFileName;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`Downloaded presentation data as ${presentationFileName}`);
      }

      alert("File saved successfully!");
    } catch (err: any) {
      errorMessage = err?.message || String(err);
    }
  }

  // Watch for changes to editor state
  $effect(() => {
    // Access reactive properties to track them
    const decodedData = editor.decodedData;

    console.log("[WebApp] Editor state changed");
    console.log('  - decodedData:', decodedData);

    if (decodedData) {
      console.log('[WebApp] decodedData field keys', Array.from(decodedData.fields.keys()));
      errorMessage = ""; // Clear errors on successful data load
    }
  });

  // Close dropdown on outside click
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.sample-dropdown')) {
      dropdownOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  const sampleLabel = $derived(
    activeSample === 'proto' ? 'Proto (Oak)' :
    activeSample === 'dockerfile' ? 'Dockerfile' :
    activeSample === 'cargo-toml' ? 'Cargo.toml' :
    'Load Sample'
  );
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

        <!-- Sample dropdown -->
        <div class="sample-dropdown relative">
          <button
            class="btn btn-sm btn-secondary"
            onclick={(e: MouseEvent) => { e.stopPropagation(); dropdownOpen = !dropdownOpen; }}
          >
            {sampleLabel}
            <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {#if dropdownOpen}
            <div class="absolute right-0 mt-1 w-56 rounded-lg border shadow-xl z-50 overflow-hidden"
                 style="background: var(--editor-bg-secondary); border-color: var(--editor-border-primary);">
              <button
                class="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors flex items-center gap-3"
                style={activeSample === 'proto' ? 'background: rgba(255,255,255,0.05)' : ''}
                onclick={loadProtoSample}
              >
                <span class="badge badge-xs" style="background: #60a5fa;">pb</span>
                <div>
                  <div class="text-editor-primary font-medium">Proto (Oak)</div>
                  <div class="text-[10px] text-editor-muted">ReferenceValues with binary data</div>
                </div>
              </button>
              <button
                class="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors flex items-center gap-3"
                style={activeSample === 'dockerfile' ? 'background: rgba(255,255,255,0.05)' : ''}
                onclick={loadDockerfileSample}
              >
                <span class="badge badge-xs" style="background: #34d399;">🐳</span>
                <div>
                  <div class="text-editor-primary font-medium">Dockerfile</div>
                  <div class="text-[10px] text-editor-muted">Multi-stage build instructions</div>
                </div>
              </button>
              <button
                class="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors flex items-center gap-3"
                style={activeSample === 'cargo-toml' ? 'background: rgba(255,255,255,0.05)' : ''}
                onclick={loadCargoTomlSample}
              >
                <span class="badge badge-xs" style="background: #f97316;">🦀</span>
                <div>
                  <div class="text-editor-primary font-medium">Cargo.toml</div>
                  <div class="text-[10px] text-editor-muted">Rust package manifest</div>
                </div>
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>

    {#if errorMessage}
      <div role="alert" class="alert-error mb-4">
        <span>Error: {errorMessage}</span>
      </div>
    {/if}

    {#if editor.decodedData && activeSample !== 'dockerfile' && activeSample !== 'cargo-toml'}
      <StructuralViewer
        {editor}
        onsave={onSave}
        onchange={(data) => editor.updateDecodedData(data)}
        ontypechange={(type) => editor.setCurrentType(type)}
      />
    {:else if abstractSchema && abstractAnnotations && rootValue && abstractRootType}
      <section class="section-main">
        <div class="mb-4">
          <SchemaExplorer schema={abstractSchema} annotations={abstractAnnotations} />
        </div>
        <div class="rounded-xl border p-4" style="border-color: var(--editor-border-primary); background: var(--editor-bg-secondary);">
          <h2 class="text-sm font-semibold text-editor-primary mb-3">Value Editor</h2>
          <ValueEditor
            schema={abstractSchema}
            annotations={abstractAnnotations}
            value={rootValue}
            type={abstractRootType}
            onchange={(v) => { rootValue = v; }}
          />
        </div>
      </section>
    {:else if !errorMessage}
      <div class="placeholder-state">
        <div class="mx-auto flex max-w-md flex-col items-center gap-4">
          <h2 class="text-xl font-semibold text-editor-primary">Editor Not Ready</h2>
          <p class="text-sm leading-relaxed text-editor-secondary">
            Load a schema and data file, or select a sample from the dropdown.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
