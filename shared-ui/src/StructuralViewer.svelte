<script lang="ts">
  import type { MessageValue, MessageType, StructuralEditor } from '@lintx/core';
  import ObjectViewer from './ObjectViewer.svelte';
  import BytesViewer, { type ByteSourceOption } from './BytesViewer.svelte';
  import type { FieldMutation, MutationEvent } from './mutations';
  import { MutationDispatcher, MutationApplicator } from './mutations';

  const EMPTY_BYTES = new Uint8Array();

  interface Props {
    decodedData: MessageValue | null;
    rootMessageType: MessageType | null;
    availableTypes: string[];
    currentType: string | null;
    hexView: string;
    originalHexView: string;
    encodedBytes?: Uint8Array;
    originalBytes?: Uint8Array;
    editor: StructuralEditor;
    ontypechange?: (type: string | null) => void;
    onchange?: (data: MessageValue | null) => void;
    onsave?: () => void;
  }

  const {
    decodedData,
    rootMessageType,
    availableTypes,
    currentType,
    hexView,
    originalHexView,
    encodedBytes = EMPTY_BYTES,
    originalBytes = EMPTY_BYTES,
    editor,
    ontypechange,
    onchange,
    onsave
  }: Props = $props();

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
  <section class="grid gap-3 lg:grid-cols-2">
    <div class="section-header">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-editor-secondary">Root type</span>
        <span class="badge-editor-outline">
          {currentType ? 'Custom' : 'Auto'}
        </span>
      </div>
      <div class="mt-3 text-sm text-editor-secondary">
        Choose which message to treat as the document root. Leaving it on auto picks the last type in the descriptor.
      </div>
      <div class="mt-4">
        <select
          id="root-type-select"
          class="select-editor"
          value={currentType ?? ''}
          onchange={handleTypeChange}
        >
          <option value=''>Auto (last in schema)</option>
          {#each availableTypes as name}
            <option value={name}>{name}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="section-header">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-editor-secondary">Session</span>
        <span class="badge-editor-accent">
          {decodedData ? 'Writable' : 'Read only'}
        </span>
      </div>
      <div class="mt-2.5 grid gap-2.5 text-sm text-editor-secondary sm:grid-cols-2">
        <div class="flex items-center justify-between rounded-lg border px-3 py-1.5 surface-secondary" style="border-color: var(--editor-border-primary);">
          <span>Current type</span>
          <span class="font-medium text-editor-primary truncate max-w-[60%] text-right">{currentType ?? rootMessageType?.fullName ?? 'Auto'}</span>
        </div>
        <div class="flex items-center justify-between rounded-lg border px-3 py-1.5 surface-secondary" style="border-color: var(--editor-border-primary);">
          <span>Fields</span>
          <span class="font-medium text-editor-primary">{rootMessageType ? rootMessageType.fields.size : 0}</span>
        </div>
        <div class="flex items-center justify-between rounded-lg border px-3 py-1.5 surface-secondary" style="border-color: var(--editor-border-primary);">
          <span>Bytes</span>
          <span class="font-medium text-editor-primary">{encodedBytes?.length ?? 0}</span>
        </div>
        <div class="flex items-center justify-end">
          <button
            class="btn btn-primary btn-xs rounded-lg shadow-sm"
            style="box-shadow: var(--editor-shadow-sm);"
            onclick={() => onsave?.()}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="section-main">
    <div class="mb-2.5 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-editor-primary">Structured view</h2>
      {#if decodedData && rootMessageType}
        <div class="badge badge-outline text-[10px] font-medium" style="border-color: var(--editor-border-primary); background: var(--editor-bg-tertiary); color: var(--editor-text-secondary);">
          {rootMessageType.fullName}
        </div>
      {/if}
    </div>

    {#if decodedData && rootMessageType}
      <ObjectViewer
        object={decodedData}
        messageSchema={rootMessageType}
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
</div>
