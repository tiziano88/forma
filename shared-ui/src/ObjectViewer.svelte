<script lang="ts">
  import type { MessageValue, MessageType, StructuralEditor } from '@lintx/core';
  import FlatFieldViewer from './FlatFieldViewer.svelte';

  export let object: MessageValue;
  export let messageSchema: MessageType;
  export let editor: StructuralEditor; // Now properly typed and non-null
  export let depth: number = 0;
  export let onchange: (() => void) | undefined = undefined;

  function handleChange() {
    onchange?.();
  }
</script>

<div class="space-y-4">
  {#each Array.from(messageSchema.fields.values()) as field}
    <FlatFieldViewer
      bind:parent={object}
      fieldSchema={field}
      {editor}
      depth={depth + 1}
      onchange={handleChange}
    />
  {/each}
</div>
