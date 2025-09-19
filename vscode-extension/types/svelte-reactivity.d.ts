declare module 'svelte/reactivity' {
  class ReactiveMap<K, V> extends Map<K, V> {}
  class ReactiveSet<T> extends Set<T> {}

  export { ReactiveMap as SvelteMap, ReactiveSet as SvelteSet };
}
