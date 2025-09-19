<script lang="ts">
  import type { MessageValue, FieldDef, EnumType, StructuralEditor } from '@lintx/core';
  import { FieldLabel, FieldType } from '@lintx/core';
  import FieldCard from './FieldCard.svelte';
  import ObjectViewer from './ObjectViewer.svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';
  import BytesViewer from './BytesViewer.svelte';

  interface Props {
    parent: MessageValue;
    fieldSchema: FieldDef;
    editor: StructuralEditor;
    depth?: number;
    onchange?: () => void;
  }

  const {
    parent,
    fieldSchema,
    editor,
    depth = 0,
    onchange
  }: Props = $props();
  let enumType = $state<EnumType | null>(null);

  // A set of well-known or custom types that require special UI handling.
  const SPECIAL_CASED_TYPES = new Set([
    '.google.protobuf.Timestamp',
  ]);

  const isRepeated = $derived(fieldSchema.label === FieldLabel.LABEL_REPEATED);

  // Use reactive state instead of derived values for better control
  let value = $state<any>(null);
  let items = $state<any[]>([]);
  let isUnset = $state(true);
  const isSpecialCased = $derived(fieldSchema.typeName && SPECIAL_CASED_TYPES.has(fieldSchema.typeName));

  // Function to update all reactive state
  function updateReactiveState() {
    const newValue = isRepeated ? parent.getRepeatedField(fieldSchema.number) : parent.getField(fieldSchema.number);
    const newItems = isRepeated ? (newValue || []) : [];
    const newIsUnset = newValue === null || newValue === undefined || (isRepeated && newItems.length === 0);

    value = newValue;
    items = newItems;
    isUnset = newIsUnset;
  }

  // Initialize state when component mounts
  $effect(() => {
    updateReactiveState();
  });

  // Get enum type information if this field is an enum
  $effect(() => {
    if (fieldSchema.type === FieldType.TYPE_ENUM && fieldSchema.typeName && editor) {
      const enumRegistry = editor.getEnumRegistry();
      enumType = enumRegistry.get(fieldSchema.typeName) || null;
    } else {
      enumType = null;
    }
  });

  function dispatchChange() {
    onchange?.();
  }

  function createDefaultValue() {
    if (fieldSchema.typeName && fieldSchema.typeName.startsWith('.')) {
      // Message type
      const newMessage = editor.createEmptyMessage(fieldSchema.typeName);
      if (newMessage === null) {
        console.error(`Failed to create empty message for type: ${fieldSchema.typeName}`);
        return null;
      }
      return newMessage;
    } else {
      // Primitive type
      switch (fieldSchema.type) {
        case FieldType.TYPE_STRING:
          return '';
        case FieldType.TYPE_BYTES:
          return new Uint8Array();
        case FieldType.TYPE_BOOL:
          return false;
        case FieldType.TYPE_ENUM:
          return 0;
        default:
          return 0;
      }
    }
  }

  function handleAdd(index: number | null = null) {
    const defaultValue = createDefaultValue();
    if (defaultValue === null) {
      return;
    }

    if (isRepeated) {
      if (index === null) {
        // Add to end
        parent.addRepeatedField(fieldSchema.number, defaultValue);
      } else {
        // Insert after index
        const currentItems = parent.getRepeatedField(fieldSchema.number) || [];
        const newItems = [...currentItems];
        newItems.splice(index + 1, 0, defaultValue);
        parent.clearField(fieldSchema.number);
        newItems.forEach((item) => parent.addRepeatedField(fieldSchema.number, item));
      }
    } else {
      parent.setField(fieldSchema.number, defaultValue);
    }

    // Update reactive state
    updateReactiveState();
    dispatchChange();
  }

  function handleRemove(index: number | null = null) {
    if (isRepeated && index !== null) {
      const currentItems = parent.getRepeatedField(fieldSchema.number) || [];
      const newItems = currentItems.filter((_, i) => i !== index);
      parent.clearField(fieldSchema.number);
      newItems.forEach((item) => parent.addRepeatedField(fieldSchema.number, item));
    } else if (!isRepeated) {
      parent.clearField(fieldSchema.number);
    }

    // Update reactive state
    updateReactiveState();

    dispatchChange();
  }

  function handleMove(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const currentItems = parent.getRepeatedField(fieldSchema.number) || [];
    if (newIndex < 0 || newIndex >= currentItems.length) return;

    const newArray = [...currentItems];
    [newArray[index], newArray[newIndex]] = [newArray[newIndex], newArray[index]];

    parent.clearField(fieldSchema.number);
    newArray.forEach((item) => parent.addRepeatedField(fieldSchema.number, item));

    // Update reactive state
    updateReactiveState();

    dispatchChange();
  }

  function handleEnumChange(event: Event, index: number | null = null) {
    const target = event.target as HTMLSelectElement;
    const newValue = parseInt(target.value, 10);

    if (isRepeated && index !== null) {
      const currentItems = parent.getRepeatedField(fieldSchema.number) || [];
      const newItems = [...currentItems];
      newItems[index] = newValue;
      parent.clearField(fieldSchema.number);
      newItems.forEach((item) => parent.addRepeatedField(fieldSchema.number, item));
    } else {
      parent.setField(fieldSchema.number, newValue);
    }

    // Update reactive state
    updateReactiveState();

    dispatchChange();
  }

  function handlePrimitiveChange(eventOrValue: any, index: number | null = null) {
    // Handle both CustomEvent format and direct value
    const newValue = eventOrValue?.detail !== undefined ? eventOrValue.detail : eventOrValue;

    if (isRepeated && index !== null) {
      const currentItems = parent.getRepeatedField(fieldSchema.number) || [];
      const newItems = [...currentItems];
      newItems[index] = newValue;
      parent.clearField(fieldSchema.number);
      newItems.forEach((item) => parent.addRepeatedField(fieldSchema.number, item));
    } else {
      parent.setField(fieldSchema.number, newValue);
    }

    // Update only the specific state we need, don't call full updateReactiveState
    // which might interfere with input values in progress
    const fieldValue = parent.getField(fieldSchema.number);
    const newIsUnset = fieldValue === null || fieldValue === undefined;
    isUnset = newIsUnset;
    value = fieldValue;

    dispatchChange();
  }

  function handleObjectChange(index: number | null = null) {
    // For nested objects, we just need to trigger change notification
    // The object itself is already modified by reference
    dispatchChange();
  }

  function ensureUint8Array(value: any): Uint8Array {
    return value instanceof Uint8Array ? value : new Uint8Array();
  }
