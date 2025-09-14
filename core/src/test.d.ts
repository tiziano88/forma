/// <reference types="jest" />
/// <reference types="node" />

// Extend Jest globals for TypeScript
declare global {
  namespace NodeJS {
    interface Global {
      jest: typeof import('@jest/globals').jest;
    }
  }
}