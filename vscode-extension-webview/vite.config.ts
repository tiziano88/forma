import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: path.resolve(__dirname, '../vscode-extension/media'),
    emptyOutDir: true,
  }
})
