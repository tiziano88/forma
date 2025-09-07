<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value: string | number | boolean;
  export let type: string; // The protobuf field type (e.g., 'string', 'int32', 'bool')
  export let id: string | number;

  const dispatch = createEventDispatcher();

  function handleChange() {
    dispatch('change', value);
  }

  const numericTypes = new Set(['double', 'float', 'int32', 'uint32', 'sint32', 'fixed32', 'sfixed32', 'int64', 'uint64', 'sint64', 'fixed64', 'sfixed64']);
</script>

{#if type === 'bool'}
  <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" bind:checked={value} id={id.toString()} on:change={handleChange} />
{:else if numericTypes.has(type)}
  <input type="number" class="input input-sm input-bordered w-full" bind:value={value} id={id.toString()} on:input={handleChange} />
{:else}
  <input type="text" class="input input-sm input-bordered w-full" bind:value={value} id={id.toString()} on:input={handleChange} />
{/if}