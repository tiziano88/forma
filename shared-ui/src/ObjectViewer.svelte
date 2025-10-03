<script lang="ts">
  import type {
    MessageValue,
    MessageType,
    StructuralEditor,
  } from '@lintx/core';
  import FlatFieldViewer from './FlatFieldViewer.svelte';
  import type { MutationEvent, MutationDispatcher } from './mutations';

  interface Props {
    object: MessageValue;
    messageSchema: MessageType;
    editor: StructuralEditor;
    depth?: number;
    onchange?: () => void;
    onmutation?: (event: MutationEvent) => void;
    dispatcher?: MutationDispatcher;
    mutationVersion?: number;
  }

  const {
    object,
    messageSchema,
    editor,
    depth = 0,
    onchange,
    onmutation,
    dispatcher,
    mutationVersion = 0,
  }: Props = $props();

  function handleChange() {
    onchange?.();
  }

  function handleMutation(event: MutationEvent) {
    onmutation?.(event);
  }
</script>

<div class="space-y-1">
  {#each messageSchema?.fields ? Array.from(messageSchema.fields.values()) : [] as field}
    <FlatFieldViewer
      parent={object}
      fieldSchema={field}
      {editor}
      {depth}
      onchange={handleChange}
      onmutation={handleMutation}
      {dispatcher}
      {mutationVersion}
    />
  {/each}
</div>
