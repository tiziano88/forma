<script lang="ts">
  import type { MessageValue, MessageType, StructuralEditor } from '@lintx/core';
  import type { ProductType } from '@lintx/core';
  import ObjectViewer from './ObjectViewer.svelte';
  import BytesViewer, { type ByteSourceOption } from './BytesViewer.svelte';
  import type { FieldMutation, MutationEvent } from './mutations';
  import { MutationDispatcher, MutationApplicator } from './mutations';

  const EMPTY_BYTES = new Uint8Array();

  interface Props {
    editor: StructuralEditor;
    ontypechange?: (type: string | null) => void;
    onchange?: (data: MessageValue | null) => void;
    onsave?: () => void;
  }

  const {
    editor,
    ontypechange,
    onchange,
    onsave
  }: Props = $props();

  // Access editor properties directly
  const decodedData = $derived(editor.decodedData);
  const rootMessageType = $derived(editor.rootMessageType);
  const availableTypes = $derived(editor.availableTypes);
  const currentType = $derived(editor.selectedTypeName);
  const hexView = $derived(editor.hexView);
  const rootProductType = $derived(editor.rootProductType);
  const originalHexView = $derived(editor.originalHexView);
  const encodedBytes = $derived(editor.encodedBytes);
  const originalBytes = $derived(editor.originalBytes);

  const rawByteSources = $derived(buildRawSources());

  // Mutation tracking
  let mutations = $state<FieldMutation[]>([]);

  // Create root mutation dispatcher
  const rootDispatcher = $derived(
    new MutationDispatcher([], handleMutation)
  );

  // No conversion needed - MessageValueImpl already creates SvelteMap/SvelteSet

  function handleMutation(event: MutationEvent) {
    console.log('[StructuralViewer] Received mutation:', event.mutation);
    mutations = [...mutations, event.mutation];

    // Apply mutation to the decodedData (already reactive via SvelteMap/SvelteSet)
    if (decodedData) {
      MutationApplicator.applyMutation(decodedData, event.mutation);
      console.debug('[StructuralViewer] Post-mutation field keys', Array.from(decodedData.fields.keys()));
    }

    // Continue with existing change notification
    handleDataChange();
  }

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
    ontypechange?.(v || null);
  }

  function handleDataChange() {
    // Pass the original decodedData that has been mutated
    onchange?.(decodedData);
  }

  // Clear mutations when decodedData changes (new data loaded)
  let lastDecodedData = $state<MessageValue | null>(null);
  $effect(() => {
    if (decodedData !== lastDecodedData) {
      lastDecodedData = decodedData;
      mutations = []; // Clear mutations when we get new input data
    }
  });
</script>

<div class="flex flex-col gap-4">
  <section class="section-main">
    <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-editor-primary">Structured view</h2>
      <div class="flex items-center gap-2">
        {#if decodedData && rootProductType}
          <div class="badge-editor-type">
            {rootMessageType?.fullName ?? currentType ?? 'Auto'}
          </div>
        {/if}
        <select
          id="root-type-select"
          class="select-editor text-xs"
          value={currentType ?? ''}
          onchange={handleTypeChange}
          title="Choose root message type"
        >
          <option value=''>Auto (last in schema)</option>
          {#each availableTypes as name}
            <option value={name}>{name}</option>
          {/each}
        </select>
      </div>
    </div>

    {#if decodedData && rootProductType}
      <ObjectViewer
        object={decodedData}
        productType={rootProductType}
        editor={editor}
        onchange={handleDataChange}
        onmutation={handleMutation}
        dispatcher={rootDispatcher}
        mutationVersion={mutations.length}
      />
    {:else}
      <div class="empty-state p-6">
        No decoded data available yet.
      </div>
    {/if}
  </section>

  <section class="section-main">
    <div class="mb-2.5 flex flex-col gap-1">
      <h2 class="text-sm font-semibold text-editor-primary">Raw bytes</h2>
      <p class="text-sm text-editor-secondary">Swap viewers to inspect the payload in different representations.</p>
    </div>
    <BytesViewer
      sources={rawByteSources}
      emptyMessage="No bytes available."
    />
  </section>

  <!-- Mutation History Section -->
  <section class="section-main">
    <div class="mb-2.5 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-editor-primary">Mutation History</h2>
      <div class="flex items-center gap-2">
        <span class="badge badge-outline text-[10px] font-medium" style="border-color: var(--editor-border-primary); background: var(--editor-bg-tertiary); color: var(--editor-text-secondary);">
          {mutations.length} mutations
        </span>
        {#if mutations.length > 0}
          <button
            class="btn btn-xs btn-outline"
            onclick={() => mutations = []}
          >
            Clear
          </button>
        {/if}
      </div>
    </div>

    {#if mutations.length > 0}
      <div class="space-y-2 max-h-64 overflow-y-auto">
        {#each mutations as mutation, index}
          <div class="rounded-lg border p-3 text-sm surface-secondary" style="border-color: var(--editor-border-primary);">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-medium text-editor-primary truncate">
                  {mutation.description}
                </div>
                <div class="mt-1 text-xs text-editor-muted">
                  ID: {mutation.id}
                </div>
              </div>
              <div class="flex-shrink-0 text-xs text-editor-secondary">
                #{index + 1}
              </div>
            </div>
            <div class="mt-2 text-xs text-editor-muted">
              {new Date(mutation.timestamp).toLocaleTimeString()}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state p-6">
        <div class="text-sm text-editor-secondary">
          No mutations recorded yet. Edit fields to see mutation history.
        </div>
      </div>
    {/if}
  </section>

  <!-- Metadata Section -->
  <section class="section-header">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold text-editor-secondary">Session Info</span>
      <span class="badge-editor-accent text-xs">
        {decodedData ? 'Writable' : 'Read only'}
      </span>
    </div>
    <div class="mt-2.5 grid gap-2.5 text-sm text-editor-secondary sm:grid-cols-3">
      <div class="flex items-center justify-between rounded-lg border px-3 py-1.5 surface-secondary" style="border-color: var(--editor-border-primary);">
        <span>Current type</span>
        <span class="font-medium text-editor-primary truncate max-w-[60%] text-right">{currentType ?? rootMessageType?.fullName ?? 'Auto'}</span>
      </div>
      <div class="flex items-center justify-between rounded-lg border px-3 py-1.5 surface-secondary" style="border-color: var(--editor-border-primary);">
        <span>Fields</span>
        <span class="font-medium text-editor-primary">{rootProductType ? Object.keys(rootProductType.fields).length : 0}</span>
      </div>
      <div class="flex items-center justify-between rounded-lg border px-3 py-1.5 surface-secondary" style="border-color: var(--editor-border-primary);">
        <span>Bytes</span>
        <span class="font-medium text-editor-primary">{encodedBytes?.length ?? 0}</span>
      </div>
    </div>
  </section>
</div>
