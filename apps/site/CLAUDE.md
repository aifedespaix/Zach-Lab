# Le site de la suite (`apps/site`) — instructions pour la personne qui dessine la vitrine

## Ce que c'est

Le site de la suite : un projet **Astro statique**. Deux choses y cohabitent : la
**vitrine** (`/`, sans JavaScript) et l'**application connectée** (`/login/`,
`/inscription/`, `/gestion/`, `/dashboard/`, `/eleves/`, `/compte/`,
`/bibliotheque/`), faite d'îlots React (`client:only`). Le build produit `dist/`,
servi par PocketBase (voir `infra/README_INFRA.md`).

## Votre périmètre

- **À vous** : `src/pages/index.astro`, `src/site/` (composants `.astro` de la
  vitrine) et les images sous `src/assets/`.
- **Hors périmètre** : `src/app/`, les autres pages `src/pages/*.astro`,
  `src/layouts/`, `astro.config.mjs`, `scripts/`, `infra/`. Ne les modifiez pas.

## Règles

- **Zéro JavaScript côté client** par défaut. La garde du build
  (`scripts/check-dist.mjs`) échoue si `dist/index.html` contient un `<script`.
- Tout ce qui est statique est un composant `.astro`. Un îlot (`client:*`) n'est
  permis que pour un vrai besoin d'interaction, jamais pour de la mise en page —
  et la garde le refusera sur la vitrine.
- Images : `astro:assets` (`<Image>`), toujours avec `width`, `height` et `alt`.
- Polices **auto-hébergées** : aucun appel à un CDN (Google Fonts, etc.).
- Style : Tailwind 4 avec les jetons de `src/styles/app.css` (ne les renommez
  pas, l'application connectée s'en sert) **ou** des blocs `<style>` scopés. La
  page de départ n'importe pas `app.css` : elle reste autonome.
- Accessibilité : titres hiérarchisés (un seul `h1`), contrastes AA,
  `prefers-reduced-motion` respecté, focus visible.
- Liens internes **toujours avec la barre finale** : `/login/`, pas `/login`.
- Aucun import depuis `src/app/` ni depuis `@suite/shared` ; aucun
  `@tauri-apps/*` nulle part dans ce projet.
- Interface en français.

## Commandes (depuis la racine du dépôt)

- `bun run --filter site dev` — serveur de développement, port **1460**.
- `bun run --filter site build` — `astro check`, `astro build`, puis la garde.
  Attendu : `✓ 7 routes + vitrine sans script`.
- `bun run --filter site test` — les tests du site.

## Skill

Une skill locale résume ces règles : `.claude/skills/astro-vitrine/SKILL.md`
(à la racine du dépôt). Aucune skill Astro tierce n'est installée ; si vous en
voulez une officielle, cherchez « astro » dans `/plugin` (Discover) et installez-la
vous-même.
