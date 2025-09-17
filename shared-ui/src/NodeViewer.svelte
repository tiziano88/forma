<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MessageValue, FieldDef, EnumType, StructuralEditor } from '@lintx/core';
  import { FieldLabel, FieldType } from '@lintx/core';
  import FieldCard from './FieldCard.svelte';
  import ValueItem from './ValueItem.svelte';
  import ObjectViewer from './ObjectViewer.svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';
  import RepeatedFieldViewer from './RepeatedFieldViewer.svelte';

  export let parent: MessageValue;
  export let fieldSchema: FieldDef;
  export let editor: StructuralEditor; // Now properly typed and non-null

  const dispatch = createEventDispatcher();
  let value: any;
  let enumType: EnumType | null = null;

  // A set of well-known or custom types that require special UI handling.
  const SPECIAL_CASED_TYPES = new Set([
    '.google.protobuf.Timestamp',
  ]);

  $: isRepeated = fieldSchema.label === FieldLabel.LABEL_REPEATED;
  $: {
    if (isRepeated) {
      value = parent.getRepeatedField(fieldSchema.number);
    } else {
      value = parent.getField(fieldSchema.number);
    }
  }
  $: isSpecialCased = fieldSchema.typeName && SPECIAL_CASED_TYPES.has(fieldSchema.typeName);

  // Unified add/remove logic with clear comments
  $: isUnset = value === null || value === undefined ||
               (Array.isArray(value) && value.length === 0);
  $: showAddButton = isRepeated || isUnset; // Repeated fields always show add, singular only when unset
  $: showRemoveButton = !isUnset; // Show remove when there's something to remove

  // Get enum type information if this field is an enum
  $: {
    if (fieldSchema.type === FieldType.TYPE_ENUM && fieldSchema.typeName && editor) {
      const enumRegistry = editor.getEnumRegistry();
      enumType = enumRegistry.get(fieldSchema.typeName) || null;
    } else {
      enumType = null;
    }
  }

  function dispatchChange() {
    dispatch('change');
  }

  function handleEnumChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newValue = parseInt(target.value, 10);
    parent.setField(fieldSchema.number, newValue);
    dispatchChange();
  }

  function createMessageValue() {
    if (!fieldSchema.typeName || !editor) {
      console.error('Cannot create message: missing typeName or editor');
      return;
    }

    const newMessage = editor.createEmptyMessage(fieldSchema.typeName);
    if (newMessage === null) {
      console.error(`Failed to create empty message for type: ${fieldSchema.typeName}`);
      console.log('Available types:', editor.getAvailableTypes());
      return;
    }

    parent.setField(fieldSchema.number, newMessage);
    dispatchChange();
  }

  function clearMessageValue() {
    parent.clearField(fieldSchema.number);
    dispatchChange();
  }

  function handleRemoveValue() {
    if (isRepeated) {
      // For repeated fields, this shouldn't be called (RepeatedFieldViewer handles it)
      console.warn('handleRemoveValue called on repeated field');
    } else {
      // For singular fields, clear the field
      parent.clearField(fieldSchema.number);
      dispatchChange();
    }
  }
</script>

