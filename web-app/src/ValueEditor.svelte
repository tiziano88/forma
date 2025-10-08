<script lang="ts">
  import type { Schema, Annotations, Type, ProductType, SumType } from '@lintx/core';
  import type { Value, ProductValue, SumValue, ListValue, MapValue } from '@lintx/core';
  import { defaultValue } from '@lintx/core';
  import { resolveRef } from '@lintx/core';
  import ValueEditor from './ValueEditor.svelte';

  interface Props {
    schema: Schema;
    annotations: Annotations;
    value: Value;
    type: Type;
    onchange: (newValue: Value) => void;
    depth?: number;
    label?: string;
  }

  const { schema, annotations, value, type, onchange, depth = 0, label }: Props = $props();

  function annotationName(id: string): string {
    return annotations[id]?.name ?? id;
  }

  /** Fully unwrap ref and optional wrappers to get the concrete type. */
  function resolvedType(t: Type): Type {
    if (t.kind === 'ref') {
      const resolved = resolveRef(schema, t.name);
      return resolved ? resolvedType(resolved) : t;
    }
    if (t.kind === 'optional') {
      return resolvedType(t.inner);
    }
    return t;
  }

  /** Check if the original (non-unwrapped) type is optional. */
  function isOptionalType(t: Type): boolean {
    if (t.kind === 'optional') return true;
    if (t.kind === 'ref') {
      const resolved = resolveRef(schema, t.name);
      return resolved ? isOptionalType(resolved) : false;
    }
    return false;
  }

  /** Get the inner type of an optional (unwrapping refs along the way). */
  function optionalInner(t: Type): Type {
    if (t.kind === 'optional') return t.inner;
    if (t.kind === 'ref') {
      const resolved = resolveRef(schema, t.name);
      return resolved ? optionalInner(resolved) : t;
    }
    return t;
  }

  function typeLabel(t: Type): string {
    switch (t.kind) {
      case 'primitive': return t.primitive;
      case 'ref': return annotationName(t.name);
      case 'list': return `list`;
      case 'map': return `map`;
      case 'optional': return `optional`;
      case 'product': return 'product';
      case 'sum': return 'sum';
    }
  }

  // --- Mutation helpers ---

  function updateProductField(fieldId: string, fieldValue: Value) {
    if (value.kind !== 'product') return;
    onchange({ ...value, fields: { ...value.fields, [fieldId]: fieldValue } });
  }

  function updateSumTag(newTag: string) {
    if (value.kind !== 'sum') return;
    const rt = resolvedType(type);
    if (rt.kind !== 'sum') return;
    const variant = rt.variants[newTag];
    const payload = variant?.payload ? defaultValue(schema, variant.payload) : null;
    onchange({ kind: 'sum', tag: newTag, payload });
  }

  function updateSumPayload(newPayload: Value) {
    if (value.kind !== 'sum') return;
    onchange({ ...value, payload: newPayload });
  }

  function addListItem() {
    if (value.kind !== 'list') return;
    const rt = resolvedType(type);
    if (rt.kind !== 'list') return;
    const newItem = defaultValue(schema, rt.element);
    onchange({ ...value, elements: [...value.elements, newItem] });
  }

  function removeListItem(index: number) {
    if (value.kind !== 'list') return;
    onchange({ ...value, elements: value.elements.filter((_, i) => i !== index) });
  }

  function updateListItem(index: number, newItem: Value) {
    if (value.kind !== 'list') return;
    const newElements = [...value.elements];
    newElements[index] = newItem;
    onchange({ ...value, elements: newElements });
  }

  function addMapEntry() {
    if (value.kind !== 'map') return;
    const rt = resolvedType(type);
    if (rt.kind !== 'map') return;
    const key = defaultValue(schema, rt.key);
    const val = defaultValue(schema, rt.value);
    onchange({ ...value, entries: [...value.entries, [key, val] as [Value, Value]] });
  }

  function removeMapEntry(index: number) {
    if (value.kind !== 'map') return;
    onchange({ ...value, entries: value.entries.filter((_, i) => i !== index) });
  }

  function updateMapKey(index: number, newKey: Value) {
    if (value.kind !== 'map') return;
    const newEntries = [...value.entries];
    newEntries[index] = [newKey, newEntries[index][1]];
    onchange({ ...value, entries: newEntries });
  }

  function updateMapValue(index: number, newVal: Value) {
    if (value.kind !== 'map') return;
    const newEntries = [...value.entries];
    newEntries[index] = [newEntries[index][0], newVal];
    onchange({ ...value, entries: newEntries });
  }

  function toggleOptional() {
    if (value.kind === 'null') {
      const inner = optionalInner(type);
      onchange(defaultValue(schema, inner));
    } else {
      onchange({ kind: 'null' });
    }
  }

  const indentPx = $derived(depth * 16);
