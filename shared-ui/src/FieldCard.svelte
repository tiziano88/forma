<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MessageValue, FieldDef } from '@lintx/core';

  export let fieldSchema: FieldDef;
  export let isRepeated: boolean = false;
  export let top: number = 0;

  const dispatch = createEventDispatcher();

  function handleChange() {
    dispatch('change');
  }
</script>

<div class="group rounded-xl border border-base-300/60 bg-base-100/95 shadow-sm shadow-base-300/10 transition-colors duration-150 hover:border-primary/60 hover:bg-base-200">
  <div
    class="sticky z-10 flex flex-wrap items-start justify-between gap-2 border-b border-base-300/50 bg-gradient-to-r from-base-200 to-base-100 px-2.5 py-2"
    style="top: {top}px;"
  >
    <div class="space-y-1">
      <div class="text-sm font-semibold text-base-content/90">{fieldSchema.name}</div>
      <div class="flex flex-wrap items-center gap-2 text-xs text-base-content/60">
        <span class="badge badge-xs border-base-300 bg-base-100/70 font-mono text-base-content/70">
          {fieldSchema.typeName || fieldSchema.type}
        </span>
        {#if isRepeated}
          <span class="badge badge-xs border-accent/40 bg-accent/10 text-accent">Repeated</span>
        {/if}
      </div>
    </div>
    <div class="text-xs font-medium text-base-content/50">#{fieldSchema.number}</div>
  </div>

  <div class="px-2.5 py-2.5">
    <slot {handleChange} />
  </div>
</div>