<FieldCard {fieldSchema} {parent} {editor} {isRepeated} on:change={dispatchChange}>
  <svelte:fragment slot="default" let:handleChange>
    {#if isSpecialCased}
      <!-- Special cased types (like Timestamps) -->
      <div class="flex items-center gap-2 p-2 bg-base-200 rounded-md">
        <span class="text-xl">⏰</span>
        <span class="text-sm italic opacity-70">Timestamp (not yet editable)</span>
      </div>
    {:else if fieldSchema.type === FieldType.TYPE_ENUM}
      {#if isRepeated}
        <RepeatedFieldViewer
          bind:parent={parent}
          fieldSchema={fieldSchema}
          editor={editor}
          on:change={handleChange}
        />
      {:else}
        <!-- Singular enum field -->
        {#if !isUnset}
          <ValueItem
            isRepeated={false}
            on:remove={handleRemoveValue}
          >
            {#if enumType}
              <div class="form-control">
                <select
                  class="select select-sm select-bordered w-full"
                  value={value ?? 0}
                  on:change={handleEnumChange}
                >
                  {#each Array.from(enumType.values.entries()) as [number, name]}
                    <option value={number}>
                      {name} ({number})
                    </option>
                  {/each}
                </select>
                <div class="text-xs opacity-70 mt-1">
                  Current: {enumType.values.get(value) || 'UNKNOWN'} = {value}
                </div>
              </div>
            {:else}
              <div class="flex items-center gap-2 p-2 bg-base-200 rounded-md">
                <span class="text-xl">🔢</span>
                <span class="text-sm">Enum value: {value ?? 'unset'}</span>
                <span class="text-xs opacity-70">({fieldSchema.typeName})</span>
              </div>
            {/if}
          </ValueItem>
        {/if}

        {#if showAddButton}
          <button
            class="btn btn-sm btn-outline btn-accent"
            on:click={() => {
              // Set default enum value (0)
              parent.setField(fieldSchema.number, 0);
              handleChange();
            }}
          >
            + Add {fieldSchema.name}
          </button>
        {/if}
      {/if}
    {:else if fieldSchema.typeName && fieldSchema.typeName.startsWith('.')}
      {#if isRepeated}
        <RepeatedFieldViewer
          bind:parent={parent}
          fieldSchema={fieldSchema}
          editor={editor}
          on:change={handleChange}
        />
      {:else}
        <!-- Singular message field -->
        {#if !isUnset && value && value.type}
          <ValueItem
            isRepeated={false}
            on:remove={handleRemoveValue}
          >
            <ObjectViewer
              bind:object={value}
              messageSchema={value.type}
              editor={editor}
              on:change={handleChange}
            />
          </ValueItem>
        {/if}

        {#if showAddButton}
          <button
            class="btn btn-sm btn-outline btn-accent"
            on:click={() => {
              if (!fieldSchema.typeName || !editor) {
                console.error('Cannot create message: missing typeName or editor');
                return;
              }

              const newMessage = editor.createEmptyMessage(fieldSchema.typeName);
              if (newMessage === null) {
                console.error(`Failed to create empty message for type: ${fieldSchema.typeName}`);
                console.log('Available types:', editor.getAvailableTypes());
                return;
              }

              parent.setField(fieldSchema.number, newMessage);
              handleChange();
            }}
            title="Create new {fieldSchema.typeName} message"
          >
            + Add {fieldSchema.name}
          </button>
        {/if}
      {/if}
    {:else}
      {#if isRepeated}
        <RepeatedFieldViewer
          bind:parent={parent}
          fieldSchema={fieldSchema}
          editor={editor}
          on:change={handleChange}
        />
      {:else}
        <!-- Singular primitive field -->
        {#if !isUnset}
          <ValueItem
            isRepeated={false}
            on:remove={handleRemoveValue}
          >
            <PrimitiveInput
              bind:value={value}
              type={fieldSchema.type}
              id={fieldSchema.name}
              on:change={(e) => { parent.setField(fieldSchema.number, e.detail); handleChange(); }}
            />
          </ValueItem>
        {/if}

        {#if showAddButton}
          <button
            class="btn btn-sm btn-outline btn-accent"
            on:click={() => {
              // Set default value based on type
              let defaultValue;
              switch (fieldSchema.type) {
                case FieldType.TYPE_STRING:
                  defaultValue = '';
                  break;
                case FieldType.TYPE_BOOL:
                  defaultValue = false;
                  break;
                default:
                  defaultValue = 0;
                  break;
              }
              parent.setField(fieldSchema.number, defaultValue);
              handleChange();
            }}
          >
            + Add {fieldSchema.name}
          </button>
        {/if}
      {/if}
    {/if}
  </svelte:fragment>
</FieldCard>