</script>

{#if value.kind === 'string'}
  <div class="ve-row" style="padding-left: {indentPx}px">
    {#if label}<span class="ve-label">{label}</span>{/if}
    <input
      type="text"
      class="ve-input"
      value={value.value}
      oninput={(e) => onchange({ kind: 'string', value: (e.target as HTMLInputElement).value })}
      placeholder="(empty string)"
    />
  </div>

{:else if value.kind === 'bool'}
  <div class="ve-row" style="padding-left: {indentPx}px">
    {#if label}<span class="ve-label">{label}</span>{/if}
    <label class="ve-checkbox-label">
      <input
        type="checkbox"
        checked={value.value}
        onchange={(e) => onchange({ kind: 'bool', value: (e.target as HTMLInputElement).checked })}
      />
      <span class="text-xs text-editor-muted">{value.value ? 'true' : 'false'}</span>
    </label>
  </div>

{:else if value.kind === 'int'}
  <div class="ve-row" style="padding-left: {indentPx}px">
    {#if label}<span class="ve-label">{label}</span>{/if}
    <input
      type="number"
      class="ve-input"
      value={value.value}
      oninput={(e) => onchange({ kind: 'int', value: parseInt((e.target as HTMLInputElement).value) || 0 })}
    />
  </div>

{:else if value.kind === 'float'}
  <div class="ve-row" style="padding-left: {indentPx}px">
    {#if label}<span class="ve-label">{label}</span>{/if}
    <input
      type="number"
      step="any"
      class="ve-input"
      value={value.value}
      oninput={(e) => onchange({ kind: 'float', value: parseFloat((e.target as HTMLInputElement).value) || 0 })}
    />
  </div>

{:else if value.kind === 'bytes'}
  <div class="ve-row" style="padding-left: {indentPx}px">
    {#if label}<span class="ve-label">{label}</span>{/if}
    <span class="text-xs text-editor-muted font-mono">{value.value.length} bytes</span>
  </div>

{:else if value.kind === 'null' && isOptionalType(type)}
  <div class="ve-row" style="padding-left: {indentPx}px">
    {#if label}<span class="ve-label">{label}</span>{/if}
    <button class="ve-btn-sm" onclick={toggleOptional}>+ set value</button>
  </div>

{:else if value.kind === 'null'}
  <div class="ve-row" style="padding-left: {indentPx}px">
    {#if label}<span class="ve-label">{label}</span>{/if}
    <span class="text-xs text-editor-muted italic">null</span>
  </div>

{:else if value.kind === 'product'}
  {@const rt = resolvedType(type)}
  {#if rt.kind === 'product'}
    {#if label}
      <div class="ve-row ve-section-header" style="padding-left: {indentPx}px">
        <span class="ve-label">{label}</span>
        <span class="ve-badge">product</span>
        {#if isOptionalType(type)}
          <button class="ve-btn-sm ve-btn-danger" onclick={toggleOptional}>× clear</button>
        {/if}
      </div>
    {/if}
    {#each Object.entries(rt.fields) as [fieldId, field]}
      {@const fieldValue = value.fields[fieldId] ?? defaultValue(schema, field.type)}
      {@const fieldType = field.type.kind === 'optional' ? field.type : field.type}
      <ValueEditor
        {schema}
        {annotations}
        value={fieldValue}
        type={fieldType}
        label={annotationName(fieldId)}
        depth={depth + 1}
        onchange={(v) => updateProductField(fieldId, v)}
      />
    {/each}
  {/if}

{:else if value.kind === 'sum'}
  {@const rt = resolvedType(type)}
  {#if rt.kind === 'sum'}
    <div class="ve-row" style="padding-left: {indentPx}px">
      {#if label}<span class="ve-label">{label}</span>{/if}
      <select class="ve-select" value={value.tag} onchange={(e) => updateSumTag((e.target as HTMLSelectElement).value)}>
        {#each Object.keys(rt.variants) as variantId}
          <option value={variantId}>{annotationName(variantId)}</option>
        {/each}
      </select>
    </div>
    {#if value.payload !== null}
      {@const variant = rt.variants[value.tag]}
      {#if variant?.payload}
        <ValueEditor
          {schema}
          {annotations}
          value={value.payload}
          type={variant.payload}
          depth={depth + 1}
          onchange={updateSumPayload}
        />
      {/if}
    {/if}
  {/if}

{:else if value.kind === 'list'}
  {@const rt = resolvedType(type)}
  {#if rt.kind === 'list'}
    <div class="ve-row" style="padding-left: {indentPx}px">
      {#if label}<span class="ve-label">{label}</span>{/if}
      <span class="ve-badge">list</span>
      <span class="text-xs text-editor-muted">{value.elements.length} items</span>
      <button class="ve-btn-sm" onclick={addListItem}>+ add</button>
    </div>
    {#each value.elements as element, i}
      <div class="ve-list-item" style="padding-left: {indentPx + 16}px">
        <span class="text-[10px] text-editor-muted font-mono">[{i}]</span>
        <div class="flex-1">
          <ValueEditor
            {schema}
            {annotations}
            value={element}
            type={rt.element}
            depth={depth + 2}
            onchange={(v) => updateListItem(i, v)}
          />
        </div>
        <button class="ve-btn-sm ve-btn-danger" onclick={() => removeListItem(i)}>×</button>
      </div>
    {/each}
  {/if}

{:else if value.kind === 'map'}
  {@const rt = resolvedType(type)}
  {#if rt.kind === 'map'}
    <div class="ve-row" style="padding-left: {indentPx}px">
      {#if label}<span class="ve-label">{label}</span>{/if}
      <span class="ve-badge">map</span>
      <span class="text-xs text-editor-muted">{value.entries.length} entries</span>
      <button class="ve-btn-sm" onclick={addMapEntry}>+ add</button>
    </div>
    {#each value.entries as [key, val], i}
      <div class="ve-map-entry" style="padding-left: {indentPx + 16}px">
        <div class="ve-map-key">
          <span class="text-[10px] text-editor-muted">key:</span>
          <ValueEditor
            {schema}
            {annotations}
            value={key}
            type={rt.key}
            depth={depth + 2}
            onchange={(v) => updateMapKey(i, v)}
          />
        </div>
        <div class="ve-map-val">
          <span class="text-[10px] text-editor-muted">val:</span>
          <ValueEditor
            {schema}
            {annotations}
            value={val}
            type={rt.value}
            depth={depth + 2}
            onchange={(v) => updateMapValue(i, v)}
          />
        </div>
        <button class="ve-btn-sm ve-btn-danger" onclick={() => removeMapEntry(i)}>×</button>
      </div>
    {/each}
  {/if}
{/if}

<style>
  .ve-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    min-height: 32px;
  }
  .ve-section-header {
    padding-top: 8px;
  }
  .ve-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--editor-primary, #e2e8f0);
    min-width: 100px;
    flex-shrink: 0;
  }
  .ve-input {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 13px;
    color: var(--editor-primary, #e2e8f0);
    flex: 1;
    min-width: 0;
  }
  .ve-input:focus {
    outline: none;
    border-color: var(--editor-accent, #60a5fa);
  }
  .ve-select {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--editor-accent, #60a5fa);
    cursor: pointer;
  }
  .ve-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: var(--editor-muted, #94a3b8);
    font-weight: 500;
  }
  .ve-btn-sm {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--editor-accent, #60a5fa);
    border: 1px solid rgba(255, 255, 255, 0.12);
    cursor: pointer;
    white-space: nowrap;
  }
  .ve-btn-sm:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .ve-btn-danger {
    color: #f87171;
  }
  .ve-btn-danger:hover {
    background: rgba(248, 113, 113, 0.2);
  }
  .ve-checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  .ve-list-item, .ve-map-entry {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 2px 8px;
  }
  .ve-map-key, .ve-map-val {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }
</style>
