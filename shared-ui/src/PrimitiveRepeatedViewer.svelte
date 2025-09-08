<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';

  export let items: (string | number | boolean)[];
  export let fieldType: string;

  const dispatch = createEventDispatcher();

  function handleChange() {
    dispatch('change', items);
  }

  function addToArray() {
    let newItem: string | number | boolean;
    switch (fieldType) {
      case 'string': newItem = ''; break;
      case 'bool': newItem = false; break;
      default: newItem = 0; break;
    }
    items = [...(items || []), newItem];
    dispatch('change', items);
  }

  function removeItem(index: number) {
    items = items.filter((_, i) => i !== index);
    dispatch('change', items);
  }
</script>

<div class="space-y-2">
  {#if items && Array.isArray(items)}
    {#each items as item, i}
      <div class="bg-base-200 p-2 rounded-md relative group border border-base-300">
        <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="btn btn-xs btn-ghost text-error/70 hover:text-error" title="Remove Item" aria-label="Remove Item" on:click={() => removeItem(i)}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <PrimitiveInput bind:value={items[i]} type={fieldType} id={`${i}`} on:change={handleChange} />
      </div>
    {/each}
  {/if}
  <button class="btn btn-xs btn-outline btn-accent" on:click={addToArray}>+ Add</button>
</div>
