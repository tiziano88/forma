<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as protobuf from 'protobufjs';
  import ObjectViewer from './ObjectViewer.svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';
  import RepeatedFieldViewer from './RepeatedFieldViewer.svelte';

  export let parent: any;
  export let key: string | number;
  export let type: protobuf.Type | undefined;

  const dispatch = createEventDispatcher();

  $: value = parent[key];
  $: field = type && type.fields ? type.fields[key.toString()] : undefined;
  $: valueType = (field?.resolvedType) as protobuf.Type | undefined;
  
  // For static types without field metadata, make educated guesses
  $: isArray = Array.isArray(value);
  $: isObjectValue = value !== null && typeof value === 'object' && !Array.isArray(value);

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

  function handleChange() {
    dispatch('change');
  }
</script>

<div class="rounded-lg border-2 border-primary/20 overflow-hidden">
  <div class="bg-base-300 px-3 py-1">
    <label class="label-text font-bold text-primary" for={key.toString()}>{key}</label>
    {#if field}
      <span class="text-xs opacity-70 ml-2">
        (type: {field.type}, repeated: {!!field.repeated}, resolved: {field.resolvedType?.name || 'none'})
      </span>
    {:else}
      <span class="text-xs opacity-70 ml-2">(no field metadata)</span>
    {/if}
  </div>
  <div class="p-2 bg-base-100">
    {#if field?.repeated}
      <RepeatedFieldViewer bind:items={parent[key]} {field} on:change={handleChange} />
    {:else if valueType && isObject(value)}
      <ObjectViewer bind:object={value} type={valueType} on:change={handleChange} />
    {:else if valueType && value === undefined}
      <button class="btn btn-xs btn-outline btn-accent" on:click={addOptionalField}>+ Add {key}</button>
    {:else if field?.resolvedType instanceof protobuf.Enum}
      <select class="select select-sm select-bordered w-full" bind:value={parent[key]} id={key.toString()} on:change={handleChange}>
        {#each Object.keys(field.resolvedType.values) as enumName}
          <option value={enumName}>{enumName}</option>
        {/each}
      </select>
    {:else if field}
      <PrimitiveInput bind:value={parent[key]} type={field.type} id={key.toString()} on:change={handleChange} />
    {:else if isArray}
      <!-- Handle arrays without field metadata (for static types) -->
      <div class="space-y-2">
        {#each value as item, i}
          <div class="card bg-base-200 shadow-sm">
            <div class="card-body p-3">
              <div class="flex justify-between items-center mb-2">
                <span class="font-medium">{key}[{i}]</span>
                <button class="btn btn-xs btn-error" on:click={() => { value.splice(i, 1); value = value; handleChange(); }}>Remove</button>
              </div>
              {#if isObject(item)}
                <ObjectViewer bind:object={item} type={undefined} on:change={handleChange} />
              {:else}
                <input class="input input-sm input-bordered w-full" bind:value={item} on:input={handleChange} />
              {/if}
            </div>
          </div>
        {/each}
        <button class="btn btn-xs btn-outline btn-primary" on:click={() => { value.push({}); value = value; handleChange(); }}>+ Add Item</button>
      </div>
    {:else if isObjectValue}
      <!-- Handle objects without field metadata (for static types) -->
      <ObjectViewer bind:object={value} type={undefined} on:change={handleChange} />
    {:else if value !== undefined}
      <!-- Handle primitive values without field metadata -->
      <input class="input input-sm input-bordered w-full" bind:value={parent[key]} on:input={handleChange} />
    {:else}
      <!-- No value and no field metadata -->
      <div class="text-gray-500 italic">No data</div>
    {/if}
  </div>
</div>
