<script lang="ts">
  import type * as protobuf from 'protobufjs';
  import NodeViewer from './NodeViewer.svelte';

  export let object: any;
  export let type: protobuf.Type;
</script>

<div class="space-y-4">
  {#if type}
    {#each type.fieldsArray as field}
      <NodeViewer parent={object} key={field.name} type={type} />
    {/each}
  {/if}
</div>