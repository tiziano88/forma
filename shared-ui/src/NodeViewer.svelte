<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as protobuf from 'protobufjs';
  import ObjectViewer from './ObjectViewer.svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';

  export let parent: any;
  export let key: string | number;
  export let type: protobuf.Type | undefined;

  const dispatch = createEventDispatcher();

  $: value = parent[key];
  $: field = type ? type.fields[key.toString()] : undefined;
  $: valueType = (field?.resolvedType) as protobuf.Type | undefined;

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
    [newArray[index], newArray[newIndex]] = [newArray[newIndex], newArray[index]];
    parent[key] = newArray;
    dispatch('change');
  }

  function handleChange() {
    dispatch('change');
  }
</script>

<div class="rounded-md border-2 border-base-300/40 overflow-hidden">
  <div class="bg-base-300/40 px-3 py-1">
    <label class="label-text font-bold text-base-content/80" for={key.toString()}>{key}</label>
  </div>
  <div class="p-2 bg-base-100/40">
    {#if field?.repeated}
      <div class="space-y-2">
        {#if value && Array.isArray(value)}
          {#each value as item, i}
            <div class="bg-base-200/50 p-2 rounded-md relative group border border-base-300">
               <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div class="btn-group">
                  <button class="btn btn-xs btn-ghost" title="Move Up" on:click={() => moveItem(i, 'up')} disabled={i === 0}>▲</button>
                  <button class="btn btn-xs btn-ghost" title="Move Down" on:click={() => moveItem(i, 'down')} disabled={i === value.length - 1}>▼</button>
                  <button class="btn btn-xs btn-ghost text-error/70 hover:text-error" title="Remove Item" on:click={() => removeItem(i)}>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <ObjectViewer bind:object={item} type={valueType} on:change={handleChange} />
            </div>
          {/each}
        {/if}
        <button class="btn btn-xs btn-outline btn-accent" on:click={addToArray}>+ Add</button>
      </div>
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
    {/if}
  </div>
</div>