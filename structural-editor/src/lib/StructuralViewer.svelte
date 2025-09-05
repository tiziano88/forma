<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ObjectViewer from './ObjectViewer.svelte';
  import type * as protobuf from 'protobufjs';

  export let decodedData: any;
  export let availableTypes: string[];
  export let currentType: string | null;
  export let hexView: string;
  export let originalHexView: string;

  const dispatch = createEventDispatcher();

  let hexSource: 'original' | 'encoded' = 'encoded';

  function handleTypeChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value;
    dispatch('typechange', v || null);
  }

  function handleDataChange(e: CustomEvent) {
    dispatch('change', e.detail);
  }
</script>

<div class="mb-4 card bg-base-200 shadow-xl">
  <div class="card-body">
    <label class="label" for="root-type-select">Root Message Type</label>
    <select id="root-type-select" class="select select-bordered w-full" value={currentType ?? ''} on:change={handleTypeChange}>
      <option value=''>Auto (last in schema)</option>
      {#each availableTypes as name}
        <option value={name}>{name}</option>
      {/each}
    </select>
  </div>
</div>

<div class="mb-4">
  <button class="btn btn-success w-full" on:click={() => dispatch('save')}>Save Changes</button>
</div>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <ObjectViewer object={decodedData} on:change={handleDataChange} />
  </div>
</div>

<div class="mt-6 card bg-base-200 shadow-xl">
  <div class="card-body">
    <div class="flex items-center justify-between mb-2">
      <div class="font-semibold">Hex Viewer</div>
      <div class="flex items-center gap-2">
        <label class="label-text" for="hex-source-select">Source</label>
        <select id="hex-source-select" class="select select-bordered select-sm" bind:value={hexSource}>
          <option value="encoded">Current (encoded)</option>
          <option value="original">Original</option>
        </select>
      </div>
    </div>
    <pre class="whitespace-pre overflow-auto max-h-80 p-3 bg-base-100 rounded border border-base-300 text-xs font-mono">
      {hexSource === 'encoded' ? hexView : originalHexView}
    </pre>
  </div>
</div>