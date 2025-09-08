<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import * as protobuf from 'protobufjs';
  import ObjectViewer from './ObjectViewer.svelte';
  import PrimitiveInput from './PrimitiveInput.svelte';
  import RepeatedFieldViewer from './RepeatedFieldViewer.svelte';

  export let parent: any;
  export let key: string | number;
  export let type: protobuf.Type | undefined;

  const dispatch = createEventDispatcher();

  $: value = parent[key];
  $: field = type ? type.fields[key.toString()] : undefined;
  $: valueType = (field?.resolvedType) as protobuf.Type | undefined;

  function isObject(val: any) {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  function createDefaultObject(messageType: protobuf.Type) {
    return (messageType as any).toObject({}, { defaults: true, enums: String });
  }

  function addOptionalField() {
    if (!valueType) return;
    parent[key] = createDefaultObject(valueType);
    dispatch('change');
  }

  function handleChange() {
    dispatch('change');
  }
</script>

<div class="rounded-lg border-2 border-primary/20 overflow-hidden">
  <div class="bg-base-300 px-3 py-1">
    <label class="label-text font-bold text-primary" for={key.toString()}>{key}</label>
  </div>
  <div class="p-2 bg-base-100">
    {#if field?.repeated}
      <RepeatedFieldViewer bind:items={parent[key]} {field} on:change={handleChange} />
    {:else if valueType && isObject(value)}
      <ObjectViewer bind:object={value} type={valueType} on:change={handleChange} />
    {:else if valueType && value === undefined}
      <button class="btn btn-xs btn-outline btn-accent" on:click={addOptionalField}>+ Add {key}</button>
    {:else if field?.resolvedType instanceof protobuf.Enum}
      <select class="select select-sm select-bordered w-full" bind:value={parent[key]} id={key.toString()} on:change={handleChange}>
        {#each Object.keys(field.resolvedType.values) as enumName}
          <option value={enumName}>{enumName}</option>
        {/each}
      </select>
    {:else if field}
      <PrimitiveInput bind:value={parent[key]} type={field.type} id={key.toString()} on:change={handleChange} />
    {/if}
  </div>
</div>
