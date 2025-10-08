// Mock Svelte 5 runes for Jest
global.$state = function (initialValue) {
  return initialValue;
};

global.$derived = function (computation) {
  return typeof computation === 'function' ? computation() : computation;
};

// Don't execute the computation immediately - just return a placeholder
// The real Svelte compiler handles this differently, but for tests we just need
// the properties to exist without throwing errors
global.$derived.by = function (computation) {
  // Return an empty value that won't cause test failures
  // Tests don't actually need the hex view functionality
  return '';
};
