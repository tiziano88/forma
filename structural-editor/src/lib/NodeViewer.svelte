<script lang="ts">
  import * as protobuf from 'protobufjs';
  import ObjectViewer from './ObjectViewer.svelte';

  export let parent: any;
  export let key: string | number;
  export let type: protobuf.Type; // This is the protobuf.Type for the PARENT object

  $: value = parent[key];

  // Based on the parent's type, find the definition for the CURRENT value
  $: field = type.fields[key.toString()];
  $: valueType = (field?.resolvedType) as protobuf.Type | undefined;

  function isObject(val: any) {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  function createDefaultObject(messageType: protobuf.Type) {
    return messageType.toObject({}, { defaults: true, enums: String });
  }

  function addOptionalField() {
    if (!valueType) return;
    parent[key] = createDefaultObject(valueType);
  }

  function addToArray() {
    if (!valueType) return;
    const newItem = createDefaultObject(valueType);
    parent[key] = [...(value || []), newItem];
  }
</script>

<div class="node">
  <span class="name">{key}:</span>

  {#if field?.repeated}
    <!-- Repeated field (array) -->
    <div class="node-children array">
      {#if value && Array.isArray(value)}
        {#each value as item, i}
          <div class="array-item">
            <span class="array-index">{i}:</span>
            <ObjectViewer object={item} type={valueType} />
          </div>
        {/each}
      {/if}
      <button class="add-button" on:click={addToArray}>+ Add Item</button>
    </div>
  {:else if valueType && isObject(value)}
    <!-- Single message object -->
    <div class="node-children object">
      <ObjectViewer object={value} type={valueType} />
    </div>
  {:else if valueType && value === undefined}
    <!-- An optional message that is not present in the data -->
    <div class="add-field">
      <span class="field-name">{key} (optional)</span>
      <button class="add-button" on:click={addOptionalField}>+ Add</button>
    </div>
  {:else if typeof value === 'boolean'}
    <input type="checkbox" bind:checked={parent[key]} />
  {:else if typeof value === 'number'}
    <input type="number" bind:value={parent[key]} />
  {:else}
    <input type="text" bind:value={parent[key]} />
  {/if}
</div>

<style>
  .node {
    padding-left: 1.5rem;
    border-left: 1px solid #ccc;
    margin-top: 0.5rem;
  }
  .name {
    font-weight: bold;
    margin-right: 0.5rem;
  }
  .node-children {
    display: flex;
    flex-direction: column;
  }
  .array-item {
    border: 1px solid #eee;
    padding: 0.5rem;
    margin-top: 0.5rem;
    border-radius: 0.25rem;
  }
  .array-index {
    font-weight: bold;
    color: #666;
  }
  input {
    padding: 0.25rem;
    border-radius: 0.25rem;
    border: 1px solid #aaa;
    background-color: inherit;
    color: inherit;
    font-family: inherit;
    margin-top: 0.25rem;
  }
  .add-field {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .field-name {
    color: #888;
    font-style: italic;
  }
  .add-button {
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #888;
    cursor: pointer;
    font-size: 0.8rem;
    margin-top: 0.5rem;
    align-self: flex-start;
  }
</style>
