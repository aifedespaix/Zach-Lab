---
name: astro-vitrine
description: Règles Astro pour la vitrine de la suite (apps/site) : zéro JavaScript, images optimisées, îlots seulement si nécessaire
---

# Vitrine de la suite (`apps/site`)

Résumé de `apps/site/CLAUDE.md`, qui fait foi. À lire avant de toucher à la
vitrine.

- Périmètre : `apps/site/src/pages/index.astro`, `apps/site/src/site/`,
  `apps/site/src/assets/`. Rien d'autre (`src/app/`, autres pages,
  `astro.config.mjs`, `scripts/`).
- Zéro JavaScript côté client : pas de `<script>`, pas d'îlot `client:*` sauf
  vrai besoin d'interaction (jamais pour la mise en page). La garde
  `scripts/check-dist.mjs` fait échouer le build sinon.
- Composants `.astro` pour tout le statique.
- Images via `astro:assets` (`<Image>`) avec `width`, `height`, `alt`.
- Polices auto-hébergées, aucun CDN.
- Styles : Tailwind 4 avec les jetons de `src/styles/app.css` (sans les
  renommer) ou `<style>` scopé.
- Titres hiérarchisés, contrastes AA, `prefers-reduced-motion`, focus visible.
- Liens internes avec la barre finale (`/login/`).
- Pas d'import de `src/app/`, de `@suite/shared` ni de `@tauri-apps/*`.
- Vérifier : `bun run --filter site build` doit afficher
  `✓ 7 routes + vitrine sans script`.
