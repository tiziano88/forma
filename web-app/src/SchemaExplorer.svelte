<script lang="ts">
  import type { Schema, Annotations, Type, ProductType, SumType, Field } from '@lintx/core';

  interface Props {
    schema: Schema;
    annotations: Annotations;
  }

  const { schema, annotations }: Props = $props();

  function annotationName(id: string): string {
    return annotations[id]?.name ?? id;
  }

  function annotationDoc(id: string): string | undefined {
    return annotations[id]?.doc;
  }

  function typeLabel(type: Type): string {
    switch (type.kind) {
      case 'primitive': return type.primitive;
      case 'ref': return annotationName(type.name);
      case 'list': return `list<${typeLabel(type.element)}>`;
      case 'map': return `map<${typeLabel(type.key)}, ${typeLabel(type.value)}>`;
      case 'optional': return `${typeLabel(type.inner)}?`;
      case 'product': return 'product{…}';
      case 'sum': return 'sum{…}';
    }
  }

  // Expand/collapse state
  let expanded = $state<Set<string>>(new Set());

  function toggle(id: string) {
    if (expanded.has(id)) {
      expanded = new Set([...expanded].filter(x => x !== id));
    } else {
      expanded = new Set([...expanded, id]);
    }
  }

  function expandAll() {
    expanded = new Set(Object.keys(schema.definitions));
  }

  function collapseAll() {
    expanded = new Set();
  }
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-sm font-semibold text-editor-primary">Schema Explorer</h2>
    <div class="flex gap-1.5">
      <button class="btn btn-xs btn-ghost text-editor-secondary" onclick={expandAll}>Expand all</button>
      <button class="btn btn-xs btn-ghost text-editor-secondary" onclick={collapseAll}>Collapse all</button>
    </div>
  </div>

  <div class="text-xs text-editor-muted mb-3">
    {Object.keys(schema.definitions).length} type definitions
    {#if schema.root}
      · root: <span class="font-medium text-editor-accent">{annotationName(schema.root)}</span>
    {/if}
  </div>

  {#each Object.entries(schema.definitions) as [id, type]}
    {@const name = annotationName(id)}
    {@const doc = annotationDoc(id)}
    {@const isExpanded = expanded.has(id)}
    {@const isRoot = schema.root === id}

    <div class="rounded-lg border overflow-hidden" style="border-color: var(--editor-border-primary); background: var(--editor-bg-secondary);">
      <!-- Type header -->
      <button
        class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
        onclick={() => toggle(id)}
      >
        <span class="text-[10px] text-editor-muted font-mono transition-transform {isExpanded ? 'rotate-90' : ''}" style="display:inline-block">▶</span>
        <span class="font-semibold text-sm text-editor-primary">{name}</span>

        {#if type.kind === 'product'}
          <span class="badge-editor-type text-[10px]">product</span>
          <span class="text-[10px] text-editor-muted">{Object.keys(type.fields).length} fields</span>
        {:else if type.kind === 'sum'}
          <span class="badge-editor-accent text-[10px]">sum</span>
          <span class="text-[10px] text-editor-muted">{Object.keys(type.variants).length} variants</span>
        {:else if type.kind === 'list'}
          <span class="badge-editor-type text-[10px]">list</span>
          <span class="text-[10px] text-editor-muted">of {typeLabel(type.element)}</span>
        {:else}
          <span class="badge-editor-type text-[10px]">{typeLabel(type)}</span>
        {/if}

        {#if isRoot}
          <span class="ml-auto badge badge-sm" style="background: var(--editor-accent); color: var(--editor-bg-primary); font-size: 9px;">ROOT</span>
        {/if}
      </button>

      {#if isExpanded}
        <div class="border-t px-3 py-2 space-y-1" style="border-color: var(--editor-border-primary);">
          {#if doc}
            <p class="text-xs text-editor-muted italic mb-2">{doc}</p>
          {/if}

          {#if type.kind === 'product'}
            {#each Object.entries(type.fields) as [fieldId, field]}
              {@const fieldName = annotationName(fieldId)}
              {@const fieldDoc = annotationDoc(fieldId)}
              <div class="flex items-start gap-2 py-1 px-2 rounded hover:bg-white/5">
                <span class="text-sm font-medium text-editor-primary min-w-[120px]">{fieldName}</span>
                {#if field.number !== undefined}
                  <span class="text-[10px] text-editor-muted font-mono">#{field.number}</span>
                {/if}
                <span class="text-xs text-editor-accent font-mono">{typeLabel(field.type)}</span>
                {#if field.deprecated}
                  <span class="text-[10px] text-red-400">deprecated</span>
                {/if}
                {#if fieldDoc}
                  <span class="text-[10px] text-editor-muted ml-auto max-w-[40%] truncate" title={fieldDoc}>{fieldDoc}</span>
                {/if}
              </div>
            {/each}

          {:else if type.kind === 'sum'}
            {#each Object.entries(type.variants) as [variantId, variant]}
              {@const variantName = annotationName(variantId)}
              {@const variantDoc = annotationDoc(variantId)}
              <div class="flex items-start gap-2 py-1 px-2 rounded hover:bg-white/5">
                <span class="text-sm font-medium text-editor-primary min-w-[120px]">{variantName}</span>
                {#if variant.number !== undefined}
                  <span class="text-[10px] text-editor-muted font-mono">#{variant.number}</span>
                {/if}
                {#if variant.payload}
                  <span class="text-xs text-editor-accent font-mono">{typeLabel(variant.payload)}</span>
                {:else}
                  <span class="text-xs text-editor-muted">(no payload)</span>
                {/if}
                {#if variantDoc}
                  <span class="text-[10px] text-editor-muted ml-auto max-w-[40%] truncate" title={variantDoc}>{variantDoc}</span>
                {/if}
              </div>
            {/each}

          {:else if type.kind === 'list'}
            <div class="text-xs text-editor-secondary px-2 py-1">
              Element type: <span class="font-mono text-editor-accent">{typeLabel(type.element)}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/each}
</div>
