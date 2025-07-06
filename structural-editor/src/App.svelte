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

  /**
   * Recursively sanitizes data to match schema types before saving.
   * - Converts enum strings to numbers.
   * - Coerces non-numeric values in number fields to numbers.
   */
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
        result[key] = Number(value) || 0; // Coerce to number, default to 0 if NaN
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

<main>
  <header>
    <h1>Structural Editor</h1>
    <p>Load a Protobuf schema (.proto) and a binary data file (.bin) to begin editing.</p>
  </header>

  <div class="file-loader">
    <div class="file-info">
      <button on:click={() => loadFile('schema')}>Load Schema (.proto)</button>
      <span>{schemaFileName}</span>
    </div>
    <div class="file-info">
      <button on:click={() => loadFile('data')}>Load Data (.bin)</button>
      <span>{dataFileName}</span>
    </div>
  </div>

  {#if errorMessage}
    <div class="error">
      <p>Error: {errorMessage}</p>
    </div>
  {/if}

  {#if decodedDataObject && rootMessageType}
    <div class="editor-controls">
      <button on:click={saveData}>Save Changes</button>
    </div>
    <div class="data-viewer">
      <ObjectViewer object={decodedDataObject} type={rootMessageType} />
    </div>
  {/if}

</main>

<style>
  :root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    color-scheme: light dark;
  }

  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .file-loader {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  button {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #ccc;
    cursor: pointer;
  }

  .error {
    color: #ff3e00;
    background-color: #ff3e0020;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .editor-controls {
    margin-bottom: 1rem;
  }

  .data-viewer {
    margin-top: 1rem;
    border: 1px solid #ccc;
    padding: 1rem;
    border-radius: 0.5rem;
  }
</style>
