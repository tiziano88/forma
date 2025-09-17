<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MessageValue, MessageType } from '@lintx/core';
  import NodeViewer from './NodeViewer.svelte';

  export let object: MessageValue;
  export let messageSchema: MessageType;
  export let editor: any; // StructuralEditor instance

  const dispatch = createEventDispatcher();

  function handleChange() {
    console.log('[ObjectViewer] handleChange called, dispatching change with object:', object);
    dispatch('change', object);
    console.log('[ObjectViewer] change event dispatched');
  }
</script>

<div class="space-y-4">
  {#each Array.from(messageSchema.fields.values()) as field}
    <NodeViewer
      bind:parent={object}
      fieldSchema={field}
      editor={editor}
      on:change={handleChange}
    />
  {/each}
</div>
