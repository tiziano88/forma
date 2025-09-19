<script lang="ts">
  import type { MessageValue, MessageType, StructuralEditor } from '@lintx/core';
  import FlatFieldViewer from './FlatFieldViewer.svelte';

  interface Props {
    object: MessageValue;
    messageSchema: MessageType;
    editor: StructuralEditor;
    depth?: number;
    onchange?: () => void;
  }

  const {
    object,
    messageSchema,
    editor,
    depth = 0,
    onchange
  }: Props = $props();

  function handleChange() {
    onchange?.();
  }
</script>

<div class="space-y-4">
  {#each Array.from(messageSchema.fields.values()) as field}
    <FlatFieldViewer
      parent={object}
      fieldSchema={field}
      {editor}
      depth={depth + 1}
      onchange={handleChange}
    />
  {/each}
</div>
