<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MessageValue, MessageType, StructuralEditor } from '@lintx/core';
  import ObjectViewer from './ObjectViewer.svelte';
  import BytesViewer, { type ByteSourceOption } from './BytesViewer.svelte';

  const EMPTY_BYTES = new Uint8Array();

  export let decodedData: MessageValue | null;
  export let rootMessageType: MessageType | null;
  export let availableTypes: string[];
  export let currentType: string | null;
  export let hexView: string;
  export let originalHexView: string;
  export let encodedBytes: Uint8Array = EMPTY_BYTES;
  export let originalBytes: Uint8Array = EMPTY_BYTES;
  export let editor: StructuralEditor; // Now properly typed and non-null

  const dispatch = createEventDispatcher();
  let rawSourceId: string | null = 'encoded';
  $: rawByteSources = buildRawSources();

  function buildRawSources(): ByteSourceOption[] {
    const encodedSource: ByteSourceOption = {
      id: 'encoded',
      label: 'Current (encoded)',
      bytes: encodedBytes ?? EMPTY_BYTES,
      hexdump: hexView,
    };

    const originalSource: ByteSourceOption = {
      id: 'original',
      label: 'Original',
      bytes: originalBytes ?? EMPTY_BYTES,
      hexdump: originalHexView,
    };

    return [encodedSource, originalSource];
  }

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
    <div class="card-body p-4 space-y-3">
      <div class="font-semibold">Raw Bytes</div>
      <BytesViewer
        bind:selectedSourceId={rawSourceId}
        sources={rawByteSources}
        emptyMessage="No bytes available."
      />
    </div>
  </div>
</div>
