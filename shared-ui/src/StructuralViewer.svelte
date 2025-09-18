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

<div class="flex flex-col gap-4">
  <section class="grid gap-3 lg:grid-cols-2">
    <div class="rounded-xl border border-base-300/50 bg-base-100/85 p-3.5 shadow-md shadow-base-300/15">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-base-content/70">Root type</span>
        <span class="badge badge-sm badge-outline border-primary/40 bg-primary/10 text-primary">
          {currentType ? 'Custom' : 'Auto'}
        </span>
      </div>
      <div class="mt-3 text-sm text-base-content/70">
        Choose which message to treat as the document root. Leaving it on auto picks the last type in the descriptor.
      </div>
      <div class="mt-4">
        <select
          id="root-type-select"
          class="select select-bordered select-sm w-full rounded-lg border-base-300/60 bg-base-100"
          value={currentType ?? ''}
          on:change={handleTypeChange}
        >
          <option value=''>Auto (last in schema)</option>
          {#each availableTypes as name}
            <option value={name}>{name}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="rounded-xl border border-base-300/50 bg-base-100/85 p-3.5 shadow-md shadow-base-300/15">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-base-content/70">Session</span>
        <span class="badge badge-outline badge-sm border-accent/40 bg-accent/10 text-accent">
          {decodedData ? 'Writable' : 'Read only'}
        </span>
      </div>
      <div class="mt-2.5 grid gap-2.5 text-sm text-base-content/70 sm:grid-cols-2">
        <div class="flex items-center justify-between rounded-lg border border-base-300/60 bg-base-100/90 px-3 py-1.5">
          <span>Current type</span>
          <span class="font-medium text-base-content/80 truncate max-w-[60%] text-right">{currentType ?? rootMessageType?.fullName ?? 'Auto'}</span>
        </div>
        <div class="flex items-center justify-between rounded-lg border border-base-300/60 bg-base-100/90 px-3 py-1.5">
          <span>Fields</span>
          <span class="font-medium text-base-content/80">{rootMessageType ? rootMessageType.fields.size : 0}</span>
        </div>
        <div class="flex items-center justify-between rounded-lg border border-base-300/60 bg-base-100/90 px-3 py-1.5">
          <span>Bytes</span>
          <span class="font-medium text-base-content/80">{encodedBytes?.length ?? 0}</span>
        </div>
        <div class="flex items-center justify-end">
          <button
            class="btn btn-primary btn-xs rounded-lg shadow-sm shadow-primary/20"
            on:click={() => dispatch('save')}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="rounded-xl border border-base-300/50 bg-base-100/90 p-4 shadow-lg shadow-base-300/15">
    <div class="mb-2.5 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-base-content">Structured view</h2>
      {#if decodedData && rootMessageType}
        <div class="badge badge-outline border-base-300/70 bg-base-200/70 text-[10px] font-medium text-base-content/70">
          {rootMessageType.fullName}
        </div>
      {/if}
    </div>

    {#if decodedData && rootMessageType}
      <ObjectViewer
        object={decodedData}
        messageSchema={rootMessageType}
        editor={editor}
        on:change={handleDataChange}
      />
    {:else}
      <div class="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-6 text-center text-sm text-base-content/70">
        No decoded data available yet.
      </div>
    {/if}
  </section>

  <section class="rounded-xl border border-base-300/50 bg-base-100/90 p-4 shadow-lg shadow-base-300/15">
    <div class="mb-2.5 flex flex-col gap-1">
      <h2 class="text-sm font-semibold text-base-content">Raw bytes</h2>
      <p class="text-sm text-base-content/60">Swap viewers to inspect the payload in different representations.</p>
    </div>
    <BytesViewer
      bind:selectedSourceId={rawSourceId}
      sources={rawByteSources}
      emptyMessage="No bytes available."
    />
  </section>
</div>
