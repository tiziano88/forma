<script lang="ts">
  import type {
    MessageValue,
    StructuralEditor,
    FieldPath,
  } from '@lintx/core';
  import type { ProductType } from '@lintx/core';
  import FlatFieldViewer from './FlatFieldViewer.svelte';
  import type { MutationEvent, MutationDispatcher } from './mutations';

  interface Props {
    object: MessageValue;
    productType: ProductType;
    editor: StructuralEditor;
    depth?: number;
    parentPath?: FieldPath;
    onchange?: () => void;
    onmutation?: (event: MutationEvent) => void;
    dispatcher?: MutationDispatcher;
    mutationVersion?: number;
  }

  const {
    object,
    productType,
    editor,
    depth = 0,
    parentPath,
    onchange,
    onmutation,
    dispatcher,
    mutationVersion = 0,
  }: Props = $props();

  // Derive the FieldDef array from the object's type (which is still MessageType).
  // We use productType for iteration order, but the actual FieldDef for rendering
  // is still pulled from the object's MessageType (until FlatFieldViewer is migrated).
  const fields = $derived(() => {
    const messageType = object?.type;
    if (!messageType?.fields) return [];
    return Array.from(messageType.fields.values());
  });

  function handleChange() {
    onchange?.();
  }

  function handleMutation(event: MutationEvent) {
    onmutation?.(event);
  }
</script>

<div class="space-y-1">
  {#each fields() as field}
    <FlatFieldViewer
      parent={object}
      fieldSchema={field}
      {editor}
      {depth}
      {parentPath}
      onchange={handleChange}
      onmutation={handleMutation}
      {dispatcher}
      {mutationVersion}
    />
  {/each}
</div>
