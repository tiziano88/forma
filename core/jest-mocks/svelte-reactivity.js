// Mock for svelte/reactivity in Jest tests
// Provides simple Map/Set implementations for testing

class SvelteMap extends Map {
  constructor(...args) {
    super(...args);
  }
}

class SvelteSet extends Set {
  constructor(...args) {
    super(...args);
  }
}

module.exports = {
  SvelteMap,
  SvelteSet,
};
