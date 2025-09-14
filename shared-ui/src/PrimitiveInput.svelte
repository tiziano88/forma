<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { FieldType } from '@lintx/core';

  export let value: string | number | boolean;
  export let type: string; // The protobuf field type (e.g., 'string', 'int32', 'bool')
  export let id: string | number;

  const dispatch = createEventDispatcher();

  function handleChange() {
    dispatch('change', value);
  }

  const numericTypes = new Set([
    FieldType.TYPE_DOUBLE,
    FieldType.TYPE_FLOAT,
    FieldType.TYPE_INT64,
    FieldType.TYPE_UINT64,
    FieldType.TYPE_INT32,
    FieldType.TYPE_FIXED64,
    FieldType.TYPE_FIXED32,
    FieldType.TYPE_UINT32,
    FieldType.TYPE_SFIXED32,
    FieldType.TYPE_SFIXED64,
    FieldType.TYPE_SINT32,
    FieldType.TYPE_SINT64
  ]);
</script>

{#if type === FieldType.TYPE_BOOL}
  <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" bind:checked={value} id={id.toString()} on:change={handleChange} />
{:else if numericTypes.has(type)}
  <input type="number" class="input input-sm input-bordered w-full" bind:value={value} id={id.toString()} on:input={handleChange} />
{:else}
  <input type="text" class="input input-sm input-bordered w-full" bind:value={value} id={id.toString()} on:input={handleChange} />
{/if}