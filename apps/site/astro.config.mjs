import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import process from 'node:process'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'

/**
 * Le site de la suite, servi par PocketBase depuis `/pb_public`.
 *
 * `trailingSlash: 'always'` : chaque route est un dossier avec son `index.html`
 * (`/login/index.html`). Avec une barre finale, PocketBase trouve le fichier ;
 * sans elle, son repli (`indexFallback`) renverrait la vitrine. Tous les liens
 * internes se terminent donc par `/`.
 */
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  integrations: [react()],
  server: { port: 1460 },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src/app'),
        // Le code PUR de Mentale (types des cartes, validation), réservé à
        // `src/app/bibliotheque/` (voir src/boundary.test.ts). Dette de
        // transition, levée au lot S9 du chantier Synchro.
        '@app': path.resolve(import.meta.dirname, '../zachart-mentale/src'),
      },
    },
    server: {
      // Même topologie qu'en production (même origine, zéro CORS).
      // `^/_/` et non `/_` : Astro sert ses propres fichiers sous `/_astro/`.
      proxy: {
        '/api': { target: PB_URL, changeOrigin: true },
        '^/_/': { target: PB_URL, changeOrigin: true },
      },
    },
  },
})
