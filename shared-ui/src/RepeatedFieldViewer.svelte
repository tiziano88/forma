<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { MessageValue, FieldDef, StructuralEditor } from "@lintx/core";
  import { FieldType } from "@lintx/core";
  import ValueItem from "./ValueItem.svelte";
  import ObjectViewer from "./ObjectViewer.svelte";
  import PrimitiveInput from "./PrimitiveInput.svelte";
  import BytesViewer from "./BytesViewer.svelte";

  export let parent: MessageValue;
  export let fieldSchema: FieldDef;
  export let editor: StructuralEditor; // Now properly typed and non-null

  const dispatch = createEventDispatcher();
  const valueType = fieldSchema.typeName; // For message types

  // Runtime assertion to catch missing editor parameter early
  if (!editor) {
    throw new Error(`RepeatedFieldViewer: editor parameter is required but was ${editor}. This indicates the component hierarchy is not passing the editor instance correctly.`);
  }

  $: items = parent.getRepeatedField(fieldSchema.number);

  // Unified add/remove logic with clear comments
  $: isUnset = !items || !Array.isArray(items) || items.length === 0;
  $: showAddButton = true; // Repeated fields always show add button

  function createDefaultObject() {
    if (!valueType) {
      throw new Error(`RepeatedFieldViewer: Cannot create message - valueType is missing for field ${fieldSchema.name}`);
    }

    if (!editor) {
      throw new Error(`RepeatedFieldViewer: Cannot create message - editor parameter is null/undefined. Field: ${fieldSchema.name}, Type: ${valueType}`);
    }

    const message = editor.createEmptyMessage(valueType);
    if (message === null) {
      console.error(`Failed to create empty message for type: ${valueType}`);
      console.log("Available types:", editor.getAvailableTypes());
      throw new Error(`RepeatedFieldViewer: Failed to create empty message for type ${valueType}. Check if the type is registered in the schema.`);
    }
    return message;
  }

  function addToArray() {
    let newItem;
    if (valueType) {
      // createDefaultObject() now throws errors instead of returning null
      newItem = createDefaultObject();
    } else {
      switch (fieldSchema.type) {
        case FieldType.TYPE_STRING:
          newItem = "";
          break;
        case FieldType.TYPE_BYTES:
          newItem = new Uint8Array();
          break;
        case FieldType.TYPE_BOOL:
          newItem = false;
          break;
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
          newItem = 0;
          break;
        default:
          newItem = 0;
          break;
      }
    }
    const currentItems = parent.getRepeatedField(fieldSchema.number);
    parent.addRepeatedField(fieldSchema.number, newItem);
    dispatch("change");
  }

  function removeItem(index: number) {
    const currentItems = parent.getRepeatedField(fieldSchema.number);
    const newItems = currentItems.filter((_, i) => i !== index);
    parent.clearField(fieldSchema.number);
    newItems.forEach((item) =>
      parent.addRepeatedField(fieldSchema.number, item)
    );
    dispatch("change");
  }

  function handleRemoveItem(event: CustomEvent) {
    const { index } = event.detail;
    removeItem(index);
  }

  function handleMoveUp(event: CustomEvent) {
    const { index } = event.detail;
    moveItem(index, "up");
  }

  function handleMoveDown(event: CustomEvent) {
    const { index } = event.detail;
    moveItem(index, "down");
  }

  function moveItem(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const currentItems = parent.getRepeatedField(fieldSchema.number);
    const newArray = [...currentItems];
    [newArray[index], newArray[newIndex]] = [
      newArray[newIndex],
      newArray[index],
    ];
    parent.clearField(fieldSchema.number);
    newArray.forEach((item) =>
      parent.addRepeatedField(fieldSchema.number, item)
    );
    dispatch("change");
  }

  function handleChange() {
    dispatch("change");
  }
</script>

<div class="space-y-3">
  {#if items && Array.isArray(items) && items.length > 0}
    {#each items as item, i}
      <ValueItem
        index={i}
        isRepeated={true}
        canMoveUp={i > 0}
        canMoveDown={i < items.length - 1}
        showBorder={i > 0}
        on:remove={handleRemoveItem}
        on:moveUp={handleMoveUp}
        on:moveDown={handleMoveDown}
      >
        {#if valueType}
          <ObjectViewer
            bind:object={items[i]}
            messageSchema={items[i].type}
            {editor}
            on:change={handleChange}
          />
        {:else if fieldSchema.type === FieldType.TYPE_BYTES}
          <BytesViewer
            sources={[{ id: `${fieldSchema.name}-${i}`, label: 'Value', bytes: items[i] instanceof Uint8Array ? items[i] : new Uint8Array() }]}
            emptyMessage="(empty)"
          />
        {:else}
          <PrimitiveInput
            bind:value={items[i]}
            type={fieldSchema.type}
            id={`${fieldSchema.name}-${i}`}
            on:change={handleChange}
          />
        {/if}
      </ValueItem>
    {/each}
  {:else}
    <div class="text-sm text-base-content/70 italic text-center py-2">
      No items
    </div>
  {/if}

  <!-- Add button always shown for repeated fields -->
  <button
    class="btn btn-sm btn-outline btn-accent w-full"
    on:click={addToArray}
  >
    + Add {fieldSchema.name}
  </button>
</div>
