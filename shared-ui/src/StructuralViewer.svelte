<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MessageValue, MessageType } from '@lintx/core';
  import ObjectViewer from './ObjectViewer.svelte';

  export let decodedData: MessageValue | null;
  export let rootMessageType: MessageType | null;
  export let availableTypes: string[];
  export let currentType: string | null;
  export let hexView: string;
  export let originalHexView: string;
  export let editor: any; // StructuralEditor instance

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

<div class="space-y-4">
  <div class="card bg-base-200 shadow-sm">
    <div class="card-body p-4">
      <label class="label py-1" for="root-type-select">
        <span class="label-text">Root Message Type</span>
      </label>
      <select id="root-type-select" class="select select-sm select-bordered w-full" value={currentType ?? ''} on:change={handleTypeChange}>
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
    <div class="card-body p-4">
      {#if decodedData && rootMessageType}
        <ObjectViewer
          object={decodedData}
          messageSchema={rootMessageType}
          editor={editor}
          on:change={handleDataChange}
        />
      {/if}
    </div>
  </div>

  <div class="card bg-base-200 shadow-sm">
    <div class="card-body p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="font-semibold">Hex Viewer</div>
        <div class="flex items-center gap-2">
          <label class="label-text" for="hex-source-select">Source</label>
          <select id="hex-source-select" class="select select-bordered select-xs" bind:value={hexSource}>
            <option value="encoded">Current (encoded)</option>
            <option value="original">Original</option>
          </select>
        </div>
      </div>
      <pre class="whitespace-pre overflow-auto max-h-60 p-2 bg-base-100 rounded border border-base-300 text-xs font-mono">
        {hexSource === 'encoded' ? hexView : originalHexView}
      </pre>
    </div>
  </div>
</div>
