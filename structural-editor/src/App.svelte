<script lang="ts">
  import { onMount } from "svelte";
  import StructuralViewer from "./lib/StructuralViewer.svelte";
  import type { StructuralEditorInit, SaveCallback } from "./lib/types";
  import {
    parseBinaryLintx,
    parseKeyValueConfig,
    findMatchingConfig,
    type LintxFileMapping,
  } from "./lib/core";

  // VS Code webview bridge
  type VSCodeAPI = {
    postMessage: (msg: any) => void;
    getState: () => any;
    setState: (s: any) => void;
  } | null;
  // @ts-ignore acquireVsCodeApi is injected by VS Code webviews
  const acquire =
    typeof acquireVsCodeApi === "function" ? acquireVsCodeApi : null;
  const vscode: VSCodeAPI = acquire ? acquire() : null;
  let reqId = 0;
  const pending = new Map<number, (data: any) => void>();
  if (typeof window !== "undefined") {
    window.addEventListener("message", (event: MessageEvent) => {
      const msg = event.data || {};
      if (msg && typeof msg === "object" && "requestId" in msg) {
        const resolver = pending.get(msg.requestId);
        if (resolver) {
          pending.delete(msg.requestId);
          resolver(msg);
        }
      }
    });
    // Listen for push-style init when opened from VS Code command
    window.addEventListener("message", (event: MessageEvent) => {
      const msg = event.data || {};
      if (msg && msg.type === "initWithConfig" && msg.payload) {
        const p = msg.payload as {
          schema: string;
          data: number[];
          typeName?: string;
          dataName?: string;
          schemaName?: string;
        };
        schemaText = p.schema;
        dataBuffer = new Uint8Array(p.data || []);
        schemaFileName = p.schemaName || "Schema";
        dataFileName = p.dataName || "Data";
        typeNameOverride = p.typeName || null;
      }
    });
  }
  function postRequest<T = any>(type: string, payload?: any): Promise<T> {
    if (!vscode) return Promise.reject(new Error("Not running inside VS Code"));
    const id = ++reqId;
    vscode.postMessage({ type, requestId: id, payload });
    return new Promise<T>((resolve) =>
      pending.set(id, (msg) => resolve(msg.payload as T))
    );
  }

  onMount(() => {
    if (vscode) {
      vscode.postMessage({ type: "ready" });
    }
  });

  // Chrome state
  let schemaHandle: FileSystemFileHandle | null = null;
  let dataHandle: FileSystemFileHandle | null = null;
  let schemaText: string | null = null;
  let dataBuffer: Uint8Array | null = null;
  let typeNameOverride: string | null = null;

  let schemaFileName = "No schema loaded";
  let dataFileName = "No data loaded";

  let errorMessage = "";

  // Build viewer init only when both are present
  let current: StructuralEditorInit | null = null;
  $: current =
    schemaText && dataBuffer
      ? {
          schemaText,
          data: dataBuffer,
          typeName: typeNameOverride,
          schemaName: schemaFileName,
          dataName: dataFileName,
        }
      : null;

  async function loadFile(kind: "schema" | "data") {
    try {
      if (vscode) {
        const file = await postRequest<{ name: string; content: number[] }>(
          "pickFile",
          { kind }
        );
        if (kind === "schema") {
          schemaHandle = null;
          schemaFileName = file.name;
          schemaText = new TextDecoder().decode(new Uint8Array(file.content));
        } else {
          dataHandle = null;
          dataFileName = file.name;
          dataBuffer = new Uint8Array(file.content);
        }
      } else {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description:
                kind === "schema" ? "Protobuf Schema" : "Protobuf Data",
              accept: {
                "application/octet-stream":
                  kind === "schema" ? [".proto"] : [".bin"],
              },
            },
          ],
          multiple: false,
        });
        if (kind === "schema") {
          schemaHandle = handle;
          schemaFileName = handle.name;
          const f = await handle.getFile();
          schemaText = await f.text();
        } else {
          dataHandle = handle;
          dataFileName = handle.name;
          const f = await handle.getFile();
          dataBuffer = new Uint8Array(await f.arrayBuffer());

          // Offer to auto-load schema from lintx.binpb config if available
          if (
            confirm(
              "Would you like to search for a configuration file (lintx.binpb) to automatically load the matching schema?"
            )
          ) {
            await tryAutoLoadSchema(handle);
          }
        }
      }
    } catch (err: any) {
      console.error("Error opening file:", err);
      errorMessage = err?.message || String(err);
    }
  }

  async function loadSampleData() {
    try {
      errorMessage = "";
      schemaHandle = null;
      dataHandle = null;
      schemaFileName = "sample.proto";
      dataFileName = "sample.bin";
      let schema: string;
      let buffer: Uint8Array;
      if (vscode) {
        const payload = await postRequest<{ schema: string; data: number[] }>(
          "getSample"
        );
        schema = payload.schema;
        buffer = new Uint8Array(payload.data);
      } else {
        const schemaResponse = await fetch("/sample.proto");
        if (!schemaResponse.ok) throw new Error("Failed to load sample.proto");
        schema = await schemaResponse.text();
        const dataResponse = await fetch("/sample.bin");
        if (!dataResponse.ok) throw new Error("Failed to load sample.bin");
        buffer = new Uint8Array(await dataResponse.arrayBuffer());
      }
      schemaText = schema;
      dataBuffer = buffer;
      typeNameOverride = null;
    } catch (err: any) {
      console.error("Error loading sample data:", err);
      errorMessage = err?.message || String(err);
    }
  }

  async function tryAutoLoadSchema(dataFileHandle: FileSystemFileHandle) {
    try {
      // For web File System Access API, we need to ask user to pick the directory
      // Since we can't get parent directory directly, we'll ask for directory picker
      console.log("Looking for config files for automatic schema loading...");

      // First try to pick a directory that might contain config files
      const dirHandle = await (window as any).showDirectoryPicker({
        id: "lintx-config-dir",
        startIn: "downloads",
      });

      if (!dirHandle) return;

      // Look for lintx config files in the directory
      const lintxFiles: string[] = [];
      for await (const [name, handle] of dirHandle.entries()) {
        if (
          handle.kind === "file" &&
          (name.toLowerCase().endsWith(".lintx") ||
            name.toLowerCase() === "lintx.txt" ||
            name.toLowerCase() === "lintx.binpb")
        ) {
          lintxFiles.push(name);
        }
      }

      // Try binary configs first, then text configs
      const binaryConfigs = lintxFiles.filter(
        (n) =>
          n.toLowerCase().endsWith(".binpb") ||
          n.toLowerCase() === "lintx.binpb" ||
          (n.toLowerCase().includes(".lintx") &&
            !n.toLowerCase().endsWith(".txt"))
      );
      const textConfigs = lintxFiles.filter(
        (n) => n.toLowerCase() === "lintx.txt"
      );

      const candidates = [...binaryConfigs, ...textConfigs];

      for (const configFileName of candidates) {
        const configHandle = await dirHandle.getFileHandle(configFileName);
        const configFile = await configHandle.getFile();
        const configBytes = new Uint8Array(await configFile.arrayBuffer());

        let mappings: LintxFileMapping[] | null = null;

        if (!configFileName.toLowerCase().endsWith(".txt")) {
          // Try binary format first
          mappings = await parseBinaryLintx(configBytes);

          // If binary parsing failed, try text format
          if (!mappings) {
            try {
              const content = new TextDecoder().decode(configBytes);
              const kv = parseKeyValueConfig(content);
              const mapping: LintxFileMapping = {
                data: kv["data"] || kv["file"] || kv["binary"],
                schema: kv["schema"],
                type: kv["type"],
              };
              if (mapping.schema) mappings = [mapping];
            } catch {
              // ignore
            }
          }
        } else {
          // Text format
          const content = new TextDecoder().decode(configBytes);
          const kv = parseKeyValueConfig(content);
          const mapping: LintxFileMapping = {
            data: kv["data"] || kv["file"] || kv["binary"],
            schema: kv["schema"],
            type: kv["type"],
          };
          if (mapping.schema) mappings = [mapping];
        }

        if (mappings && mappings.length > 0) {
          const matchedConfig = findMatchingConfig(
            mappings,
            dataFileHandle.name
          );
          if (matchedConfig?.schema) {
            // Load the schema file
            try {
              const foundSchemaHandle = await dirHandle.getFileHandle(
                matchedConfig.schema
              );
              const schemaFile = await foundSchemaHandle.getFile();
              schemaText = await schemaFile.text();
              schemaHandle = foundSchemaHandle;
              schemaFileName = foundSchemaHandle.name;
              typeNameOverride = matchedConfig.type || null;
              console.log(
                `Auto-loaded schema: ${schemaFileName} with type: ${typeNameOverride || "auto"}`
              );
              break; // Found and loaded schema, stop searching
            } catch (schemaErr) {
              console.warn(
                `Could not load schema file ${matchedConfig.schema}:`,
                schemaErr
              );
            }
          }
        }
      }
    } catch (err) {
      console.warn("Error during auto schema loading:", err);
      // Don't set errorMessage as this is just auto-loading, user can still manually load
    }
  }

  const onSave: SaveCallback = async (bytes, suggestedName) => {
    if (vscode) {
      await postRequest("saveData", {
        name: suggestedName || dataFileName || "data.bin",
        content: Array.from(bytes),
      });
      return;
    }
    if (!dataHandle) {
      errorMessage =
        "Cannot save: no file handle available. Load a data file first.";
      throw new Error(errorMessage);
    }
    const writable = await dataHandle.createWritable();
    await writable.write(new Uint8Array(bytes));
    await writable.close();
  };
</script>

<div class="p-4 sm:p-6 lg:p-8">
  <div class="max-w-4xl mx-auto">
    <header class="text-center mb-8">
      <h1 class="text-4xl font-bold">Structural Editor</h1>
      <p class="text-lg mt-2">
        Load a Protobuf schema (.proto) and a binary data file (.bin) to begin
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          /></svg
        >
        <span>Error: {errorMessage}</span>
      </div>
    {/if}

    <StructuralViewer init={current} {onSave} />
  </div>
</div>