</script>

{#if isRepeated}
  <!-- Repeated field: render one card per item + placeholder -->
  {#each items as item, index}
    <FieldCard
      {fieldSchema}
      {depth}
      isRepeated={true}
      arrayIndex={index}
      showAddButton={true}
      showRemoveButton={true}
      showMoveUp={index > 0}
      showMoveDown={index < items.length - 1}
      onadd={() => handleAdd(index)}
      onremove={() => handleRemove(index)}
      onmoveup={() => handleMove(index, 'up')}
      onmovedown={() => handleMove(index, 'down')}
      onchange={dispatchChange}
    >
      {#if isSpecialCased}
        <!-- Special cased types (like Timestamps) -->
        <div class="timestamp-display">
          <span class="text-xl">⏰</span>
          <span class="text-sm italic text-editor-muted">Timestamp (not yet editable)</span>
        </div>
      {:else if fieldSchema.type === FieldType.TYPE_ENUM}
        {#if enumType}
          <div class="form-control">
            <select
              class="select-editor"
              value={item ?? 0}
              onchange={(e) => handleEnumChange(e, index)}
            >
              {#each Array.from(enumType.values.entries()) as [number, name]}
                <option value={number}>
                  {name} ({number})
                </option>
              {/each}
            </select>
            <div class="text-xs text-editor-muted mt-1">
              Current: {enumType.values.get(item) || 'UNKNOWN'} = {item}
            </div>
          </div>
        {:else}
          <div class="enum-display">
            <span class="text-xl">🔢</span>
            <span class="text-sm text-editor-primary">Enum value: {item ?? 'unset'}</span>
            <span class="text-xs text-editor-muted">({fieldSchema.typeName})</span>
          </div>
        {/if}
      {:else if fieldSchema.typeName && fieldSchema.typeName.startsWith('.')}
        <!-- Message field -->
        {#if item && item.type}
          <ObjectViewer
            object={item}
            messageSchema={item.type}
            {editor}
            depth={depth}
            onchange={() => handleObjectChange(index)}
          />
        {/if}
      {:else if fieldSchema.type === FieldType.TYPE_BYTES}
        <!-- Bytes field -->
        <BytesViewer
          sources={[{ id: `${fieldSchema.name}-${index}`, label: 'Value', bytes: ensureUint8Array(item) }]}
          emptyMessage="(empty)"
        />
      {:else}
        <!-- Primitive field -->
        <PrimitiveInput
          value={item}
          type={fieldSchema.type}
          id="{fieldSchema.name}-{index}"
          onchange={(newValue) => handlePrimitiveChange(newValue, index)}
        />
      {/if}
    </FieldCard>
  {/each}

  <!-- Placeholder card for adding items -->
  <FieldCard
    {fieldSchema}
    {depth}
    isRepeated={true}
    isPlaceholder={true}
    hasContent={false}
    showAddButton={true}
    onadd={() => handleAdd()}
    onchange={dispatchChange}
  />
{:else}
  <!-- Singular field -->
  <FieldCard
    {fieldSchema}
    {depth}
    isRepeated={false}
    hasContent={!isUnset}
    showAddButton={isUnset}
    showRemoveButton={!isUnset}
    onadd={() => handleAdd()}
    onremove={() => handleRemove()}
    onchange={dispatchChange}
  >
    {#if !isUnset}
      {#if isSpecialCased}
        <!-- Special cased types (like Timestamps) -->
        <div class="timestamp-display">
          <span class="text-xl">⏰</span>
          <span class="text-sm italic text-editor-muted">Timestamp (not yet editable)</span>
        </div>
      {:else if fieldSchema.type === FieldType.TYPE_ENUM}
        {#if enumType}
          <div class="form-control">
            <select
              class="select-editor"
              value={value ?? 0}
              onchange={handleEnumChange}
            >
              {#each Array.from(enumType.values.entries()) as [number, name]}
                <option value={number}>
                  {name} ({number})
                </option>
              {/each}
            </select>
            <div class="text-xs text-editor-muted mt-1">
              Current: {enumType.values.get(value) || 'UNKNOWN'} = {value}
            </div>
          </div>
        {:else}
          <div class="enum-display">
            <span class="text-xl">🔢</span>
            <span class="text-sm text-editor-primary">Enum value: {value ?? 'unset'}</span>
            <span class="text-xs text-editor-muted">({fieldSchema.typeName})</span>
          </div>
        {/if}
      {:else if fieldSchema.typeName && fieldSchema.typeName.startsWith('.')}
        <!-- Message field -->
        {#if value && value.type}
          <ObjectViewer
            object={value}
            messageSchema={value.type}
            {editor}
            depth={depth}
            onchange={() => handleObjectChange()}
          />
        {/if}
      {:else if fieldSchema.type === FieldType.TYPE_BYTES}
        <!-- Bytes field -->
        <BytesViewer
          sources={[{ id: fieldSchema.name, label: 'Value', bytes: ensureUint8Array(value) }]}
          emptyMessage="(empty)"
        />
      {:else}
        <!-- Primitive field -->
        <PrimitiveInput
          value={value}
          type={fieldSchema.type}
          id={fieldSchema.name}
          onchange={(newValue) => handlePrimitiveChange(newValue)}
        />
      {/if}
    {/if}
  </FieldCard>
{/if}