import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

// Output the web assets directly into the VS Code extension's media folder.
// This removes the need to copy files between packages.
const outDir = path.resolve(__dirname, '../vscode-extension/media');

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir,
    emptyOutDir: true, // allow cleaning when outDir is outside project root
  },
});
