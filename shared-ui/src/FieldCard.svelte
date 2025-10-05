<script lang="ts">
  import type { MessageValue, FieldDef } from "@lintx/core";
  import { FieldType } from "@lintx/core";

  interface Props {
    fieldSchema: FieldDef;
    isRepeated?: boolean;
    depth?: number;
    arrayIndex?: number | null;
    isPlaceholder?: boolean;
    showAddButton?: boolean;
    showRemoveButton?: boolean;
    showMoveUp?: boolean;
    showMoveDown?: boolean;
    hasContent?: boolean;
    onchange?: () => void;
    onadd?: () => void;
    onremove?: () => void;
    onmoveup?: () => void;
    onmovedown?: () => void;
    children?: import('svelte').Snippet<[{ handleChange: () => void }]>;
  }

  const {
    fieldSchema,
    isRepeated = false,
    depth = 0,
    arrayIndex = null,
    isPlaceholder = false,
    showAddButton = false,
    showRemoveButton = false,
    showMoveUp = false,
    showMoveDown = false,
    hasContent = true,
    onchange,
    onadd,
    onremove,
    onmoveup,
    onmovedown,
    children
  }: Props = $props();
  const headerHeight = 40;
  const top = $derived(depth * headerHeight);

  // State for showing/hiding comment
  let showComment = $state(false);

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

  const displayType = $derived(
    fieldSchema.typeName ||
    typeNameMap[fieldSchema.type] ||
    `type_${fieldSchema.type}`);

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

<div
  class="field-card group"
  class:field-card-placeholder={isPlaceholder || !hasContent}
>
  <div
    class="field-card-header field-card-header--sticky"
    class:rounded-xl={!hasContent}
    style="top: {top}px; z-index: {20 - depth};"
  >
    <div class="field-card-header-content">
      <span class="field-card-name" class:line-through={fieldSchema.deprecated}>{fieldSchema.name}</span>
      {#if arrayIndex !== null}
        <span class="field-card-index">[{arrayIndex}]</span>
      {:else if isPlaceholder}
        <span class="field-card-index">[*]</span>
      {/if}
      {#if fieldSchema.comment}
        <button
          class="field-comment-icon"
          title={showComment ? "Hide comment" : "Show comment"}
          onclick={() => showComment = !showComment}
        >
          ⓘ
        </button>
      {/if}
      <span class="field-card-number">#{fieldSchema.number}</span>
      <span class="field-card-type-pill">
        {#if isRepeated && arrayIndex === null}repeated
        {/if}{displayType}
      </span>

      <!-- Control buttons -->
      <div class="field-card-controls">
        {#if showMoveUp}
          <button class="btn-move-up" title="Move up" onclick={handleMoveUp}
            >↑</button
          >
        {/if}
        {#if showMoveDown}
          <button
            class="btn-move-down"
            title="Move down"
            onclick={handleMoveDown}>↓</button
          >
        {/if}
        {#if showAddButton}
          <button
            class="btn-add"
            title={isPlaceholder ? "Add first item" : "Add item"}
            onclick={handleAdd}>+</button
          >
        {/if}
        {#if showRemoveButton}
          <button class="btn-remove" title="Remove" onclick={handleRemove}
            >×</button
          >
        {/if}
      </div>
    </div>
  </div>

  {#if showComment && fieldSchema.comment}
    <div class="field-comment">
      {fieldSchema.comment}
    </div>
  {/if}

  {#if hasContent}
    <div class="px-2.5 py-2.5">
      {@render children?.({ handleChange })}
    </div>
  {/if}
</div>
