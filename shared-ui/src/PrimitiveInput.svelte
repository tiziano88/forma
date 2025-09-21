<script lang="ts">
  import { FieldType } from '@lintx/core';
  import type { MutationDispatcher, FieldValue } from './mutations';

  interface Props {
    value: string | number | boolean;
    type: string;
    id: string | number;
    onchange?: (value: any) => void;
    dispatcher?: MutationDispatcher;
  }

  const {
    value,
    type,
    id,
    onchange,
    dispatcher
  }: Props = $props();

  // Use local state that starts with the prop value but is independent
  let localValue = $state(value || '');

  // Initialize local value when component mounts
  $effect(() => {
    if (value !== undefined && value !== null && localValue !== value) {
      localValue = value;
    }
  });

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    localValue = target.value;

    // Convert to appropriate type for mutation dispatch
    let mutationValue: FieldValue = localValue;
    if (numericTypes.has(type)) {
      const numValue = parseFloat(target.value);
      mutationValue = isNaN(numValue) ? 0 : numValue;
    }

    // Dispatch mutation if we have dispatcher
    if (dispatcher) {
      dispatcher.setSelf(mutationValue);
    }

    // Immediately call onchange with the converted value
    onchange?.(mutationValue);
  }

  function handleChange() {
    // Convert to appropriate type for mutation dispatch
    let mutationValue: FieldValue = localValue;
    if (numericTypes.has(type)) {
      const numValue = parseFloat(localValue.toString());
      mutationValue = isNaN(numValue) ? 0 : numValue;
    }

    // Dispatch mutation if we have dispatcher
    if (dispatcher) {
      dispatcher.setSelf(mutationValue);
    }

    onchange?.(mutationValue);
  }

  function handleCheckboxChange(event: Event) {
    const target = event.target as HTMLInputElement;
    localValue = target.checked;

    // Dispatch mutation if we have dispatcher
    if (dispatcher) {
      dispatcher.setSelf(localValue as FieldValue);
    }

    // Immediately call onchange with the new value
    onchange?.(localValue);
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
    <input type="checkbox" class="toggle toggle-sm toggle-primary" checked={localValue} id={id.toString()} onchange={handleCheckboxChange} />
    <span class="font-medium text-editor-primary">{localValue ? 'True' : 'False'}</span>
  </label>
{:else if numericTypes.has(type)}
  <input
    type="number"
    class="input-editor"
    value={localValue}
    id={id.toString()}
    oninput={handleInput}
  />
{:else}
  <input
    type="text"
    class="input-editor"
    value={localValue}
    id={id.toString()}
    oninput={handleInput}
    autocomplete="off"
  />
{/if}
