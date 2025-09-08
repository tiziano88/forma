<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as protobuf from 'protobufjs';
  import ObjectViewer from './ObjectViewer.svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';

  export let items: any[];
  export let field: protobuf.Field;

  const dispatch = createEventDispatcher();
  const valueType = field.resolvedType as protobuf.Type | undefined;

  function createDefaultObject(messageType: protobuf.Type) {
    return (messageType as any).toObject({}, { defaults: true, enums: String });
  }

  function addToArray() {
    let newItem;
    if (valueType) {
      newItem = createDefaultObject(valueType);
    } else {
      switch (field.type) {
        case 'string': newItem = ''; break;
        case 'bool': newItem = false; break;
        default: newItem = 0; break;
      }
    }
    items = [...(items || []), newItem];
    dispatch('change', items);
  }

  function removeItem(index: number) {
    items = items.filter((_, i) => i !== index);
    dispatch('change', items);
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const newArray = [...items];
    [newArray[index], newArray[newIndex]] = [newArray[newIndex], newArray[index]];
    items = newArray;
    dispatch('change', items);
  }

  function handleChange() {
    dispatch('change', items);
  }
</script>

<div class="space-y-2">
  {#if items && Array.isArray(items)}
    {#each items as item, i}
      <div class="bg-base-200 p-2 rounded-md relative group border border-base-300">
        <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div class="btn-group">
            <button class="btn btn-xs btn-ghost" title="Move Up" on:click={() => moveItem(i, 'up')} disabled={i === 0}>▲</button>
            <button class="btn btn-xs btn-ghost" title="Move Down" on:click={() => moveItem(i, 'down')} disabled={i === items.length - 1}>▼</button>
            <button class="btn btn-xs btn-ghost text-error/70 hover:text-error" title="Remove Item" aria-label="Remove Item" on:click={() => removeItem(i)}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        {#if valueType}
          <ObjectViewer bind:object={items[i]} type={valueType} on:change={handleChange} />
        {:else}
          <PrimitiveInput bind:value={items[i]} type={field.type} id={`${field.name}-${i}`} on:change={handleChange} />
        {/if}
      </div>
    {/each}
  {/if}
  <button class="btn btn-xs btn-outline btn-accent" on:click={addToArray}>+ Add</button>
</div>
