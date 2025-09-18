<script lang="ts">
  import type { MessageValue, FieldDef } from "@lintx/core";
  import { FieldType } from "@lintx/core";

  export let fieldSchema: FieldDef;
  export let isRepeated: boolean = false;
  export let depth: number = 0;
  export let arrayIndex: number | null = null; // For repeated fields
  export let isPlaceholder: boolean = false; // For "add next" cards
  export let showAddButton: boolean = false;
  export let showRemoveButton: boolean = false;
  export let showMoveUp: boolean = false;
  export let showMoveDown: boolean = false;
  export let hasContent: boolean = true; // Whether to show content area

  // Callback props instead of event dispatcher
  export let onchange: (() => void) | undefined = undefined;
  export let onadd: (() => void) | undefined = undefined;
  export let onremove: (() => void) | undefined = undefined;
  export let onmoveup: (() => void) | undefined = undefined;
  export let onmovedown: (() => void) | undefined = undefined;
  const headerHeight = 40;
  $: top = depth * headerHeight;

  // Map wire format types to friendly names
  const typeNameMap: Record<number, string> = {
    [FieldType.TYPE_DOUBLE]: "double",
    [FieldType.TYPE_FLOAT]: "float",
    [FieldType.TYPE_INT64]: "int64",
    [FieldType.TYPE_UINT64]: "uint64",
    [FieldType.TYPE_INT32]: "int32",
    [FieldType.TYPE_FIXED64]: "fixed64",
    [FieldType.TYPE_FIXED32]: "fixed32",
    [FieldType.TYPE_BOOL]: "bool",
    [FieldType.TYPE_STRING]: "string",
    [FieldType.TYPE_GROUP]: "group",
    [FieldType.TYPE_MESSAGE]: "message",
    [FieldType.TYPE_BYTES]: "bytes",
    [FieldType.TYPE_UINT32]: "uint32",
    [FieldType.TYPE_ENUM]: "enum",
    [FieldType.TYPE_SFIXED32]: "sfixed32",
    [FieldType.TYPE_SFIXED64]: "sfixed64",
    [FieldType.TYPE_SINT32]: "sint32",
    [FieldType.TYPE_SINT64]: "sint64",
  };

  $: displayType =
    fieldSchema.typeName ||
    typeNameMap[fieldSchema.type] ||
    `type_${fieldSchema.type}`;

  function handleChange() {
    onchange?.();
  }

  function handleAdd() {
    onadd?.();
  }

  function handleRemove() {
    onremove?.();
  }

  function handleMoveUp() {
    onmoveup?.();
  }

  function handleMoveDown() {
    onmovedown?.();
  }
</script>

<div class="field-card group" class:field-card-placeholder={isPlaceholder || !hasContent}>
  <div
    class="field-card-header field-card-header--sticky"
    class:rounded-xl={!hasContent}
    style="top: {top}px; z-index: {20 - depth};"
  >
    <div class="field-card-header-content">
      <span class="field-card-name">{fieldSchema.name}</span>
      {#if arrayIndex !== null}
        <span class="field-card-index">[{arrayIndex}]</span>
      {:else if isPlaceholder}
        <span class="field-card-index">[*]</span>
      {/if}
      <span class="field-card-number">#{fieldSchema.number}</span>
      <span class="field-card-type-pill">
        {#if isRepeated && arrayIndex === null}repeated {/if}{displayType}
      </span>

      <!-- Control buttons -->
      <div class="field-card-controls">
        {#if showMoveUp}
          <button
            class="btn-move-up"
            title="Move up"
            on:click={handleMoveUp}
          >↑</button>
        {/if}
        {#if showMoveDown}
          <button
            class="btn-move-down"
            title="Move down"
            on:click={handleMoveDown}
          >↓</button>
        {/if}
        {#if showAddButton}
          <button
            class="btn-add"
            title={isPlaceholder ? "Add first item" : "Add item"}
            on:click={handleAdd}
          >+</button>
        {/if}
        {#if showRemoveButton}
          <button
            class="btn-remove"
            title="Remove"
            on:click={handleRemove}
          >×</button>
        {/if}
      </div>
    </div>
  </div>

  {#if hasContent}
    <div class="px-2.5 py-2.5">
      <slot {handleChange} />
    </div>
  {/if}
</div>
