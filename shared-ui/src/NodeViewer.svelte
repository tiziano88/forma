<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as protobuf from 'protobufjs';
  import ObjectViewer from './ObjectViewer.svelte';

  export let parent: any;
  export let key: string | number;
  export let type: protobuf.Type | undefined; // This is the protobuf.Type for the PARENT object

  const dispatch = createEventDispatcher();

  $: value = parent[key];

  // Based on the parent's type, find the definition for the CURRENT value
  $: field = type ? type.fields[key.toString()] : undefined;
  $: valueType = (field?.resolvedType) as protobuf.Type | undefined;

  const numericTypes = new Set(['double', 'float', 'int32', 'uint32', 'sint32', 'fixed32', 'sfixed32', 'int64', 'uint64', 'sint64', 'fixed64', 'sfixed64']);

  function isObject(val: any) {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  function createDefaultObject(messageType: protobuf.Type) {
    return (messageType as any).toObject({}, { defaults: true, enums: String });
  }

  function addOptionalField() {
    if (!valueType) return;
    parent[key] = createDefaultObject(valueType);
    dispatch('change');
  }

  function addToArray() {
    if (!field) return;

    let newItem;
    if (field.resolvedType instanceof protobuf.Type) {
      newItem = createDefaultObject(field.resolvedType);
    } else {
      switch (field.type) {
        case 'string': newItem = ''; break;
        case 'bool': newItem = false; break;
        default: newItem = 0; break;
      }
    }
    parent[key] = [...(value || []), newItem];
    dispatch('change');
  }

  function removeItem(index: number) {
    if (!value || !Array.isArray(value)) return;
    parent[key] = value.filter((_, i) => i !== index);
    dispatch('change');
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    if (!value || !Array.isArray(value)) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= value.length) return;

    const newArray = [...value];
    const temp = newArray[index];
    newArray[index] = newArray[newIndex];
    newArray[newIndex] = temp;
    
    parent[key] = newArray;
    dispatch('change');
  }

  function handleChange() {
    dispatch('change');
  }
</script>

<div class="form-control">
  <label class="label py-1 cursor-pointer" for={key.toString()}>
    <span class="label-text font-semibold">{key}</span>
  </label>

  {#if field?.repeated}
    <div class="pl-3 border-l-2 border-base-300 space-y-2">
      {#if value && Array.isArray(value)}
        {#each value as item, i}
          <div class="bg-base-200/50 p-2 rounded-md">
            <div class="flex justify-between items-center mb-1">
              <span class="font-mono text-xs opacity-60">Item {i}</span>
              <div class="btn-group">
                <button class="btn btn-xs btn-ghost" title="Move Up" on:click={() => moveItem(i, 'up')} disabled={i === 0}>↑</button>
                <button class="btn btn-xs btn-ghost" title="Move Down" on:click={() => moveItem(i, 'down')} disabled={i === value.length - 1}>↓</button>
                <button class="btn btn-xs btn-ghost text-error" title="Remove Item" on:click={() => removeItem(i)}>✕</button>
              </div>
            </div>
            <ObjectViewer bind:object={item} type={valueType} on:change={handleChange} />
          </div>
        {/each}
      {/if}
      <button class="btn btn-xs btn-outline" on:click={addToArray}>+ Add Item</button>
    </div>
  {:else if valueType && isObject(value)}
    <div class="pl-3 border-l-2 border-base-300">
      <ObjectViewer bind:object={value} type={valueType} on:change={handleChange} />
    </div>
  {:else if valueType && value === undefined}
    <button class="btn btn-xs btn-outline" on:click={addOptionalField}>+ Add {key}</button>
  {:else if field?.resolvedType instanceof protobuf.Enum}
    <select class="select select-sm select-bordered w-full" bind:value={parent[key]} id={key.toString()} on:change={handleChange}>
      {#each Object.keys(field.resolvedType.values) as enumName}
        <option value={enumName}>{enumName}</option>
      {/each}
    </select>
  {:else if typeof value === 'boolean'}
    <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" bind:checked={parent[key]} id={key.toString()} on:change={handleChange} />
  {:else if typeof value === 'number'}
    <input type="number" class="input input-sm input-bordered w-full" bind:value={parent[key]} id={key.toString()} on:input={handleChange} />
  {:else}
    <input type="text" class="input input-sm input-bordered w-full" bind:value={parent[key]} id={key.toString()} on:input={handleChange} />
  {/if}
</div>