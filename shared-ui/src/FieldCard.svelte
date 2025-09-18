<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { MessageValue, FieldDef } from "@lintx/core";

  export let fieldSchema: FieldDef;
  export let isRepeated: boolean = false;
  export let depth: number = 0;

  const dispatch = createEventDispatcher();
  const headerHeight = 50;
  $: top = depth * headerHeight;

  function handleChange() {
    dispatch("change");
  }
</script>

<div class="field-card group">
  <div
    class="field-card-header field-card-header--sticky"
    style="top: {top}px; z-index: {20 - depth};"
  >
    <div class="space-y-1">
      <div class="field-card-title">
        {fieldSchema.name}
      </div>
      <div class="flex flex-wrap items-center gap-2 field-card-subtitle">
        <span class="badge-editor-type">
          {fieldSchema.typeName || fieldSchema.type}
        </span>
        {#if isRepeated}
          <span class="badge-editor-repeated">Repeated</span>
        {/if}
      </div>
    </div>
    <div class="field-card-meta">
      #{fieldSchema.number}
    </div>
  </div>

  <div class="px-2.5 py-2.5">
    <slot {handleChange} />
  </div>
</div>
