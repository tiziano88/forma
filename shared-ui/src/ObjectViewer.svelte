<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MessageValue, MessageType, StructuralEditor } from '@lintx/core';
  import FlatFieldViewer from './FlatFieldViewer.svelte';

  export let object: MessageValue;
  export let messageSchema: MessageType;
  export let editor: StructuralEditor; // Now properly typed and non-null
  export let depth: number = 0;

  const dispatch = createEventDispatcher();

  function handleChange() {
    dispatch('change', object);
  }
</script>

<div class="space-y-4">
  {#each Array.from(messageSchema.fields.values()) as field}
    <FlatFieldViewer
      bind:parent={object}
      fieldSchema={field}
      {editor}
      depth={depth + 1}
      on:change={handleChange}
    />
  {/each}
</div>
