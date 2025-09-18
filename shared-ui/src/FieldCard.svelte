<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { MessageValue, FieldDef } from "@lintx/core";
  import { FieldType } from "@lintx/core";

  export let fieldSchema: FieldDef;
  export let isRepeated: boolean = false;
  export let depth: number = 0;

  const dispatch = createEventDispatcher();
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
    dispatch("change");
  }
</script>

<div class="field-card group">
  <div
    class="field-card-header field-card-header--sticky"
    style="top: {top}px; z-index: {20 - depth};"
  >
    <div class="field-card-header-content">
      <span class="field-card-name">{fieldSchema.name}</span>
      <span class="field-card-number">#{fieldSchema.number}</span>
      {#if isRepeated}
        <span class="field-card-type-pill"> repeated </span>
      {/if}
      <span class="field-card-type-pill">
        {displayType}
      </span>
    </div>
  </div>

  <div class="px-2.5 py-2.5">
    <slot {handleChange} />
  </div>
</div>
