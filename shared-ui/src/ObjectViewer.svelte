<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getFields, type IDescriptorProto } from '@lintx/core';
  import NodeViewer from './NodeViewer.svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';

  export let object: any;
  export let type: IDescriptorProto | undefined = undefined;

  const dispatch = createEventDispatcher();

  function handleChange() {
    dispatch('change', object);
  }

  // Get all fields for this type (schema + data)
  $: allFields = (() => {
    const schemaFields = type
      ? getFields(type)
          .map((f) => f.name || '')
          .filter(Boolean)
      : [];
    const dataFields =
      object && typeof object === 'object' ? Object.keys(object) : [];

    // Combine schema fields and data fields, removing duplicates
    const combined = new Set([...schemaFields, ...dataFields]);
    return Array.from(combined);
  })();
</script>

<div class="space-y-4">
  <!-- Debug info about field discovery -->
  {#if type}
    <div class="alert alert-info text-xs">
      <div>
        <strong>Type:</strong>
        {type.name || 'Unknown'}
        <br />
        <strong>Schema source:</strong>
        DescriptorProto
        <br />
        <strong>Schema fields:</strong>
        {getFields(type)
          .map((f) => f.name || '')
          .join(', ') || 'none'}
        <br />
        <strong>Data fields:</strong>
        {Object.keys(object || {}).join(', ') || 'none'}
        <br />
        <strong>All fields:</strong>
        {allFields.join(', ') || 'none'}
      </div>
    </div>
  {/if}

  <!-- Always use schema-driven approach with extracted fields -->
  {#if allFields.length > 0}
    {#each allFields as fieldName}
      <NodeViewer
        bind:parent={object}
        key={fieldName}
        {type}
        on:change={handleChange}
      />
    {/each}
  {:else if object && typeof object === 'object'}
    <!-- Final fallback: no schema info available, just use data -->
    {#each Object.keys(object) as key}
      <NodeViewer
        bind:parent={object}
        key={key}
        type={undefined}
        on:change={handleChange}
      />
    {/each}
  {/if}
</div>
