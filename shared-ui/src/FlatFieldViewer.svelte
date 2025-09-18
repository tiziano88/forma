<script lang="ts">
  import type { MessageValue, FieldDef, EnumType, StructuralEditor } from '@lintx/core';
  import { FieldLabel, FieldType } from '@lintx/core';
  import FieldCard from './FieldCard.svelte';
  import ObjectViewer from './ObjectViewer.svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';
  import BytesViewer from './BytesViewer.svelte';

  export let parent: MessageValue;
  export let fieldSchema: FieldDef;
  export let editor: StructuralEditor;
  export let depth: number = 0;
  export let onchange: (() => void) | undefined = undefined;
  let enumType: EnumType | null = null;

  // A set of well-known or custom types that require special UI handling.
  const SPECIAL_CASED_TYPES = new Set([
    '.google.protobuf.Timestamp',
  ]);

  $: isRepeated = fieldSchema.label === FieldLabel.LABEL_REPEATED;
  $: value = isRepeated ? parent.getRepeatedField(fieldSchema.number) : parent.getField(fieldSchema.number);
  $: items = isRepeated ? (value || []) : [];
  $: isUnset = value === null || value === undefined || (isRepeated && items.length === 0);
  $: isSpecialCased = fieldSchema.typeName && SPECIAL_CASED_TYPES.has(fieldSchema.typeName);

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
    if (defaultValue === null) return;

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
    dispatchChange();
  }

  function handlePrimitiveChange(event: CustomEvent, index: number | null = null) {
    const newValue = event.detail;

    if (isRepeated && index !== null) {
      const currentItems = parent.getRepeatedField(fieldSchema.number) || [];
      const newItems = [...currentItems];
      newItems[index] = newValue;
      parent.clearField(fieldSchema.number);
      newItems.forEach((item) => parent.addRepeatedField(fieldSchema.number, item));
    } else {
      parent.setField(fieldSchema.number, newValue);
    }
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
              on:change={(e) => handleEnumChange(e, index)}
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
            bind:object={item}
            messageSchema={item.type}
            {editor}
            depth={depth + 1}
            onchange={dispatchChange}
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
          bind:value={item}
          type={fieldSchema.type}
          id="{fieldSchema.name}-{index}"
          onchange={(newValue) => handlePrimitiveChange({ detail: newValue }, index)}
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
              on:change={handleEnumChange}
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
            bind:object={value}
            messageSchema={value.type}
            {editor}
            depth={depth + 1}
            onchange={dispatchChange}
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
          bind:value={value}
          type={fieldSchema.type}
          id={fieldSchema.name}
          onchange={(newValue) => handlePrimitiveChange({ detail: newValue })}
        />
      {/if}
    {/if}
  </FieldCard>
{/if}