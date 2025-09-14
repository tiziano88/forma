<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MessageValue, FieldDef } from '@lintx/core';
  import { FieldType } from '@lintx/core';
  import ObjectViewer from './ObjectViewer.svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';

  export let parent: MessageValue;
  export let fieldSchema: FieldDef;
  export let editor: any; // StructuralEditor instance

  const dispatch = createEventDispatcher();
  const valueType = fieldSchema.typeName; // For message types

  $: items = parent.getRepeatedField(fieldSchema.number);

  function createDefaultObject() {
    if (valueType && editor) {
      return editor.createEmptyMessage(valueType);
    }
    return null;
  }

  function addToArray() {
    let newItem;
    if (valueType) {
      newItem = createDefaultObject();
    } else {
      switch (fieldSchema.type) {
        case FieldType.TYPE_STRING:
          newItem = ''; break;
        case FieldType.TYPE_BYTES:
          newItem = new Uint8Array(); break;
        case FieldType.TYPE_BOOL:
          newItem = false; break;
        case FieldType.TYPE_DOUBLE:
        case FieldType.TYPE_FLOAT:
        case FieldType.TYPE_INT64:
        case FieldType.TYPE_UINT64:
        case FieldType.TYPE_INT32:
        case FieldType.TYPE_FIXED64:
        case FieldType.TYPE_FIXED32:
        case FieldType.TYPE_UINT32:
        case FieldType.TYPE_SFIXED32:
        case FieldType.TYPE_SFIXED64:
        case FieldType.TYPE_SINT32:
        case FieldType.TYPE_SINT64:
          newItem = 0; break;
        default: newItem = 0; break;
      }
    }
    const currentItems = parent.getRepeatedField(fieldSchema.number);
    parent.addRepeatedField(fieldSchema.number, newItem);
    dispatch('change');
  }

  function removeItem(index: number) {
    const currentItems = parent.getRepeatedField(fieldSchema.number);
    const newItems = currentItems.filter((_, i) => i !== index);
    parent.clearField(fieldSchema.number);
    newItems.forEach(item => parent.addRepeatedField(fieldSchema.number, item));
    dispatch('change');
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const currentItems = parent.getRepeatedField(fieldSchema.number);
    const newArray = [...currentItems];
    [newArray[index], newArray[newIndex]] = [newArray[newIndex], newArray[index]];
    parent.clearField(fieldSchema.number);
    newArray.forEach(item => parent.addRepeatedField(fieldSchema.number, item));
    dispatch('change');
  }

  function handleChange() {
    dispatch('change');
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
          <ObjectViewer bind:object={items[i]} messageSchema={items[i].type} editor={editor} on:change={handleChange} />
        {:else}
          <PrimitiveInput bind:value={items[i]} type={fieldSchema.type} id={`${fieldSchema.name}-${i}`} on:change={handleChange} />
        {/if}
      </div>
    {/each}
  {/if}
  <button class="btn btn-xs btn-outline btn-accent" on:click={addToArray}>+ Add</button>
</div>
