<script lang="ts">
  import * as protobuf from 'protobufjs';
  import ObjectViewer from './lib/ObjectViewer.svelte';

  let schemaHandle: FileSystemFileHandle | null = null;
  let dataHandle: FileSystemFileHandle | null = null;
  let rootMessageType: protobuf.Type | null = null;

  let schemaFileName = "No schema loaded";
  let dataFileName = "No data loaded";
  
  let decodedDataObject: object | null = null;
  let errorMessage = "";

  async function loadFile(type: 'schema' | 'data') {
    try {
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
    } catch (err) {
      console.error("Error opening file:", err);
      errorMessage = err.message;
    }
  }

  async function parseAndDecode() {
    if (!schemaHandle || !dataHandle) return;

    try {
      errorMessage = "";
      decodedDataObject = null;

      const schemaFile = await schemaHandle.getFile();
      const schema = await schemaFile.text();

      const dataFile = await dataHandle.getFile();
      const dataBuffer = new Uint8Array(await dataFile.arrayBuffer());

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
      errorMessage = "Cannot save: Data, schema, or decoded object is missing.";
      return;
    }

    try {
      const objectToSave = sanitizeDataForSave(decodedDataObject, rootMessageType);

      const errMsg = rootMessageType.verify(objectToSave);
      if (errMsg) {
        throw new Error(`Verification failed: ${errMsg}`);
      }

      const message = rootMessageType.fromObject(objectToSave);
      const buffer = rootMessageType.encode(message).finish();

      const writable = await dataHandle.createWritable();
      await writable.write(buffer);
      await writable.close();

      alert("Save successful!");

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

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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

    {#if errorMessage}
      <div role="alert" class="alert alert-error mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Error: {errorMessage}</span>
      </div>
    {/if}

    {#if decodedDataObject && rootMessageType}
      <div class="mb-4">
        <button class="btn btn-success w-full" on:click={saveData}>Save Changes</button>
      </div>
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <ObjectViewer object={decodedDataObject} type={rootMessageType} />
        </div>
      </div>
    {/if}
  </div>
</div>