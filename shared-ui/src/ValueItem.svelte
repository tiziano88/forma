<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let index: number | null = null; // null for singular fields, number for repeated fields
  export let isRepeated: boolean = false;
  export let canMoveUp: boolean = false;
  export let canMoveDown: boolean = false;
  export let showBorder: boolean = false; // Show border separator above this item

  const dispatch = createEventDispatcher();

  function handleRemove() {
    dispatch('remove', { index });
  }

  function handleMoveUp() {
    dispatch('moveUp', { index });
  }

  function handleMoveDown() {
    dispatch('moveDown', { index });
  }
</script>

<div class="value-item group flex flex-col gap-2.5 {showBorder ? 'mt-2.5' : ''}">
  <div class="flex items-center justify-between gap-2">
    {#if isRepeated}
      <div class="value-item-header">
        <span class="value-item-index">#{index}</span>
        <span class="text-editor-secondary">Item</span>
      </div>
    {/if}

    <div class="flex items-center gap-2">
      {#if isRepeated}
        <button
          type="button"
          class="btn btn-xs btn-ghost btn-circle"
          title="Move up"
          disabled={!canMoveUp}
          aria-label={canMoveUp ? 'Move item up' : 'Move item up (disabled)'}
          on:click={handleMoveUp}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          class="btn btn-xs btn-ghost btn-circle"
          title="Move down"
          disabled={!canMoveDown}
          aria-label={canMoveDown ? 'Move item down' : 'Move item down (disabled)'}
          on:click={handleMoveDown}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      {/if}
      <button
        type="button"
        class="btn btn-xs btn-outline btn-circle btn-editor-error"
        title="Remove {isRepeated ? `item ${index}` : 'value'}"
        aria-label={isRepeated ? `Remove item ${index}` : 'Remove value'}
        on:click={handleRemove}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>

  <div class="min-w-0">
    <slot />
  </div>
</div>
