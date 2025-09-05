<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type * as protobuf from 'protobufjs';
  import NodeViewer from './NodeViewer.svelte';

  export let object: any;
  export let type: protobuf.Type | undefined = undefined;

  const dispatch = createEventDispatcher();

  function handleChange() {
    dispatch('change', object);
  }
</script>

<div class="space-y-4">
  {#if type}
    {#each type.fieldsArray as field}
      <NodeViewer bind:parent={object} key={field.name} {type} on:change={handleChange} />
    {/each}
  {:else}
    <!-- This case is for primitive arrays, where there's no inner 'type' -->
    <NodeViewer bind:parent={object} key={"value"} type={undefined} on:change={handleChange} />
  {/if}
</div>
