/**
 * Shim for Svelte 5 runes when running in Node.js CLI
 * StructuralEditor uses $state and $derived, which need to be mocked
 */

// Mock $state - just return the initial value
(global as any).$state = function (initialValue: any) {
  return initialValue;
};

// Mock $derived - call the computation function immediately
(global as any).$derived = function (computation: any) {
  return typeof computation === 'function' ? computation() : computation;
};

// Mock $derived.by - return empty string to avoid errors
(global as any).$derived.by = function (computation: () => any) {
  return '';
};

// Mock $effect - just call the function once
(global as any).$effect = function (fn: () => void) {
  // Don't execute effects in CLI - they're for reactivity
};
