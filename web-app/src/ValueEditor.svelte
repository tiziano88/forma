<script lang="ts">
  import type { Schema, Annotations, Type } from '@lintx/core';
  import type { Value } from '@lintx/core';
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
    /** For repeated (list) items, the index in the array. */
    arrayIndex?: number | null;
    showRemoveButton?: boolean;
    onremove?: () => void;
  }

  const {
    schema,
    annotations,
    value,
    type,
    onchange,
    depth = 0,
    label,
    arrayIndex = null,
    showRemoveButton = false,
    onremove,
  }: Props = $props();

  const headerHeight = 40;
  const top = $derived(depth * headerHeight);

  function annotationName(id: string): string {
    return annotations[id]?.name ?? id;
  }

  function annotationDoc(id: string): string | undefined {
    return annotations[id]?.doc;
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

  /** Check if the original type is optional (unwrapping refs). */
  function isOptionalType(t: Type): boolean {
    if (t.kind === 'optional') return true;
    if (t.kind === 'ref') {
      const resolved = resolveRef(schema, t.name);
      return resolved ? isOptionalType(resolved) : false;
    }
    return false;
  }

  /** Get the inner type of an optional (unwrapping refs). */
  function optionalInner(t: Type): Type {
    if (t.kind === 'optional') return t.inner;
    if (t.kind === 'ref') {
      const resolved = resolveRef(schema, t.name);
      return resolved ? optionalInner(resolved) : t;
    }
    return t;
  }

  /** Get a display string for the type pill. */
  function typePillLabel(t: Type): string {
    const rt = resolvedType(t);
    switch (rt.kind) {
      case 'primitive': return rt.primitive;
      case 'product': return t.kind === 'ref' ? annotationName(t.name) : 'product';
      case 'sum': return t.kind === 'ref' ? annotationName(t.name) : 'sum';
      case 'list': return 'repeated';
      case 'map': return 'map';
      case 'optional': return 'optional';
      case 'ref': return annotationName(rt.name);
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

  /** Does this value need a card wrapper (product, sum, list, map) or is it inline (primitives)? */
  function isComplex(v: Value): boolean {
    return v.kind === 'product' || v.kind === 'sum' || v.kind === 'list' || v.kind === 'map';
  }
</script>

<!-- ====== PRIMITIVE INLINE RENDERING (no card needed) ====== -->

{#if value.kind === 'string' && !label}
  <input
    type="text"
    class="input-editor"
    value={value.value}
    oninput={(e) => onchange({ kind: 'string', value: (e.target as HTMLInputElement).value })}
    placeholder="(empty string)"
  />

{:else if value.kind === 'bool' && !label}
  <label class="label-editor cursor-pointer">
    <input
      type="checkbox"
      checked={value.value}
      onchange={(e) => onchange({ kind: 'bool', value: (e.target as HTMLInputElement).checked })}
    />
    <span>{value.value ? 'true' : 'false'}</span>
  </label>

{:else if value.kind === 'int' && !label}
  <input
    type="number"
    class="input-editor"
    value={value.value}
    oninput={(e) => onchange({ kind: 'int', value: parseInt((e.target as HTMLInputElement).value) || 0 })}
  />

{:else if value.kind === 'float' && !label}
  <input
    type="number"
    step="any"
    class="input-editor"
    value={value.value}
    oninput={(e) => onchange({ kind: 'float', value: parseFloat((e.target as HTMLInputElement).value) || 0 })}
  />

<!-- ====== LABELLED FIELDS (wrapped in a field-card) ====== -->

{:else if value.kind === 'null' && isOptionalType(type)}
  <!-- Optional null: show a dashed placeholder card -->
  <div class="field-card field-card-placeholder">
    <div class="field-card-header field-card-header--sticky rounded-xl" style="top: {top}px; z-index: {20 - depth};">
      <div class="field-card-header-content">
        <span class="field-card-name">{label ?? ''}</span>
        {#if arrayIndex !== null}
          <span class="field-card-index">[{arrayIndex}]</span>
        {/if}
        <span class="field-card-type-pill">{isOptionalType(type) ? 'optional ' : ''}{typePillLabel(type)}</span>
        <div class="field-card-controls">
          <button class="btn-add" title="Set value" onclick={toggleOptional}>+</button>
          {#if showRemoveButton}
            <button class="btn-remove" title="Remove" onclick={onremove}>×</button>
          {/if}
        </div>
      </div>
    </div>
  </div>

{:else if value.kind === 'null'}
  <!-- Plain null (shouldn't normally happen) -->
  <div class="field-card field-card-placeholder">
    <div class="field-card-header rounded-xl">
      <div class="field-card-header-content">
        <span class="field-card-name">{label ?? 'null'}</span>
        <span class="field-card-type-pill">null</span>
      </div>
    </div>
  </div>

{:else if value.kind === 'string' && label}
  <div class="field-card">
    <div class="field-card-header field-card-header--sticky" style="top: {top}px; z-index: {20 - depth};">
      <div class="field-card-header-content">
        <span class="field-card-name">{label}</span>
        {#if arrayIndex !== null}<span class="field-card-index">[{arrayIndex}]</span>{/if}
        <span class="field-card-type-pill">{isOptionalType(type) ? 'optional ' : ''}string</span>
        <div class="field-card-controls">
          {#if isOptionalType(type)}
            <button class="btn-remove" title="Clear" onclick={toggleOptional}>×</button>
          {/if}
          {#if showRemoveButton}
            <button class="btn-remove" title="Remove" onclick={onremove}>×</button>
          {/if}
        </div>
      </div>
    </div>
    <div class="px-2.5 py-2.5">
      <input
        type="text"
        class="input-editor"
        value={value.value}
        oninput={(e) => onchange({ kind: 'string', value: (e.target as HTMLInputElement).value })}
        placeholder="(empty string)"
      />
    </div>
  </div>

{:else if value.kind === 'bool' && label}
  <div class="field-card">
    <div class="field-card-header field-card-header--sticky" style="top: {top}px; z-index: {20 - depth};">
      <div class="field-card-header-content">
        <span class="field-card-name">{label}</span>
        <span class="field-card-type-pill">{isOptionalType(type) ? 'optional ' : ''}bool</span>
        <div class="field-card-controls">
          {#if isOptionalType(type)}
            <button class="btn-remove" title="Clear" onclick={toggleOptional}>×</button>
          {/if}
          {#if showRemoveButton}
            <button class="btn-remove" title="Remove" onclick={onremove}>×</button>
          {/if}
        </div>
      </div>
    </div>
    <div class="px-2.5 py-2.5">
      <label class="label-editor cursor-pointer">
        <input
          type="checkbox"
          checked={value.value}
          onchange={(e) => onchange({ kind: 'bool', value: (e.target as HTMLInputElement).checked })}
        />
        <span>{value.value ? 'true' : 'false'}</span>
      </label>
    </div>
  </div>

{:else if (value.kind === 'int' || value.kind === 'float') && label}
  <div class="field-card">
    <div class="field-card-header field-card-header--sticky" style="top: {top}px; z-index: {20 - depth};">
      <div class="field-card-header-content">
        <span class="field-card-name">{label}</span>
        <span class="field-card-type-pill">{isOptionalType(type) ? 'optional ' : ''}{value.kind === 'int' ? 'integer' : 'float'}</span>
        <div class="field-card-controls">
          {#if isOptionalType(type)}
            <button class="btn-remove" title="Clear" onclick={toggleOptional}>×</button>
          {/if}
          {#if showRemoveButton}
            <button class="btn-remove" title="Remove" onclick={onremove}>×</button>
          {/if}
        </div>
      </div>
    </div>
    <div class="px-2.5 py-2.5">
      <input
        type="number"
        step={value.kind === 'float' ? 'any' : undefined}
        class="input-editor"
        value={value.value}
        oninput={(e) => {
          const raw = (e.target as HTMLInputElement).value;
          onchange(value.kind === 'int'
            ? { kind: 'int', value: parseInt(raw) || 0 }
            : { kind: 'float', value: parseFloat(raw) || 0 });
        }}
      />
    </div>
  </div>

{:else if value.kind === 'bytes'}
  <div class="field-card">
    <div class="field-card-header field-card-header--sticky rounded-xl" style="top: {top}px; z-index: {20 - depth};">
      <div class="field-card-header-content">
        <span class="field-card-name">{label ?? 'bytes'}</span>
        <span class="field-card-type-pill">bytes</span>
        <span class="text-editor-muted text-xs">{value.value.length} bytes</span>
      </div>
    </div>
  </div>

{:else if value.kind === 'product'}
  {@const rt = resolvedType(type)}
  {#if rt.kind === 'product'}
    <div class="field-card">
      <div class="field-card-header field-card-header--sticky" style="top: {top}px; z-index: {20 - depth};">
        <div class="field-card-header-content">
          <span class="field-card-name">{label ?? ''}</span>
          {#if arrayIndex !== null}<span class="field-card-index">[{arrayIndex}]</span>{/if}
          <span class="field-card-type-pill">{typePillLabel(type)}</span>
          <div class="field-card-controls">
            {#if isOptionalType(type)}
              <button class="btn-remove" title="Clear" onclick={toggleOptional}>×</button>
            {/if}
            {#if showRemoveButton}
              <button class="btn-remove" title="Remove" onclick={onremove}>×</button>
            {/if}
          </div>
        </div>
      </div>
      <div class="px-2.5 py-2.5 space-y-2">
        {#each Object.entries(rt.fields) as [fieldId, field]}
          {@const fieldValue = value.fields[fieldId] ?? defaultValue(schema, field.type)}
          <ValueEditor
            {schema}
            {annotations}
            value={fieldValue}
            type={field.type}
            label={annotationName(fieldId)}
            depth={depth + 1}
            onchange={(v) => updateProductField(fieldId, v)}
          />
        {/each}
      </div>
    </div>
  {/if}

{:else if value.kind === 'sum'}
  {@const rt = resolvedType(type)}
  {#if rt.kind === 'sum'}
    <div class="field-card">
      <div class="field-card-header field-card-header--sticky" style="top: {top}px; z-index: {20 - depth};">
        <div class="field-card-header-content">
          <span class="field-card-name">{label ?? ''}</span>
          {#if arrayIndex !== null}<span class="field-card-index">[{arrayIndex}]</span>{/if}
          <span class="field-card-type-pill">{typePillLabel(type)}</span>
          <div class="field-card-controls">
            {#if showRemoveButton}
              <button class="btn-remove" title="Remove" onclick={onremove}>×</button>
            {/if}
          </div>
        </div>
      </div>
      <div class="px-2.5 py-2.5 space-y-2">
        <select
          class="select-editor"
          value={value.tag}
          onchange={(e) => updateSumTag((e.target as HTMLSelectElement).value)}
        >
          {#each Object.keys(rt.variants) as variantId}
            <option value={variantId}>{annotationName(variantId)}</option>
          {/each}
        </select>
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
      </div>
    </div>
  {/if}

{:else if value.kind === 'list'}
  {@const rt = resolvedType(type)}
  {#if rt.kind === 'list'}
    <div class="field-card">
      <div class="field-card-header field-card-header--sticky" style="top: {top}px; z-index: {20 - depth};">
        <div class="field-card-header-content">
          <span class="field-card-name">{label ?? ''}</span>
          <span class="field-card-type-pill">repeated {typePillLabel(rt.element)}</span>
          <span class="text-editor-muted text-xs">{value.elements.length} items</span>
          <div class="field-card-controls">
            <button class="btn-add" title="Add item" onclick={addListItem}>+</button>
            {#if showRemoveButton}
              <button class="btn-remove" title="Remove" onclick={onremove}>×</button>
            {/if}
          </div>
        </div>
      </div>
      <div class="px-2.5 py-2.5">
        {#if value.elements.length === 0}
          <div class="empty-state">No items. Click + to add one.</div>
        {:else}
          <div class="repeated-list">
            {#each value.elements as element, i}
              <ValueEditor
                {schema}
                {annotations}
                value={element}
                type={rt.element}
                label={annotationName(rt.element.kind === 'ref' ? rt.element.name : '')}
                arrayIndex={i}
                depth={depth + 1}
                showRemoveButton={true}
                onremove={() => removeListItem(i)}
                onchange={(v) => updateListItem(i, v)}
              />
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

{:else if value.kind === 'map'}
  {@const rt = resolvedType(type)}
  {#if rt.kind === 'map'}
    <div class="field-card">
      <div class="field-card-header field-card-header--sticky" style="top: {top}px; z-index: {20 - depth};">
        <div class="field-card-header-content">
          <span class="field-card-name">{label ?? 'map'}</span>
          <span class="field-card-type-pill">map</span>
          <span class="text-editor-muted text-xs">{value.entries.length} entries</span>
          <div class="field-card-controls">
            <button class="btn-add" title="Add entry" onclick={addMapEntry}>+</button>
          </div>
        </div>
      </div>
      <div class="px-2.5 py-2.5">
        {#if value.entries.length === 0}
          <div class="empty-state">No entries. Click + to add one.</div>
        {:else}
          <div class="repeated-list">
            {#each value.entries as [key, val], i}
              <div class="field-card">
                <div class="field-card-header">
                  <div class="field-card-header-content">
                    <span class="field-card-index">[{i}]</span>
                    <div class="field-card-controls">
                      <button class="btn-remove" title="Remove" onclick={() => removeMapEntry(i)}>×</button>
                    </div>
                  </div>
                </div>
                <div class="px-2.5 py-2.5 space-y-2">
                  <ValueEditor
                    {schema}
                    {annotations}
                    value={key}
                    type={rt.key}
                    label="key"
                    depth={depth + 2}
                    onchange={(v) => updateMapKey(i, v)}
                  />
                  <ValueEditor
                    {schema}
                    {annotations}
                    value={val}
                    type={rt.value}
                    label="value"
                    depth={depth + 2}
                    onchange={(v) => updateMapValue(i, v)}
                  />
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}
