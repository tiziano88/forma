<script lang="ts">
  export let parent: any;
  export let key: string | number;

  // A helper to check if a value is a plain object
  function isObject(value: any) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  $: value = parent[key];
</script>

<div class="node">
  <span class="name">{key}:</span>

  {#if isObject(value)}
    <div class="node-children object">
      {#each Object.entries(value) as [childKey, childValue]}
        <svelte:self parent={value} key={childKey} />
      {/each}
    </div>
  {:else if Array.isArray(value)}
    <div class="node-children array">
      {#each value as item, i}
        <svelte:self parent={value} key={i} />
      {/each}
    </div>
  {:else if typeof value === 'boolean'}
    <input type="checkbox" bind:checked={parent[key]} />
  {:else if typeof value === 'number'}
    <input type="number" bind:value={parent[key]} />
  {:else}
    <input type="text" bind:value={parent[key]} />
  {/if}
</div>

<style>
  .node {
    padding-left: 1.5rem;
    border-left: 1px solid #ccc;
    margin-bottom: 0.5rem;
  }
  .name {
    font-weight: bold;
    margin-right: 0.5rem;
  }
  .node-children {
    display: flex;
    flex-direction: column;
  }
  input {
    padding: 0.25rem;
    border-radius: 0.25rem;
    border: 1px solid #aaa;
    background-color: inherit;
    color: inherit;
    font-family: inherit;
  }
</style>