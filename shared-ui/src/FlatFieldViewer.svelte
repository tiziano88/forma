<script lang="ts">
  import type {
    MessageValue,
    FieldDef,
    StructuralEditor,
    InterpretedValue,
    FieldPath,
    Comment,
  } from "@lintx/core";
  import { FieldLabel, FieldType } from "@lintx/core";
  import FieldCard from "./FieldCard.svelte";
  import ObjectViewer from "./ObjectViewer.svelte";
  import PrimitiveInput from "./PrimitiveInput.svelte";
  import BytesViewer from "./BytesViewer.svelte";
  import type { MutationEvent, MutationDispatcher } from "./mutations";

  interface Props {
    parent: MessageValue;
    fieldSchema: FieldDef;
    editor: StructuralEditor;
    depth?: number;
    parentPath?: FieldPath;
    onchange?: () => void;
    onmutation?: (event: MutationEvent) => void;
    dispatcher?: MutationDispatcher;
    mutationVersion?: number;
  }

  const {
    parent,
    fieldSchema,
    editor,
    depth = 0,
    parentPath,
    onchange,
    onmutation,
    dispatcher,
    mutationVersion = 0,
  }: Props = $props();
  let enumValues = $state<Map<number, string> | null>(null);

  // A set of well-known or custom types that require special UI handling.
  const SPECIAL_CASED_TYPES = new Set([".google.protobuf.Timestamp"]);

  // Build the field path for this field
  function buildFieldPath(arrayIndex?: number): FieldPath {
    const segments = parentPath?.segments || [];
    return {
      segments: [
        ...segments,
        {
          fieldNumber: fieldSchema.number,
          arrayIndex: arrayIndex ?? 0,
        },
      ],
    };
  }

  // Get comments for a specific path
  function getCommentsForPath(arrayIndex?: number): Comment[] {
    const path = buildFieldPath(arrayIndex);
    return editor.getComments(path);
  }

  function handleAddComment(text: string, arrayIndex?: number) {
    const path = buildFieldPath(arrayIndex);
    console.log('[FlatFieldViewer] Adding comment:', text, 'to path:', path);
    const comment = editor.addComment(path, text);
    console.log('[FlatFieldViewer] Comment added:', comment);
    dispatchChange();
  }

  const isRepeated = $derived(fieldSchema.label === FieldLabel.LABEL_REPEATED);

  const currentValue = $derived.by(() => {
    const version = mutationVersion; // Depend on mutationVersion for reactivity
    const fieldData = parent.fields.get(fieldSchema.number);
    if (isRepeated) {
      return fieldData || null;
    } else {
      return fieldData && fieldData.length > 0 ? fieldData[0] : null;
    }
  });

  const currentItems = $derived.by(() => {
    if (isRepeated) {
      return parent.fields.get(fieldSchema.number) || [];
    } else {
      return [];
    }
  });

  const fieldIsUnset = $derived.by(() => {
    const version = mutationVersion; // Depend on mutationVersion for reactivity
    const fieldData = parent.fields.get(fieldSchema.number);
    return isRepeated
      ? (!fieldData || fieldData.length === 0)
      : (!fieldData || fieldData.length === 0);
  });

  const isSpecialCased = $derived(
    fieldSchema.typeName && SPECIAL_CASED_TYPES.has(fieldSchema.typeName)
  );

  // Get enum values from the abstract schema
  $effect(() => {
    if (
      fieldSchema.type === FieldType.TYPE_ENUM &&
      fieldSchema.typeName &&
      editor
    ) {
      enumValues = editor.getEnumValues(fieldSchema.typeName);
    } else {
      enumValues = null;
    }
  });

  function dispatchChange() {
    onchange?.();
  }

  function createDefaultValue() {
    if (fieldSchema.typeName && fieldSchema.typeName.startsWith(".")) {
      // Message type
      const newMessage = editor.createEmptyMessage(fieldSchema.typeName);
      if (newMessage === null) {
        console.error(
          `Failed to create empty message for type: ${fieldSchema.typeName}`
        );
        return null;
      }
      return newMessage;
    } else {
      // Primitive type
      switch (fieldSchema.type) {
        case FieldType.TYPE_STRING:
          return "";
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

    // Dispatch mutation (mutation-only system)
    if (dispatcher) {
      if (isRepeated) {
        const insertIndex = index !== null ? index + 1 : undefined;
        dispatcher.addRepeatedField(
          fieldSchema.number,
          defaultValue,
          insertIndex
        );
      } else {
        dispatcher.setField(fieldSchema.number, defaultValue);
      }
    }

    dispatchChange();
  }

  function handleRemove(index: number | null = null) {
    // Dispatch mutation (mutation-only system)
    if (dispatcher) {
      if (isRepeated && index !== null) {
        dispatcher.removeRepeatedField(fieldSchema.number, index);
      } else if (!isRepeated) {
        dispatcher.clearField(fieldSchema.number);
      }
    }

    dispatchChange();
  }

  function handleMove(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    const currentItems = parent.getRepeatedField(fieldSchema.number) || [];
    if (newIndex < 0 || newIndex >= currentItems.length) return;

    // Dispatch mutation (mutation-only system)
    if (dispatcher) {
      dispatcher.moveRepeatedField(fieldSchema.number, index, newIndex);
    }

    dispatchChange();
  }

  function handleEnumChange(event: Event, index: number | null = null) {
    const target = event.target as HTMLSelectElement;
    const newValue = parseInt(target.value, 10);

    // Dispatch mutation (mutation-only system)
    if (dispatcher) {
      if (isRepeated && index !== null) {
        dispatcher.setField(fieldSchema.number, newValue, index);
      } else {
        dispatcher.setField(fieldSchema.number, newValue);
      }
    }

    dispatchChange();
  }

  function handlePrimitiveChange(
    eventOrValue: Event | string | number | boolean,
    index: number | null = null
  ) {
    // Handle both CustomEvent format and direct value
    const newValue =
      (eventOrValue as CustomEvent)?.detail !== undefined
        ? (eventOrValue as CustomEvent).detail
        : eventOrValue;

    // Note: PrimitiveInput already dispatches mutations directly,
    // but we keep this for any other primitive change sources
    if (dispatcher) {
      if (isRepeated && index !== null) {
        dispatcher.setField(fieldSchema.number, newValue as string | number | boolean, index);
      } else {
        dispatcher.setField(fieldSchema.number, newValue as string | number | boolean);
      }
    }

    dispatchChange();
  }

  function handleObjectChange(index: number | null = null) {
    // For nested objects, we just need to trigger change notification
    // The object itself is already modified by reference
    dispatchChange();
  }

  function handleBytesChange(newBytes: Uint8Array, index: number | null = null) {
    if (dispatcher) {
      if (isRepeated && index !== null) {
        dispatcher.setField(fieldSchema.number, newBytes, index);
      } else {
        dispatcher.setField(fieldSchema.number, newBytes);
      }
    }
    dispatchChange();
  }

  function ensureUint8Array(value: unknown): Uint8Array {
    return value instanceof Uint8Array ? value : new Uint8Array();
  }
</script>

{#if isRepeated}
  <!-- Repeated field: render one card per item + placeholder -->
  {#each currentItems as item, index}
    <FieldCard
      {fieldSchema}
      {depth}
      isRepeated={true}
      arrayIndex={index}
      showAddButton={true}
      showRemoveButton={true}
      showMoveUp={index > 0}
      showMoveDown={index < currentItems.length - 1}
      fieldPath={buildFieldPath(index)}
      valueComments={getCommentsForPath(index)}
      onaddcomment={(text) => handleAddComment(text, index)}
      onadd={() => handleAdd(index)}
      onremove={() => handleRemove(index)}
      onmoveup={() => handleMove(index, "up")}
      onmovedown={() => handleMove(index, "down")}
      onchange={dispatchChange}
    >
      {#if isSpecialCased}
        <!-- Special cased types (like Timestamps) -->
        <div class="timestamp-display">
          <span class="text-xl">⏰</span>
          <span class="text-sm italic text-editor-muted"
            >Timestamp (not yet editable)</span
          >
        </div>
      {:else if fieldSchema.type === FieldType.TYPE_ENUM}
        {#if enumValues}
          <div class="form-control">
            <select
              class="select-editor"
              value={item ?? 0}
              onchange={(e) => handleEnumChange(e, index)}
            >
              {#each Array.from(enumValues.entries()) as [number, name]}
                <option value={number}>
                  {name} ({number})
                </option>
              {/each}
            </select>
            <div class="text-xs text-editor-muted mt-1">
              Current: {enumValues.get(item) || "UNKNOWN"} = {item}
            </div>
          </div>
        {:else}
          <div class="enum-display">
            <span class="text-xl">🔢</span>
            <span class="text-sm text-editor-primary"
              >Enum value: {item ?? "unset"}</span
            >
            <span class="text-xs text-editor-muted"
              >({fieldSchema.typeName})</span
            >
          </div>
        {/if}
      {:else if fieldSchema.typeName && fieldSchema.typeName.startsWith(".")}
        <!-- Message field -->
        {#if item && item.type}
          <ObjectViewer
            object={item}
            messageSchema={item?.type}
            {editor}
            depth={depth + 1}
            parentPath={buildFieldPath(index)}
            onchange={() => handleObjectChange(index)}
            {onmutation}
            dispatcher={dispatcher?.createChild(fieldSchema.number, index || 0)}
            mutationVersion={mutationVersion}
          />
        {/if}
      {:else if fieldSchema.type === FieldType.TYPE_BYTES}
        <!-- Bytes field -->
        <BytesViewer
          sources={[
            {
              id: `${fieldSchema.name}-${index}`,
              label: "Value",
              bytes: ensureUint8Array(item),
            },
          ]}
          emptyMessage="(empty)"
          readonly={false}
          onchange={(newBytes) => handleBytesChange(newBytes, index)}
        />
      {:else}
        <!-- Primitive field -->
        <PrimitiveInput
          value={item}
          type={fieldSchema.type}
          id="{fieldSchema.name}-{index}"
          onchange={(newValue) => handlePrimitiveChange(newValue, index)}
          dispatcher={dispatcher?.createChild(fieldSchema.number, index)}
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
    hasContent={!fieldIsUnset}
    showAddButton={fieldIsUnset}
    showRemoveButton={!fieldIsUnset}
    fieldPath={buildFieldPath()}
    valueComments={getCommentsForPath()}
    onaddcomment={(text) => handleAddComment(text)}
    onadd={() => handleAdd()}
    onremove={() => handleRemove()}
    onchange={dispatchChange}
  >
    {#if !fieldIsUnset}
      {#if isSpecialCased}
        <!-- Special cased types (like Timestamps) -->
        <div class="timestamp-display">
          <span class="text-xl">⏰</span>
          <span class="text-sm italic text-editor-muted"
            >Timestamp (not yet editable)</span
          >
        </div>
      {:else if fieldSchema.type === FieldType.TYPE_ENUM}
        {#if enumValues}
          <div class="form-control">
            <select
              class="select-editor"
              value={currentValue ?? 0}
              onchange={handleEnumChange}
            >
              {#each Array.from(enumValues.entries()) as [number, name]}
                <option value={number}>
                  {name} ({number})
                </option>
              {/each}
            </select>
            <div class="text-xs text-editor-muted mt-1">
              Current: {enumValues.get(currentValue) || "UNKNOWN"} = {currentValue}
            </div>
          </div>
        {:else}
          <div class="enum-display">
            <span class="text-xl">🔢</span>
            <span class="text-sm text-editor-primary"
              >Enum value: {currentValue ?? "unset"}</span
            >
            <span class="text-xs text-editor-muted"
              >({fieldSchema.typeName})</span
            >
          </div>
        {/if}
      {:else if fieldSchema.typeName && fieldSchema.typeName.startsWith(".")}
        <!-- Message field -->
        {#if currentValue && currentValue.type}
          <ObjectViewer
            object={currentValue}
            messageSchema={currentValue?.type}
            {editor}
            depth={depth + 1}
            parentPath={buildFieldPath()}
            onchange={() => handleObjectChange()}
            {onmutation}
            dispatcher={dispatcher?.createChild(fieldSchema.number, 0)}
            mutationVersion={mutationVersion}
          />
        {/if}
      {:else if fieldSchema.type === FieldType.TYPE_BYTES}
        <!-- Bytes field -->
        <BytesViewer
          sources={[
            {
              id: fieldSchema.name,
              label: "Value",
              bytes: ensureUint8Array(currentValue),
            },
          ]}
          emptyMessage="(empty)"
          readonly={false}
          onchange={(newBytes) => handleBytesChange(newBytes)}
        />
      {:else}
        <!-- Primitive field -->
        <PrimitiveInput
          value={currentValue}
          type={fieldSchema.type}
          id={fieldSchema.name}
          onchange={(newValue) => handlePrimitiveChange(newValue)}
          dispatcher={dispatcher?.createChild(fieldSchema.number, 0)}
        />
      {/if}
    {/if}
  </FieldCard>
{/if}
