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

<div class="flex gap-3 {showBorder ? 'border-t border-base-300 pt-3 mt-3' : ''}">
  <!-- Left Controls Panel -->
  <div class="flex-shrink-0 w-16 flex flex-col items-center gap-1">
    {#if isRepeated}
      <!-- Index display for repeated fields -->
      <div class="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
        {index}
      </div>
    {/if}

    <!-- Remove button -->
    <button
      class="btn btn-xs btn-ghost text-error/70 hover:text-error hover:bg-error/10"
      title="Remove {isRepeated ? `item ${index}` : 'value'}"
      on:click={handleRemove}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>

    {#if isRepeated}
      <!-- Reorder buttons for repeated fields only -->
      <div class="flex flex-col">
        <button
          class="btn btn-xs btn-ghost"
          title="Move up"
          disabled={!canMoveUp}
          on:click={handleMoveUp}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          class="btn btn-xs btn-ghost"
          title="Move down"
          disabled={!canMoveDown}
          on:click={handleMoveDown}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    {/if}
  </div>

  <!-- Content Area -->
  <div class="flex-1 min-w-0">
    <slot />
  </div>
</div>