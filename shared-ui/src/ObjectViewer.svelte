<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MessageValue, MessageType, StructuralEditor } from '@lintx/core';
  import NodeViewer from './NodeViewer.svelte';

  export let object: MessageValue;
  export let messageSchema: MessageType;
  export let editor: StructuralEditor; // Now properly typed and non-null
  export let top: number = 0;

  const dispatch = createEventDispatcher();

  function handleChange() {
    dispatch('change', object);
  }
</script>

<div class="space-y-4">
  {#each Array.from(messageSchema.fields.values()) as field}
    <NodeViewer
      bind:parent={object}
      fieldSchema={field}
      editor={editor}
      {top}
      on:change={handleChange}
    />
  {/each}
</div>
