<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MessageValue, FieldDef } from '@lintx/core';

  export let fieldSchema: FieldDef;
  export let parent: MessageValue;
  export let editor: any;
  export let isRepeated: boolean = false;

  const dispatch = createEventDispatcher();

  function handleChange() {
    dispatch('change');
  }
</script>

<div class="rounded-lg border-2 border-primary/20 overflow-hidden bg-base-100">
  <!-- Card Header - Always shows field name and type -->
  <div class="bg-base-300 px-3 py-2 border-b border-base-300">
    <div class="flex items-center justify-between">
      <div>
        <span class="font-bold text-primary">{fieldSchema.name}</span>
        <span class="text-xs opacity-70 ml-2">
          ({fieldSchema.typeName || fieldSchema.type})
          {#if isRepeated}<span class="text-accent font-medium">[]</span>{/if}
        </span>
      </div>
      <div class="text-xs opacity-50">
        Field #{fieldSchema.number}
      </div>
    </div>
  </div>

  <!-- Card Body - Contains field content -->
  <div class="p-3">
    <slot {handleChange} />
  </div>
</div>