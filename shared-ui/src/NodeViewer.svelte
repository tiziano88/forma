<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MessageValue, FieldDef } from '@lintx/core';
  import ObjectViewer from './ObjectViewer.svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';
  import RepeatedFieldViewer from './RepeatedFieldViewer.svelte';

  export let parent: MessageValue;
  export let fieldSchema: FieldDef;

  const dispatch = createEventDispatcher();
  let value: any;

  // A set of well-known or custom types that require special UI handling.
  const SPECIAL_CASED_TYPES = new Set([
    '.google.protobuf.Timestamp',
  ]);

  $: isRepeated = fieldSchema.label === 3; // LABEL_REPEATED
  $: {
    console.log(`[NodeViewer] Field ${fieldSchema.number} (${fieldSchema.name}): label=${fieldSchema.label}, isRepeated=${isRepeated}`);
    if (isRepeated) {
      console.log(`[NodeViewer] Using getRepeatedField for field ${fieldSchema.number}`);
      value = parent.getRepeatedField(fieldSchema.number);
    } else {
      console.log(`[NodeViewer] Using getField for field ${fieldSchema.number}`);
      value = parent.getField(fieldSchema.number);
    }
  }
  $: isSpecialCased = fieldSchema.typeName && SPECIAL_CASED_TYPES.has(fieldSchema.typeName);

  function handleChange() {
    dispatch('change');
  }
</script>

<div class="rounded-lg border-2 border-primary/20 overflow-hidden">
  <div class="bg-base-300 px-3 py-1">
    <label class="label-text font-bold text-primary">{fieldSchema.name}</label>
    <span class="text-xs opacity-70 ml-2">
      (type: {fieldSchema.typeName || fieldSchema.type})
    </span>
  </div>
  <div class="p-2 bg-base-100">
    {#if isSpecialCased}
      <div class="flex items-center gap-2 p-2 bg-base-200 rounded-md">
        <span class="text-xl">⏰</span>
        <span class="text-sm italic opacity-70">Timestamp (not yet editable)</span>
      </div>
    {:else if fieldSchema.typeName && fieldSchema.typeName.startsWith('.')}
      {#if isRepeated}
        <RepeatedFieldViewer
          bind:parent={parent}
          fieldSchema={fieldSchema}
          on:change={handleChange}
        />
      {:else if value && value.type}
        <ObjectViewer
          bind:object={value}
          messageSchema={value.type}
          on:change={handleChange}
        />
      {:else}
        <div class="text-sm opacity-70 italic">No value</div>
      {/if}
    {:else}
      {#if isRepeated}
        <RepeatedFieldViewer
          bind:parent={parent}
          fieldSchema={fieldSchema}
          on:change={handleChange}
        />
      {:else}
        <PrimitiveInput bind:value={value} type={fieldSchema.type} id={fieldSchema.name}
                       on:change={(e) => { parent.setField(fieldSchema.number, e.detail); handleChange(); }} />
      {/if}
    {/if}
  </div>
</div>
