<script lang="ts">
  import { FieldType } from '@lintx/core';

  export let value: string | number | boolean;
  export let type: string; // The protobuf field type (e.g., 'string', 'int32', 'bool')
  export let id: string | number;
  export let onchange: ((value: any) => void) | undefined = undefined;

  function handleChange() {
    onchange?.(value);
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
  <label class="label-editor">
    <input type="checkbox" class="toggle toggle-sm toggle-primary" bind:checked={value} id={id.toString()} on:change={handleChange} />
    <span class="font-medium text-editor-primary">{value ? 'True' : 'False'}</span>
  </label>
{:else if numericTypes.has(type)}
  <input
    type="number"
    class="input-editor"
    bind:value={value}
    id={id.toString()}
    on:input={handleChange}
  />
{:else}
  <input
    type="text"
    class="input-editor"
    bind:value={value}
    id={id.toString()}
    on:input={handleChange}
  />
{/if}
