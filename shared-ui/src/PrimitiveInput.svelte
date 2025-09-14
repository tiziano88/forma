<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value: string | number | boolean;
  export let type: string; // The protobuf field type (e.g., 'string', 'int32', 'bool')
  export let id: string | number;

  const dispatch = createEventDispatcher();

  function handleChange() {
    dispatch('change', value);
  }

  const numericTypes = new Set(['TYPE_DOUBLE', 'TYPE_FLOAT', 'TYPE_INT32', 'TYPE_UINT32', 'TYPE_SINT32', 'TYPE_FIXED32', 'TYPE_SFIXED32', 'TYPE_INT64', 'TYPE_UINT64', 'TYPE_SINT64', 'TYPE_FIXED64', 'TYPE_SFIXED64']);
</script>

{#if type === 'TYPE_BOOL'}
  <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" bind:checked={value} id={id.toString()} on:change={handleChange} />
{:else if numericTypes.has(type)}
  <input type="number" class="input input-sm input-bordered w-full" bind:value={value} id={id.toString()} on:input={handleChange} />
{:else}
  <input type="text" class="input input-sm input-bordered w-full" bind:value={value} id={id.toString()} on:input={handleChange} />
{/if}