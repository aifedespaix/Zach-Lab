import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
// @ts-expect-error type error without @types/node package
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // @ts-expect-error type error without @types/node package
      '@': path.resolve(import.meta.dirname, './src'),
      // Le paquet ne publie que `index.js` (lecture par `fs`) : on veut les fichiers Hunspell bruts.
      // @ts-expect-error type error without @types/node package
      '@dictionary-fr': path.resolve(import.meta.dirname, './node_modules/dictionary-fr'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest replaces a stylesheet with an empty module; the test that guards the
    // @source line of index.css needs to read its real text.
    css: true,
  },
})
