<script lang="ts">
  import * as protobuf from 'protobufjs';
  import ObjectViewer from './lib/ObjectViewer.svelte';
  
  // VS Code webview bridge
  type VSCodeAPI = { postMessage: (msg: any) => void, getState: () => any, setState: (s: any) => void } | null;
  // @ts-ignore acquireVsCodeApi is injected by VS Code webviews
  const acquire = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi : null;
  const vscode: VSCodeAPI = acquire ? acquire() : null;
  let reqId = 0;
  const pending = new Map<number, (data: any) => void>();
  if (typeof window !== 'undefined') {
    window.addEventListener('message', (event: MessageEvent) => {
      const msg = event.data || {};
      if (msg && typeof msg === 'object' && 'requestId' in msg) {
        const resolver = pending.get(msg.requestId);
        if (resolver) {
          pending.delete(msg.requestId);
          resolver(msg);
        }
      }
    });
  }
  function postRequest<T = any>(type: string, payload?: any): Promise<T> {
    if (!vscode) return Promise.reject(new Error('Not running inside VS Code'));
    const id = ++reqId;
    vscode.postMessage({ type, requestId: id, payload });
    return new Promise<T>((resolve) => pending.set(id, (msg) => resolve(msg.payload as T)));
  }

  let schemaHandle: FileSystemFileHandle | null = null;
  let dataHandle: FileSystemFileHandle | null = null;
  let rootMessageType: protobuf.Type | null = null;

  let schemaFileName = "No schema loaded";
  let dataFileName = "No data loaded";
  
  let decodedDataObject: object | null = null;
  let errorMessage = "";

  async function loadFile(type: 'schema' | 'data') {
    try {
      if (vscode) {
        const file = await postRequest<{ name: string; content: number[] }>('pickFile', { kind: type });
        if (type === 'schema') {
          schemaHandle = null;
          schemaFileName = file.name;
          // Store schema content in memory
          (window as any).__schemaContent = new TextDecoder().decode(new Uint8Array(file.content));
        } else {
          dataHandle = null;
          dataFileName = file.name;
          (window as any).__dataContent = new Uint8Array(file.content);
        }
        if ((window as any).__schemaContent && (window as any).__dataContent) {
          await parseAndDecode();
        }
      } else {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: type === 'schema' ? 'Protobuf Schema' : 'Protobuf Data',
              accept: {
                'application/octet-stream': type === 'schema' ? ['.proto'] : ['.bin'],
              },
            },
          ],
          multiple: false,
        });
  
        if (type === 'schema') {
          schemaHandle = handle;
          schemaFileName = schemaHandle.name;
        } else {
          dataHandle = handle;
          dataFileName = dataHandle.name;
        }
  
        if (schemaHandle && dataHandle) {
          await parseAndDecode();
        }
      }
    } catch (err) {
      console.error("Error opening file:", err);
      errorMessage = err.message;
    }
  }

  
  async function loadSampleData() {
    try {
      errorMessage = "";
      decodedDataObject = null;
      schemaHandle = null;
      dataHandle = null;
      schemaFileName = "sample.proto";
      dataFileName = "sample.bin";
      let schema: string;
      let dataBuffer: Uint8Array;

      if (vscode) {
        const payload = await postRequest<{ schema: string; data: number[] }>('getSample');
        schema = payload.schema;
        dataBuffer = new Uint8Array(payload.data);
        (window as any).__schemaContent = schema;
        (window as any).__dataContent = dataBuffer;
      } else {
        const schemaResponse = await fetch('/sample.proto');
        if (!schemaResponse.ok) throw new Error('Failed to load sample.proto');
        schema = await schemaResponse.text();
  
        const dataResponse = await fetch('/sample.bin');
        if (!dataResponse.ok) throw new Error('Failed to load sample.bin');
        dataBuffer = new Uint8Array(await dataResponse.arrayBuffer());
      }

      const { root } = protobuf.parse(schema);
      
      function findAllMessageTypes(ns: protobuf.Namespace | protobuf.Root): protobuf.Type[] {
        let types: protobuf.Type[] = [];
        for (const obj of ns.nestedArray) {
          if (obj instanceof protobuf.Type) {
            types.push(obj);
          } else if (obj instanceof protobuf.Namespace) {
            types = types.concat(findAllMessageTypes(obj));
          }
        }
        return types;
      }

      const messageTypes = findAllMessageTypes(root);

      if (messageTypes.length === 0) {
        throw new Error("No message types found in the schema.");
      }

      rootMessageType = messageTypes[messageTypes.length - 1];
      const message = rootMessageType.decode(dataBuffer);
      decodedDataObject = message.toJSON({ enums: String, defaults: true });

    } catch (err) {
      console.error("Error loading sample data:", err);
      errorMessage = err.message;
    }
  }

  async function parseAndDecode() {
    const hasHandles = !!(schemaHandle && dataHandle);
    const hasVSData = !!(vscode && (window as any).__schemaContent && (window as any).__dataContent);
    if (!hasHandles && !hasVSData) return;


    try {
      errorMessage = "";
      decodedDataObject = null;

      let schema: string;
      let dataBuffer: Uint8Array;
      if (vscode) {
        schema = (window as any).__schemaContent as string;
        dataBuffer = (window as any).__dataContent as Uint8Array;
      } else {
        const schemaFile = await schemaHandle.getFile();
        schema = await schemaFile.text();
  
        const dataFile = await dataHandle.getFile();
        dataBuffer = new Uint8Array(await dataFile.arrayBuffer());
      }

      const { root } = protobuf.parse(schema);
      
      function findAllMessageTypes(ns: protobuf.Namespace | protobuf.Root): protobuf.Type[] {
        let types: protobuf.Type[] = [];
        for (const obj of ns.nestedArray) {
          if (obj instanceof protobuf.Type) {
            types.push(obj);
          } else if (obj instanceof protobuf.Namespace) {
            types = types.concat(findAllMessageTypes(obj));
          }
        }
        return types;
      }

      const messageTypes = findAllMessageTypes(root);

      if (messageTypes.length === 0) {
        throw new Error("No message types found in the schema.");
      }

      rootMessageType = messageTypes[messageTypes.length - 1];
      const message = rootMessageType.decode(dataBuffer);
      decodedDataObject = message.toJSON({ enums: String, defaults: true });

    } catch (err) {
      console.error("Error processing files:", err);
      errorMessage = err.message;
    }
  }

  const numericTypes = new Set(['double', 'float', 'int32', 'uint32', 'sint32', 'fixed32', 'sfixed32', 'int64', 'uint64', 'sint64', 'fixed64', 'sfixed64']);

  function sanitizeDataForSave(data: any, type: protobuf.Type): any {
    if (!data || !type) return data;

    const result: { [k: string]: any } = {};

    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;

      const value = data[key];
      const field = type.fields[key];

      if (!field) {
        result[key] = value;
        continue;
      }
      
      if (field.repeated && field.resolvedType instanceof protobuf.Type && Array.isArray(value)) {
        result[key] = value.map(item => sanitizeDataForSave(item, field.resolvedType as protobuf.Type));
      } 
      else if (field.resolvedType instanceof protobuf.Type && isObject(value)) {
        result[key] = sanitizeDataForSave(value, field.resolvedType as protobuf.Type);
      }
      else if (field.resolvedType instanceof protobuf.Enum && typeof value === 'string') {
        result[key] = field.resolvedType.values[value];
      }
      else if (numericTypes.has(field.type) && typeof value !== 'number') {
        result[key] = Number(value) || 0;
      }
      else {
        result[key] = value;
      }
    }
    return result;
  }

  function isObject(value: any) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  async function saveData() {
    if (!dataHandle || !rootMessageType || !decodedDataObject) {
      if (!vscode) {
        errorMessage = "Cannot save: Data, schema, or decoded object is missing.";
        return;
      }
    }

    try {
      const objectToSave = sanitizeDataForSave(decodedDataObject, rootMessageType);

      const errMsg = rootMessageType.verify(objectToSave);
      if (errMsg) {
        throw new Error(`Verification failed: ${errMsg}`);
      }

      const message = rootMessageType.fromObject(objectToSave);
      const buffer = rootMessageType.encode(message).finish();
      if (vscode) {
        await postRequest('saveData', { name: dataFileName, content: Array.from(buffer) });
        alert("Save successful!");
      } else {
        const writable = await dataHandle.createWritable();
        await writable.write(buffer);
        await writable.close();
        alert("Save successful!");
      }

    } catch (err) {
      console.error("Error saving file:", err);
      errorMessage = err.message;
    }
  }
</script>

<div class="p-4 sm:p-6 lg:p-8">
  <div class="max-w-4xl mx-auto">
    <header class="text-center mb-8">
      <h1 class="text-4xl font-bold">Structural Editor</h1>
      <p class="text-lg mt-2">Load a Protobuf schema (.proto) and a binary data file (.bin) to begin editing.</p>
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
          <button class="btn btn-secondary" on:click={() => loadFile('data')}>Load Data (.bin)</button>
          <span class="text-sm mt-2">{dataFileName}</span>
        </div>
      </div>
    </div>

    <div class="mb-8">
        <button class="btn btn-accent w-full" on:click={loadSampleData}>Load Sample Data</button>
    </div>
    

    {#if errorMessage}
      <div role="alert" class="alert alert-error mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Error: {errorMessage}</span>
      </div>
    {/if}

    {#if decodedDataObject && rootMessageType}
      <div class="mb-4">
        <button class="btn btn-success w-full" on:click={saveData} disabled={!dataHandle && !vscode}>Save Changes</button>
      </div>
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <ObjectViewer object={decodedDataObject} type={rootMessageType} />
        </div>
      </div>
    {/if}
  </div>
</div>
