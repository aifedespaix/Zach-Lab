# Site de la suite (comptes, gestion, dashboard, vitrine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un site Astro unique (`apps/site/`) servi par PocketBase : vitrine statique `/`, connexion, inscription des profs par code, `/gestion` (admin), `/dashboard`, `/eleves`, `/compte`, `/bibliotheque` (l'admin web actuel).

**Architecture:** `infra/` passe à la racine. `apps/site` est un projet Astro en sortie statique : une page `.astro` par route, chaque page connectée monte un îlot React `client:only`. L'admin PocketBase actuel est déplacé dans `src/app/bibliotheque/`. L'admin du site est le superutilisateur PocketBase (jeton dans le navigateur) ; l'inscription par code passe par un hook `pb_hooks` ; les droits des profs sur leurs élèves sont des règles de collection.

**Tech Stack:** Astro (static) + `@astrojs/react`, React 19, Tailwind 4, PocketBase JS SDK 0.28, PocketBase 0.40.3 (JSVM hooks), Vitest, Bun workspaces, Docker.

**Spec:** `docs/superpowers/specs/2026-10-10-site-comptes-design.md` (lire avant d'exécuter).

## Global Constraints

- Image PocketBase épinglée : `ghcr.io/muchobien/pocketbase:0.40.3`. Ne pas changer.
- Port de dev du site : **1460**. `trailingSlash: 'always'` ; tous les liens internes se terminent par `/` (`/gestion/`).
- La vitrine (`src/pages/index.astro`, `src/site/`) n'émet **aucun** `<script>` et n'importe rien de `src/app/`.
- `apps/site` n'importe aucun `@tauri-apps/*`, aucune autre app, et aucun sous-chemin de `@suite/shared` hors `ui`, `theme`, `search`. Seule exception : l'alias `@app` (code pur de Mentale) est permis **uniquement** sous `src/app/bibliotheque/`.
- Alphabet des codes : `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 caractères, sans `0 O 1 I L`), longueur 10.
- Message unique de refus d'un code : `Code invalide ou expiré.` (jamais d'indice sur la cause).
- Mot de passe : au moins 10 caractères. Identifiant : `^[a-zA-Z0-9_.-]+$`, 1 à 64 caractères à l'inscription.
- Le seul compte admin est le superutilisateur PocketBase (`PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`). Aucune variable d'environnement nouvelle.
- Un prof ne peut jamais lire ni modifier les élèves d'un autre prof, ni changer son propre `role`, `teacher` ou `invite_code`.
- Interface en français ; commentaires de code en français, dans le style du dépôt (expliquer le POURQUOI).
- Ne jamais renommer une clé `localStorage` ni un id de commande existants. Ne jamais `git add -A` : toujours des chemins explicites (`infra/.env` contient des identifiants).

## Review Focus

Entrées que la spec implique mais qu'aucune tâche « évidente » ne teste ; chacune a un test dans la tâche indiquée.

- Deux inscriptions simultanées sur un code `unique` : une seule doit réussir (Task 6, S7).
- Identifiant déjà pris avec un code valide : l'inscription échoue **sans consommer** le code (Task 6, S5).
- Code saisi avec espaces, tirets ou en minuscules : accepté après normalisation (Task 5, Task 6 S4).
- Code qui expire à l'instant exact `now`, et `duree` sans `expires_at` : expirés (Task 5, fixture).
- Date PocketBase au format `2026-10-10 12:00:00.000Z` (espace, pas `T`) : lue correctement dans le hook (Task 5).
- Prof A modifie, lit ou supprime un élève du prof B : refusé ; prof A tente de se promouvoir : refusé (Task 6, S8).
- Supprimer un prof qui a encore des élèves : refusé, y compris par le superutilisateur (Task 6, S8).
- Activer la limitation de débit ne doit pas brider le trafic de synchronisation existant (règles par défaut de PocketBase) (Task 7).
- Élève qui se connecte sur `/login/` : déconnecté avec un message, pas de page cassée (Task 8).
- `?code=` absurde dans l'URL d'inscription (très long, caractères spéciaux) : champ prérempli proprement, pas de crash (Task 8).
- Admin sur `/compte/` : ne peut pas changer son mot de passe (il serait écrasé au redémarrage du conteneur par `infra/.env`) (Task 12).
- Code révoqué entre le chargement de la page et l'envoi du formulaire : refus propre (Task 6, S3).

## File Structure

```
infra/                          (déplacé depuis apps/zachart-mentale/infra, Task 1)
  pb_hooks/
    lib/inviteCode.js           logique pure des codes (CommonJS, ES2015 : tourne dans goja)
    inscription.pb.js           POST /api/inscription
    users.pb.js                 refuse la suppression d'un prof qui a des élèves
  fixtures/invite-code-states.json   table de cas partagée hook ↔ site
  integration.mjs               scénarios contre un vrai PocketBase
  pocketbase-schema.mjs         + invite_codes, + champs/règles de users, + planRateLimits
apps/site/
  package.json  astro.config.mjs  tsconfig.json  vitest.config.ts  CLAUDE.md
  scripts/check-dist.mjs        garde du build (routes présentes, vitrine sans <script>)
  src/pages/*.astro             index + 7 routes connectées
  src/layouts/AppPage.astro
  src/styles/app.css            (ex admin/src/index.css)
  src/site/                     composants de la vitrine (designer)
  src/app/
    ui/primitives.tsx           (ex admin/components/ui)
    lib/inviteCode.ts           jumeau TypeScript de inviteCode.js
    session/{pb,session,guards}.ts
    shell/{AppShell,Protected,nav}.tsx
    login/LoginPage.tsx  inscription/{InscriptionPage,validateSignup}.ts(x)
    gestion/{api,summaries}.ts  gestion/{GestionPage,ProfsTab,ElevesTab,CodesTab}.tsx
    dashboard/DashboardPage.tsx  eleves/ElevesPage.tsx  compte/ComptePage.tsx
    bibliotheque/               l'admin actuel
```

Branche et isolation : exécuter dans un worktree (`superpowers:using-git-worktrees`) créé depuis `main`, par exemple `.worktrees/site-comptes`. Le dépôt principal a des modifications non committées (dont `CLAUDE.md`) : ne pas les mélanger.

---

### Task 1: Déplacer `infra/` à la racine (commit isolé)

**Files:**
- Move: `apps/zachart-mentale/infra/` → `infra/`
- Modify: `package.json`, `.gitignore`, `.dockerignore`, `infra/docker-compose.yml`, `infra/Dockerfile`, `infra/Dockerfile.schema`, `infra/README_INFRA.md`, `.github/workflows/infra-pocketbase.yml`, `.github/workflows/build.yml` (seulement s'il cite `infra`)

**Interfaces:**
- Produces: scripts racine `infra:plan`, `infra:apply`, `infra:check`, `test:infra`, `test:all`. Les tâches suivantes lancent les tests d'infra avec `bun run test:infra`.

- [ ] **Step 1: Relever la base de référence**

```bash
cd apps/zachart-mentale && bunx vitest run infra 2>&1 | tail -8
```
Noter le nombre de fichiers et de tests qui passent (appelé `N_INFRA` plus bas). Ces tests tournent aujourd'hui dans la suite de Mentale parce que `infra/` est sous sa racine ; après le déplacement ils n'y seront plus.

- [ ] **Step 2: Déplacer le dossier**

```bash
cd <racine du worktree>
git mv apps/zachart-mentale/infra infra
```
Si `infra/.env` existe dans le dépôt principal mais pas dans le worktree, c'est normal (gitignoré) : ne pas le recopier dans un commit.

- [ ] **Step 3: Lister toutes les références à l'ancien chemin**

```bash
grep -rn "zachart-mentale/infra\|apps/\*/infra\|context: \.\./\.\./\.\." \
  .github .gitignore .dockerignore package.json infra scripts \
  --include=* 2>/dev/null | grep -v node_modules
```
Corriger chaque occurrence comme suit :

| Fichier | Avant | Après |
|---|---|---|
| `package.json` | `bun run apps/zachart-mentale/infra/setup-pocketbase.mjs --dry-run` | `bun run infra/setup-pocketbase.mjs --dry-run` |
| `.gitignore` lignes 47 et 50 | `apps/*/infra/.env`, `apps/*/infra/backups/` | `infra/.env`, `infra/backups/` |
| `.dockerignore` lignes 26-27 | `apps/*/infra/backups/`, `apps/*/infra/.env` | `infra/backups/`, `infra/.env` |
| `infra/docker-compose.yml` | `context: ../../..` et `dockerfile: apps/zachart-mentale/infra/Dockerfile` (deux fois, avec `Dockerfile.schema`) | `context: ..` et `dockerfile: infra/Dockerfile` (resp. `infra/Dockerfile.schema`) |
| `infra/Dockerfile.schema` | `COPY apps/zachart-mentale/infra ./infra` | `COPY infra ./infra` |
| `infra/Dockerfile` | `COPY apps/zachart-mentale/admin …` : **ne pas toucher** (Task 3) | — |
| `.github/workflows/infra-pocketbase.yml` | chaque `apps/zachart-mentale/infra` | `infra` (y compris dans `paths:` et dans le `grep -oP … apps/zachart-mentale/infra/Dockerfile`) |
| `infra/README_INFRA.md` | encadré « Où lancer ces commandes » | « Ce dossier est `infra/`, à la racine du dépôt. » |

Dans `infra/docker-compose.yml`, mettre à jour le commentaire qui dit que le contexte « a besoin de `admin/` et de `src/` ».

- [ ] **Step 4: Ajouter les scripts racine**

Dans `package.json`, section `scripts` :

```json
"infra:plan": "bun run infra/setup-pocketbase.mjs --dry-run",
"infra:apply": "bun run infra/setup-pocketbase.mjs",
"infra:check": "bun run infra/setup-pocketbase.mjs --check",
"test:infra": "vitest run --root infra",
"test:all": "bun run test && bun run test:infra && bun run test:scripts",
```

- [ ] **Step 5: Vérifier**

```bash
bun run test:infra 2>&1 | tail -8
```
Expected : même nombre de fichiers et de tests que `N_INFRA`. Si `vitest` n'est pas résolu depuis la racine, lancer `bun install` d'abord ; s'il l'est mal (mauvaise version), remplacer par `bunx --bun vitest run --root infra` et noter la commande retenue dans `infra/README_INFRA.md`.

```bash
bun run infra/setup-pocketbase.mjs --help | head -5
PB_ADMIN_EMAIL=a@b.c PB_ADMIN_PASSWORD=x docker compose -f infra/docker-compose.yml config > /dev/null && echo compose-ok
bun run --filter zachart-mentale test 2>&1 | tail -5
```
Expected : l'aide s'affiche, `compose-ok`, la suite de Mentale passe (elle compte désormais `N_INFRA` tests de moins : c'est attendu).

- [ ] **Step 6: Commit (isolé)**

```bash
git add -A infra package.json .gitignore .dockerignore .github
git status --short   # vérifier : uniquement des renommages et ces fichiers
git commit -m "refactor(infra): déplace infra/ à la racine (sert toute la suite)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(`git add -A` est ici limité par les chemins donnés ; ne pas l'utiliser sans chemins.)

---

### Task 2: Squelette Astro et vérification du service des routes par PocketBase

**Files:**
- Create: `apps/site/package.json`, `apps/site/astro.config.mjs`, `apps/site/tsconfig.json`, `apps/site/scripts/check-dist.mjs`
- Create: `apps/site/src/layouts/AppPage.astro`, `apps/site/src/pages/{index,login,inscription,gestion,dashboard,eleves,compte,bibliotheque}.astro`, `apps/site/src/app/Placeholder.tsx`, `apps/site/src/styles/app.css`
- Test: `apps/site/scripts/check-dist.mjs` (garde exécutée par `build`)

**Interfaces:**
- Produces: `AppPage.astro` (props `title: string`) ; les tâches suivantes remplacent `<Placeholder client:only="react" />` par leur îlot. `apps/site/scripts/check-dist.mjs` échoue si une route manque ou si la vitrine contient `<script`.

- [ ] **Step 1: Créer le workspace**

`apps/site/package.json` :

```json
{
  "name": "site",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build && node scripts/check-dist.mjs",
    "preview": "astro preview",
    "test": "vitest run"
  }
}
```
Puis, depuis `apps/site` :

```bash
bun add astro @astrojs/react @astrojs/check react react-dom lucide-react pocketbase zustand tailwindcss @tailwindcss/vite
bun add -d typescript @types/react @types/react-dom vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom
```
Relever les versions installées (Astro et `@astrojs/react` doivent être compatibles avec React 19 et Vite 8 ; si `astro check` ou `astro dev` se plaignent d'une version de Vite, suivre le message et aligner).

- [ ] **Step 2: Configuration Astro**

`apps/site/astro.config.mjs` :

```js
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
```

`apps/site/tsconfig.json` :

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src", "scripts", "*.mjs", "vitest.config.ts"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["./src/app/*"],
      "@app/*": ["../zachart-mentale/src/*"]
    }
  }
}
```

- [ ] **Step 3: Layout, pages, îlot provisoire**

`apps/site/src/styles/app.css` : pour l'instant `@import 'tailwindcss';` (le thème de l'admin y est déplacé en Task 3).

`apps/site/src/layouts/AppPage.astro` :

```astro
---
import '../styles/app.css'
interface Props {
  title: string
}
const { title } = Astro.props
---
<!doctype html>
<html lang="fr" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0b0f19" />
    <meta name="robots" content="noindex" />
    <title>{title} · Zachar’t</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

`apps/site/src/app/Placeholder.tsx` :

```tsx
export function Placeholder({ name }: { name: string }) {
  return <main className="p-6 text-ink-100">{name}</main>
}
```

Chaque page connectée (`login`, `inscription`, `gestion`, `dashboard`, `eleves`, `compte`, `bibliotheque`), par exemple `gestion.astro` :

```astro
---
import AppPage from '../layouts/AppPage.astro'
import { Placeholder } from '../app/Placeholder'
---
<AppPage title="Gestion">
  <Placeholder name="gestion" client:only="react" />
</AppPage>
```
`index.astro` (vitrine provisoire, sans îlot ni script) :

```astro
---
---
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zachar’t</title>
  </head>
  <body>
    <h1>Zachar’t</h1>
    <p><a href="/login/">Se connecter</a></p>
  </body>
</html>
```

- [ ] **Step 4: La garde du build**

`apps/site/scripts/check-dist.mjs` :

```js
// Garde du build : le site doit contenir chaque route, et la vitrine ne doit
// embarquer AUCUN script — c'est la promesse faite à la personne qui la dessine.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const routes = ['login', 'inscription', 'gestion', 'dashboard', 'eleves', 'compte', 'bibliotheque']

const problems = []
for (const route of routes) {
  if (!existsSync(join(dist, route, 'index.html'))) problems.push(`route absente : /${route}/`)
}
const landing = join(dist, 'index.html')
if (!existsSync(landing)) problems.push('vitrine absente : /')
else if (/<script/i.test(readFileSync(landing, 'utf8'))) {
  problems.push('la vitrine contient un <script> : elle doit rester sans JavaScript')
}

if (problems.length > 0) {
  console.error(problems.map(line => `✗ ${line}`).join('\n'))
  process.exit(1)
}
console.log(`✓ ${routes.length} routes + vitrine sans script`)
```

- [ ] **Step 5: Construire et vérifier**

```bash
bun install
bun run --filter site build
```
Expected : `✓ 7 routes + vitrine sans script`.

- [ ] **Step 6: Vérifier le service par PocketBase (la question à lever en premier)**

```bash
docker run --rm -d --name pbspike -p 8091:8090 \
  -e PB_ADMIN_EMAIL=a@b.test -e PB_ADMIN_PASSWORD=MotDePasse1234! \
  -v "$(pwd)/apps/site/dist:/pb_public:ro" ghcr.io/muchobien/pocketbase:0.40.3
sleep 6
for p in / /login/ /login /gestion/ /api/health; do
  printf '%s -> ' "$p"; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "http://localhost:8091$p"
done
curl -s http://localhost:8091/login/ | grep -o '<title>[^<]*'
curl -s http://localhost:8091/login | grep -o '<title>[^<]*'
docker rm -f pbspike
```
Expected avec les liens finissant par `/` : `/login/` → `200` et `<title>Login · Zachar’t` ; `/` → la vitrine.
**Règle de décision pour `/login` sans barre finale :**
- Si elle renvoie la page de login ou une redirection vers `/login/` : rien à faire.
- Si elle renvoie la vitrine (repli) : ajouter dans `infra/pb_hooks/redirects.pb.js` une redirection par route (`routerAdd('GET', '/login', (e) => e.redirect(307, '/login/'))`, une ligne par route connectée), copiée dans l'image en Task 6.
- Si `/login/` lui-même renvoie la vitrine : **arrêter** et remonter à l'utilisateur ; la structure des routes doit changer (spec §1, risque annoncé).
Noter le résultat dans `docs/superpowers/specs/2026-10-10-site-comptes-design.md` §1 (une phrase).

- [ ] **Step 7: Commit**

```bash
git add apps/site bun.lock docs/superpowers/specs/2026-10-10-site-comptes-design.md
git commit -m "feat(site): squelette Astro, 8 routes, garde de build

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Déplacer l'admin actuel dans `/bibliotheque`

**Files:**
- Move: `apps/zachart-mentale/admin/src/**` → `apps/site/src/app/bibliotheque/**` (sauf `main.tsx`, `index.css`, `components/ui`, `test/setup.ts`, `boundary.test.ts`)
- Move: `admin/src/components/ui` → `apps/site/src/app/ui` ; `admin/src/test/setup.ts` → `apps/site/src/test/setup.ts` ; `admin/src/index.css` → `apps/site/src/styles/app.css` ; `admin/README.md` → `apps/site/src/app/bibliotheque/README.md`
- Delete: `admin/{package.json,bun.lock,index.html,vite.config.ts,vitest.config.ts,tsconfig.json}` (le dossier `admin/` disparaît)
- Create: `apps/site/vitest.config.ts`, `apps/site/src/boundary.test.ts`
- Modify: `apps/site/src/pages/bibliotheque.astro`, `infra/Dockerfile`, `.github/workflows/build.yml`, `apps/zachart-mentale/vitest.config.ts`

**Interfaces:**
- Produces: `BibliothequeApp` (export de `src/app/bibliotheque/BibliothequeApp.tsx`) ; primitives importables par `@/ui/primitives` (`Button`, `IconButton`, `Field`, `inputClass`, `Badge`, `Spinner`, `EmptyState`, `ErrorBanner`, `Sheet`).

- [ ] **Step 1: Baseline**

```bash
cd apps/zachart-mentale/admin && bun install && bun run test 2>&1 | tail -6
```
Noter le nombre de tests (`N_ADMIN`).

- [ ] **Step 2: Déplacer les fichiers**

```bash
cd <racine>
mkdir -p apps/site/src/app apps/site/src/test
git mv apps/zachart-mentale/admin/src/components/ui apps/site/src/app/ui
git mv apps/zachart-mentale/admin/src/test/setup.ts apps/site/src/test/setup.ts
git mv apps/zachart-mentale/admin/src/boundary.test.ts apps/site/src/boundary.test.ts
git mv apps/zachart-mentale/admin/src/index.css apps/site/src/styles/app.css   # écrase le contenu provisoire
git mv apps/zachart-mentale/admin/README.md apps/site/src/app/bibliotheque-README.md
mkdir -p apps/site/src/app/bibliotheque
for entry in apps/zachart-mentale/admin/src/*; do
  case "$entry" in */main.tsx|*/vite-env.d.ts) ;; *) git mv "$entry" apps/site/src/app/bibliotheque/ ;; esac
done
git mv apps/site/src/app/bibliotheque-README.md apps/site/src/app/bibliotheque/README.md
git mv apps/site/src/app/bibliotheque/App.tsx apps/site/src/app/bibliotheque/BibliothequeApp.tsx
git rm -q apps/zachart-mentale/admin/src/main.tsx apps/zachart-mentale/admin/src/vite-env.d.ts \
  apps/zachart-mentale/admin/index.html apps/zachart-mentale/admin/vite.config.ts \
  apps/zachart-mentale/admin/vitest.config.ts apps/zachart-mentale/admin/tsconfig.json \
  apps/zachart-mentale/admin/package.json apps/zachart-mentale/admin/bun.lock
ls apps/zachart-mentale/admin 2>/dev/null   # doit être vide ou absent (supprimer node_modules à la main)
```

- [ ] **Step 3: Réécrire les imports**

L'alias `@` désigne maintenant `src/app/` (et non plus l'ancien `src/` de l'admin).

```bash
cd apps/site/src/app
grep -rlE "from '@/|vi\.mock\('@/|import\('@/" bibliotheque | xargs sed -i -E "s#(from |vi\.mock\(|import\()'@/ui/#\1'@/ui/#; s#(from |vi\.mock\(|import\()'@/components/ui/#\1'@/ui/#; s#(from |vi\.mock\(|import\()'@/(lib|components|state)/#\1'@/bibliotheque/\2/#"
grep -rn "components/ui\|'\./ui/\|\"\./ui/" bibliotheque | head   # imports relatifs vers ui à corriger à la main
```
Corriger à la main tout import relatif de `./ui/primitives` ou `../ui/primitives` vers `@/ui/primitives`.
Dans `BibliothequeApp.tsx`, renommer `export function App()` en `export function BibliothequeApp()`.

Fusionner l'en-tête de `apps/site/src/styles/app.css` : le fichier est l'ancien `index.css` (thème `ink-*`, `accent`, utilitaires `tap`, `safe-top`…). Il contient déjà `@import 'tailwindcss';` en tête : rien d'autre à changer.

- [ ] **Step 4: Config de test et frontière**

`apps/site/vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src/app'),
      '@app': path.resolve(import.meta.dirname, '../zachart-mentale/src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Dans `apps/site/src/boundary.test.ts`, adapter l'existant :
1. `ALLOWED_SHARED` reste `ui, theme, search`.
2. Ajouter, dans `violations(source, path)`, une règle d'alias : un specifier commençant par `@app/` n'est permis que si `path` commence par `./app/bibliotheque/`.
3. Interdire tout specifier contenant `zachart-mentale/`, `zachart-maths/` ou `apps/` (import d'une app par chemin).
4. Interdire à `./site/` et `./pages/index.astro` (la vitrine) tout import depuis `app/`.
Tests de la règle (à ajouter au `describe` du détecteur) :

```ts
it("n'autorise @app que sous app/bibliotheque", () => {
  expect(violations(`import { x } from '@app/types/card'`, './app/bibliotheque/lib/a.ts')).toEqual([])
  expect(violations(`import { x } from '@app/types/card'`, './app/gestion/a.ts')).toHaveLength(1)
  expect(violations(`import x from '../../zachart-maths/src/a'`, './app/a.ts')).toHaveLength(1)
})
```
La boucle `it.each(files)` appelle `violations(source, path)`. Le glob scanne `./**/*.{ts,tsx}` ; les fichiers `.astro` de la vitrine sont couverts par la garde `check-dist.mjs`.

- [ ] **Step 5: Monter l'admin comme îlot**

`apps/site/src/pages/bibliotheque.astro` :

```astro
---
import AppPage from '../layouts/AppPage.astro'
import { BibliothequeApp } from '../app/bibliotheque/BibliothequeApp'
---
<AppPage title="Bibliothèque">
  <BibliothequeApp client:only="react" />
</AppPage>
```

- [ ] **Step 6: Dépendances et vérifications**

Vérifier que `apps/site/package.json` porte toutes les dépendances de l'ancien `admin/package.json` (`lucide-react`, `pocketbase`, `zustand`, `tailwindcss`, `@tailwindcss/vite`, testing-library, jsdom, vitest) — déjà ajoutées en Task 2 ; comparer avec `git show HEAD:apps/zachart-mentale/admin/package.json`. Ajouter `"zachart-mentale"` n'est **pas** nécessaire : `@app` est un alias de chemin.

```bash
bun install
bun run --filter site test 2>&1 | tail -8
bun run --filter site build
```
Expected : au moins `N_ADMIN` tests passent (plus ceux de la frontière), build OK. Un test qui échoue sur un import `@/…` non réécrit : corriger l'import, pas le test.

- [ ] **Step 7: Dockerfile, CI, Mentale**

`infra/Dockerfile`, étage `build` (remplace tout de `FROM oven/bun` à `RUN … bun run build`) :

```dockerfile
FROM oven/bun:1.3-alpine AS build

WORKDIR /build

# Les workspaces Bun veulent tous leurs package.json pour résoudre bun.lock :
# on copie donc `apps/` et `packages/` (le .dockerignore écarte node_modules,
# src-tauri et dist), puis on n'installe que le site.
COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages
RUN bun install --frozen-lockfile --filter site

# `bun run build` = `astro check && astro build && check-dist` : la construction
# ÉCHOUE sur une erreur de types, une route manquante ou un <script> dans la vitrine.
RUN cd apps/site && bun run build
```
et la dernière ligne : `COPY --from=build /build/apps/site/dist /pb_public`. Mettre à jour les commentaires de ce fichier qui parlent de `admin/`. Si `--filter` avec `--frozen-lockfile` est refusé par Bun, utiliser `bun install --frozen-lockfile` (sans filtre) et le noter en commentaire.

`.github/workflows/build.yml`, job `admin` → job `site` : `working-directory` supprimé, étapes `bun install` (racine), `bun run --filter site test`, `bun run --filter site build`.
`apps/zachart-mentale/vitest.config.ts` : retirer `'admin/**'` de `exclude` et le commentaire qui l'explique.

```bash
PB_ADMIN_EMAIL=a@b.test PB_ADMIN_PASSWORD=MotDePasse1234! docker compose -f infra/docker-compose.yml build pocketbase
docker run --rm -d --name pbcheck -p 8091:8090 -e PB_ADMIN_EMAIL=a@b.test -e PB_ADMIN_PASSWORD=MotDePasse1234! infra-pocketbase 2>/dev/null || true
```
(le nom d'image dépend du nom du projet compose ; lire la fin du `build` pour le nom exact.) Puis `curl -s http://localhost:8091/bibliotheque/ | grep -c astro-island` → ≥ 1, et `curl -s http://localhost:8091/ | grep -c '<script'` → 0. `docker rm -f pbcheck`.

- [ ] **Step 8: Commit**

```bash
git add apps/site apps/zachart-mentale/vitest.config.ts infra/Dockerfile .github/workflows/build.yml bun.lock
git add -u apps/zachart-mentale/admin
git commit -m "feat(site): l'admin web devient /bibliotheque (code déplacé, tests conservés)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Schéma — `invite_codes`, champs et règles de `users`

**Files:**
- Modify: `infra/pocketbase-schema.mjs`
- Test: `infra/pocketbase-schema.accounts.test.mjs` (nouveau) ; ajuster `infra/setup-pocketbase.test.mjs` si une assertion fige les règles de `users`

**Interfaces:**
- Produces (exports de `infra/pocketbase-schema.mjs`) : `INVITE_CODES_COLLECTION = 'invite_codes'`, `INVITE_CODE_ALPHABET`, `INVITE_CODE_LENGTH = 10`, `INVITE_CODE_FIELDS`, `INVITE_CODE_INDEXES`, `INVITE_CODE_RULES`, `TEACHER_FIELD`, `INVITE_CODE_REF_FIELD`, `USERS_RULES`. Champs de `users` : `teacher` (relation vers `_pb_users_auth_`), `invite_code` (texte : le code, pas une relation, pour ne pas dépendre de l'id généré de `invite_codes`).

- [ ] **Step 1: Écrire le test qui échoue**

`infra/pocketbase-schema.accounts.test.mjs` :

```js
import { describe, it, expect } from 'vitest'
import {
  INVITE_CODES_COLLECTION,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  USERS_COLLECTION,
  desiredCollections,
} from './pocketbase-schema.mjs'

const byName = name => desiredCollections().find(collection => collection.name === name)

describe('invite_codes', () => {
  const codes = byName(INVITE_CODES_COLLECTION)

  it('existe, en collection de base', () => {
    expect(codes).toBeDefined()
    expect(codes.kind).toBe('base')
  })

  it('est fermée à tout le monde sauf aux superutilisateurs', () => {
    for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
      expect(codes.rules[rule], rule).toBeNull()
    }
  })

  it('porte kind, expires_at, revoked, note et un code unique', () => {
    const names = codes.fields.map(field => field.name)
    for (const name of ['code', 'kind', 'expires_at', 'revoked', 'note']) expect(names).toContain(name)
    expect(codes.fields.find(field => field.name === 'kind').values).toEqual(['unique', 'duree'])
    expect(codes.indexes.some(sql => /UNIQUE/i.test(sql) && /\(`code`\)/.test(sql))).toBe(true)
  })

  it("l'alphabet exclut les caractères ambigus et n'a pas de doublon", () => {
    expect(INVITE_CODE_ALPHABET).not.toMatch(/[01OIl]/)
    expect(new Set(INVITE_CODE_ALPHABET).size).toBe(INVITE_CODE_ALPHABET.length)
    expect(INVITE_CODE_ALPHABET).toHaveLength(31)
    expect(INVITE_CODE_LENGTH).toBe(10)
  })
})

describe('users', () => {
  const users = byName(USERS_COLLECTION)

  it('gagne teacher (relation vers users) et invite_code', () => {
    const teacher = users.fields.find(field => field.name === 'teacher')
    expect(teacher.type).toBe('relation')
    expect(teacher.collectionId).toBe('_pb_users_auth_')
    expect(teacher.maxSelect).toBe(1)
    expect(users.fields.some(field => field.name === 'invite_code')).toBe(true)
  })

  it('reste fermée à la création anonyme', () => {
    expect(users.rules.createRule).not.toBe('')
    expect(users.rules.createRule).toContain('@request.auth.role = "prof"')
  })

  it('cloisonne chaque prof à ses élèves', () => {
    for (const rule of ['listRule', 'viewRule', 'deleteRule', 'manageRule']) {
      expect(users.rules[rule], rule).toContain('teacher = @request.auth.id')
    }
  })

  it("interdit de changer role, teacher et invite_code soi-même", () => {
    expect(users.rules.updateRule).toContain('@request.body.role:isset = false')
    expect(users.rules.updateRule).toContain('@request.body.teacher:isset = false')
    expect(users.rules.updateRule).toContain('@request.body.invite_code:isset = false')
  })
})
```

- [ ] **Step 2: Lancer pour voir l'échec**

Run: `bun run test:infra -- pocketbase-schema.accounts` — Expected : FAIL (exports absents).

- [ ] **Step 3: Implémenter**

Dans `infra/pocketbase-schema.mjs`, après `ROLE_FIELD` :

```js
/** Le champ qui rattache un élève à son prof (1 élève = 1 prof, chantier Synchro S0). `_pb_users_auth_` est l'id de la collection `users` intégrée de PocketBase. */
export const TEACHER_FIELD = {
  name: 'teacher',
  type: 'relation',
  required: false,
  collectionId: '_pb_users_auth_',
  maxSelect: 1,
  cascadeDelete: false,
  help: 'Le prof auquel cet élève est rattaché. Vide pour un prof.',
}

/**
 * Le code avec lequel un prof s'est inscrit. Du TEXTE, pas une relation : une
 * relation exigerait l'id généré de `invite_codes`, que le schéma-comme-donnée ne
 * connaît pas, et le code est de toute façon unique.
 */
export const INVITE_CODE_REF_FIELD = {
  name: 'invite_code',
  type: 'text',
  required: false,
  max: 32,
  help: 'Le code d’inscription utilisé (prof inscrit par code). Vide sinon.',
}

export const INVITE_CODES_COLLECTION = 'invite_codes'

/** Sans 0, O, 1, I, L : un code se dicte à voix haute ou se lit sur une feuille. */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const INVITE_CODE_LENGTH = 10

export const INVITE_CODE_FIELDS = [
  {
    name: 'code',
    type: 'text',
    required: true,
    min: INVITE_CODE_LENGTH,
    max: INVITE_CODE_LENGTH,
    pattern: `^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`,
    help: 'Le code à donner au professeur (10 caractères).',
  },
  {
    name: 'kind',
    type: 'select',
    required: true,
    maxSelect: 1,
    values: ['unique', 'duree'],
    help: 'unique = une seule inscription. duree = valable jusqu’à expires_at, pour plusieurs inscriptions.',
  },
  { name: 'expires_at', type: 'date', required: false, help: 'Obligatoire pour un code « duree ».' },
  { name: 'revoked', type: 'bool', required: false, help: 'Coché : le code ne marche plus.' },
  { name: 'note', type: 'text', required: false, max: 255, help: 'Pour s’y retrouver (ex. « équipe de maths »).' },
  CREATED_FIELD,
  UPDATED_FIELD,
]

export const INVITE_CODE_INDEXES = [
  'CREATE UNIQUE INDEX `idx_invite_codes_code` ON `invite_codes` (`code`)',
]

/** Tout à `null` : seul le superutilisateur y touche, personne ne peut énumérer les codes. */
export const INVITE_CODE_RULES = {
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
}

const OWN_STUDENT = '@request.auth.role = "prof" && teacher = @request.auth.id'

/**
 * Les droits sur `users`.
 *
 * - Un prof voit, crée, modifie et supprime SES élèves, et eux seulement.
 * - `manageRule` est ce qui lui permet de fixer le mot de passe d'un élève sans
 *   connaître l'ancien (réinitialisation).
 * - Personne, prof compris, ne change son propre `role`, `teacher` ou `invite_code`.
 * - `createRule` n'ouvre que la création d'un ÉLÈVE rattaché au prof qui la fait.
 *   Un prof naît par le hook d'inscription (qui contourne les règles) ou par le
 *   superutilisateur, jamais par l'API publique.
 */
export const USERS_RULES = {
  listRule: `id = @request.auth.id || (${OWN_STUDENT})`,
  viewRule: `id = @request.auth.id || (${OWN_STUDENT})`,
  createRule:
    '@request.auth.role = "prof" && @request.body.role = "eleve" && @request.body.teacher = @request.auth.id',
  updateRule:
    '(id = @request.auth.id && @request.body.role:isset = false && @request.body.teacher:isset = false && @request.body.invite_code:isset = false)' +
    ` || (${OWN_STUDENT} && @request.body.role:isset = false && @request.body.teacher:isset = false)`,
  deleteRule: OWN_STUDENT,
  manageRule: OWN_STUDENT,
}
```
Dans `desiredCollections()` : ajouter `invite_codes` (kind `base`, `INVITE_CODE_FIELDS`, `INVITE_CODE_INDEXES`, `INVITE_CODE_RULES`) **avant** `users`, et pour `users` remplacer `fields: [USERNAME_FIELD, EMAIL_FIELD_OVERRIDE, ROLE_FIELD]` par `[…, ROLE_FIELD, TEACHER_FIELD, INVITE_CODE_REF_FIELD]` et `rules: { createRule: null }` par `rules: USERS_RULES`. Mettre à jour le commentaire qui disait « The app has no sign-up screen ».

- [ ] **Step 4: Lancer les tests d'infra**

Run: `bun run test:infra` — Expected : PASS. Si `setup-pocketbase.test.mjs` fige l'ancienne règle `createRule: null` de `users` ou le nombre de collections, adapter ces assertions à la nouvelle réalité (c'est l'intention du changement, pas une régression) et le dire dans le message de commit.

- [ ] **Step 5: Commit**

```bash
git add infra/pocketbase-schema.mjs infra/pocketbase-schema.accounts.test.mjs infra/setup-pocketbase.test.mjs
git commit -m "feat(infra): collection invite_codes, rattachement élève→prof, règles de users

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: État d'un code — table de cas partagée (hook JS ↔ site TS)

**Files:**
- Create: `infra/fixtures/invite-code-states.json`, `infra/pb_hooks/lib/inviteCode.js`, `infra/pb_hooks/lib/inviteCode.test.mjs`
- Create: `apps/site/src/app/lib/inviteCode.ts`, `apps/site/src/app/lib/inviteCode.test.ts`

**Interfaces:**
- Produces (JS, CommonJS) `require('…/lib/inviteCode.js')` → `{ ALPHABET, normalizeCode(raw): string, inviteCodeState(code, usedCount, nowMs): 'actif'|'utilise'|'expire'|'revoque', isUsable(state): boolean }`, avec `code = { kind: 'unique'|'duree', expires_at?: string, revoked?: boolean }`.
- Produces (TS, mêmes noms + types `InviteKind`, `InviteState`, `InviteCodeRecord`) et en plus `generateCode(random?): string`, `formatCode(code): string` (`ABCDE-FGHJK`).
- Écart assumé par rapport à la spec : « une fonction pure unique » devient « deux implémentations, une seule table de cas ». Un fichier CommonJS ne s'importe pas proprement dans le bundle Vite ; la fixture JSON les empêche de diverger (chaque implémentation la rejoue).

- [ ] **Step 1: La table de cas**

`infra/fixtures/invite-code-states.json` (tableau ; `now` en ISO) :

```json
[
  { "name": "unique neuf", "code": { "kind": "unique" }, "usedCount": 0, "now": "2026-10-10T12:00:00Z", "expected": "actif" },
  { "name": "unique consommé", "code": { "kind": "unique" }, "usedCount": 1, "now": "2026-10-10T12:00:00Z", "expected": "utilise" },
  { "name": "unique révoqué", "code": { "kind": "unique", "revoked": true }, "usedCount": 0, "now": "2026-10-10T12:00:00Z", "expected": "revoque" },
  { "name": "unique révoqué et consommé", "code": { "kind": "unique", "revoked": true }, "usedCount": 1, "now": "2026-10-10T12:00:00Z", "expected": "revoque" },
  { "name": "durée avant l'échéance, déjà utilisé 5 fois", "code": { "kind": "duree", "expires_at": "2026-10-11T00:00:00.000Z" }, "usedCount": 5, "now": "2026-10-10T12:00:00Z", "expected": "actif" },
  { "name": "durée à l'instant exact de l'échéance", "code": { "kind": "duree", "expires_at": "2026-10-10T12:00:00.000Z" }, "usedCount": 0, "now": "2026-10-10T12:00:00Z", "expected": "expire" },
  { "name": "durée après l'échéance", "code": { "kind": "duree", "expires_at": "2026-10-09T00:00:00.000Z" }, "usedCount": 0, "now": "2026-10-10T12:00:00Z", "expected": "expire" },
  { "name": "durée, date au format PocketBase (espace)", "code": { "kind": "duree", "expires_at": "2026-10-09 00:00:00.000Z" }, "usedCount": 0, "now": "2026-10-10T12:00:00Z", "expected": "expire" },
  { "name": "durée, date PocketBase encore valide", "code": { "kind": "duree", "expires_at": "2026-10-11 00:00:00.000Z" }, "usedCount": 0, "now": "2026-10-10T12:00:00Z", "expected": "actif" },
  { "name": "durée sans échéance : invalide donc expiré", "code": { "kind": "duree" }, "usedCount": 0, "now": "2026-10-10T12:00:00Z", "expected": "expire" },
  { "name": "durée révoquée", "code": { "kind": "duree", "expires_at": "2026-10-11T00:00:00.000Z", "revoked": true }, "usedCount": 0, "now": "2026-10-10T12:00:00Z", "expected": "revoque" },
  { "name": "durée expirée et révoquée : révoqué d'abord", "code": { "kind": "duree", "expires_at": "2026-10-09T00:00:00.000Z", "revoked": true }, "usedCount": 0, "now": "2026-10-10T12:00:00Z", "expected": "revoque" }
]
```

- [ ] **Step 2: Test du hook (échoue)**

`infra/pb_hooks/lib/inviteCode.test.mjs` :

```js
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const invite = require('./inviteCode.js')
const cases = JSON.parse(readFileSync(new URL('../../fixtures/invite-code-states.json', import.meta.url), 'utf8'))

describe('inviteCodeState (hook)', () => {
  it.each(cases)('$name', ({ code, usedCount, now, expected }) => {
    expect(invite.inviteCodeState(code, usedCount, Date.parse(now))).toBe(expected)
  })
})

describe('normalizeCode', () => {
  it('retire espaces et tirets, passe en majuscules', () => {
    expect(invite.normalizeCode(' abcde-fghjk ')).toBe('ABCDEFGHJK')
    expect(invite.normalizeCode(undefined)).toBe('')
  })
})

describe('isUsable', () => {
  it('seul « actif » est utilisable', () => {
    expect(invite.isUsable('actif')).toBe(true)
    for (const state of ['utilise', 'expire', 'revoque']) expect(invite.isUsable(state)).toBe(false)
  })
})
```
Run: `bun run test:infra -- inviteCode` — Expected : FAIL (module absent).

- [ ] **Step 3: Implémenter le hook lib**

`infra/pb_hooks/lib/inviteCode.js` — **ES2015 uniquement** (pas de `?.`, `??`, ni de `import`) : le moteur JSVM de PocketBase (goja) est plus ancien que Node.

```js
// Logique pure des codes d'inscription, partagée par les hooks.
// Son jumeau TypeScript est apps/site/src/app/lib/inviteCode.ts ; les deux
// rejouent infra/fixtures/invite-code-states.json.

var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function normalizeCode(raw) {
  return String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// PocketBase écrit les dates « 2026-10-10 12:00:00.000Z » (espace, pas « T »).
function parseDate(value) {
  if (value == null || value === '') return NaN
  return Date.parse(String(value).replace(' ', 'T'))
}

function inviteCodeState(code, usedCount, nowMs) {
  if (code.revoked) return 'revoque'
  if (code.kind === 'duree') {
    var expiresAt = parseDate(code.expires_at)
    // Une durée sans échéance valide est un code mal formé : refusé, pas éternel.
    if (isNaN(expiresAt) || expiresAt <= nowMs) return 'expire'
  } else if (usedCount >= 1) {
    return 'utilise'
  }
  return 'actif'
}

function isUsable(state) {
  return state === 'actif'
}

module.exports = {
  ALPHABET: ALPHABET,
  normalizeCode: normalizeCode,
  inviteCodeState: inviteCodeState,
  isUsable: isUsable,
}
```
Run: `bun run test:infra -- inviteCode` — Expected : PASS.

- [ ] **Step 4: Test du jumeau TypeScript (échoue)**

`apps/site/src/app/lib/inviteCode.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import cases from '../../../../../infra/fixtures/invite-code-states.json'
import {
  INVITE_ALPHABET,
  INVITE_LENGTH,
  formatCode,
  generateCode,
  inviteCodeState,
  isUsable,
  normalizeCode,
  type InviteCodeRecord,
} from './inviteCode'

describe('inviteCodeState (site)', () => {
  it.each(cases)('$name', ({ code, usedCount, now, expected }) => {
    expect(inviteCodeState(code as InviteCodeRecord, usedCount, Date.parse(now))).toBe(expected)
  })
})

describe('normalizeCode / formatCode', () => {
  it('normalise', () => expect(normalizeCode(' abcde-fghjk ')).toBe('ABCDEFGHJK'))
  it('groupe 5-5', () => expect(formatCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK'))
  it('isUsable', () => {
    expect(isUsable('actif')).toBe(true)
    expect(isUsable('revoque')).toBe(false)
  })
})

describe('generateCode', () => {
  it("tire 10 caractères de l'alphabet, sans ambigus", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateCode()
      expect(code).toHaveLength(INVITE_LENGTH)
      for (const char of code) expect(INVITE_ALPHABET).toContain(char)
    }
  })
  it('ne se répète pas sur 1000 tirages', () => {
    expect(new Set(Array.from({ length: 1000 }, () => generateCode())).size).toBe(1000)
  })
  it('rejette les octets biaisés (≥ 248) au lieu de les replier', () => {
    const bytes = [250, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    let i = 0
    const code = generateCode(count => Uint8Array.from({ length: count }, () => bytes[i++ % bytes.length]))
    expect(code).toHaveLength(INVITE_LENGTH)
  })
})
```

- [ ] **Step 5: Implémenter le jumeau**

`apps/site/src/app/lib/inviteCode.ts` :

```ts
// Jumeau de infra/pb_hooks/lib/inviteCode.js : les deux rejouent la même table
// (infra/fixtures/invite-code-states.json).

export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const INVITE_LENGTH = 10

export type InviteKind = 'unique' | 'duree'
export type InviteState = 'actif' | 'utilise' | 'expire' | 'revoque'

export interface InviteCodeRecord {
  kind: InviteKind
  expires_at?: string
  revoked?: boolean
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** `ABCDE-FGHJK` : plus facile à dicter et à recopier. */
export function formatCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`
}

function parseDate(value: string | undefined): number {
  if (value === undefined || value === '') return NaN
  return Date.parse(value.replace(' ', 'T'))
}

export function inviteCodeState(code: InviteCodeRecord, usedCount: number, nowMs: number): InviteState {
  if (code.revoked === true) return 'revoque'
  if (code.kind === 'duree') {
    const expiresAt = parseDate(code.expires_at)
    // Une durée sans échéance valide est un code mal formé : refusé, pas éternel.
    if (Number.isNaN(expiresAt) || expiresAt <= nowMs) return 'expire'
  } else if (usedCount >= 1) {
    return 'utilise'
  }
  return 'actif'
}

export function isUsable(state: InviteState): boolean {
  return state === 'actif'
}

type RandomBytes = (count: number) => Uint8Array

const cryptoBytes: RandomBytes = count => crypto.getRandomValues(new Uint8Array(count))

/**
 * Tire un code par échantillonnage avec rejet : 256 n'est pas multiple de 31,
 * replier un octet par `% 31` favoriserait les premiers caractères.
 */
export function generateCode(random: RandomBytes = cryptoBytes): string {
  const limit = 256 - (256 % INVITE_ALPHABET.length)
  let code = ''
  while (code.length < INVITE_LENGTH) {
    for (const byte of random(INVITE_LENGTH * 2)) {
      if (byte >= limit) continue
      code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length]
      if (code.length === INVITE_LENGTH) break
    }
  }
  return code
}
```
Run: `bun run --filter site test -- inviteCode` — Expected : PASS (si l'import JSON hors du projet est refusé par `astro check`, ajouter `"../../infra/fixtures/*.json"` à `include` du `tsconfig` du site).

- [ ] **Step 6: Commit**

```bash
git add infra/fixtures infra/pb_hooks apps/site/src/app/lib apps/site/tsconfig.json
git commit -m "feat: état d'un code d'inscription (hook JS + site TS, table de cas commune)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Hooks d'inscription et de suppression + test d'intégration

**Files:**
- Create: `infra/pb_hooks/inscription.pb.js`, `infra/pb_hooks/users.pb.js`, `infra/integration.mjs`
- Modify: `infra/Dockerfile`, `.github/workflows/infra-pocketbase.yml`, éventuellement `infra/pb_hooks/redirects.pb.js` (décision Task 2 step 6)

**Interfaces:**
- Consumes: `normalizeCode`, `inviteCodeState`, `isUsable` (Task 5) ; collections `invite_codes` et `users` (Task 4).
- Produces: `POST /api/inscription` avec `{ code, username, password }` → `200 { ok: true }` ou `400 { message }`. `infra/integration.mjs` (lit `PB_URL`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`, sort en code 1 au moindre échec).

- [ ] **Step 1: Trouver où l'image lit les hooks**

```bash
docker image inspect ghcr.io/muchobien/pocketbase:0.40.3 --format '{{json .Config.Entrypoint}} {{json .Config.Cmd}}'
docker run --rm --entrypoint sh ghcr.io/muchobien/pocketbase:0.40.3 -c 'cat /entrypoint.sh 2>/dev/null || cat /usr/local/bin/entrypoint.sh'
```
Chercher `--hooksDir`. Attendu : `/pb_hooks`. Si c'est un autre chemin, l'utiliser partout ci-dessous (Dockerfile, CI, commandes de test).

- [ ] **Step 2: Écrire les hooks**

`infra/pb_hooks/inscription.pb.js` — chaque callback `require` ce dont il a besoin à l'intérieur (les gestionnaires JSVM s'exécutent dans des contextes isolés : les variables du fichier ne sont pas visibles) :

```js
/// <reference path="../pb_data/types.d.ts" />

// L'inscription d'un prof avec un code. Aucune règle de collection ne sait
// exprimer « un visiteur non connecté crée un compte si ce code est valable » ;
// ce hook le fait, dans UNE transaction : la vérification du code et la création
// du compte réussissent ou échouent ensemble.
routerAdd('POST', '/api/inscription', (e) => {
  const invite = require(`${__hooks}/lib/inviteCode.js`)
  const refuse = 'Code invalide ou expiré.'

  const body = e.requestInfo().body || {}
  const code = invite.normalizeCode(body.code)
  const username = String(body.username || '').trim()
  const password = String(body.password || '')

  if (code.length !== 10) throw new BadRequestError(refuse)
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(username)) {
    throw new BadRequestError('Identifiant invalide : lettres, chiffres, point, tiret et underscore.')
  }
  if (password.length < 10) throw new BadRequestError('Mot de passe trop court : 10 caractères minimum.')

  $app.runInTransaction((txApp) => {
    let record
    try {
      record = txApp.findFirstRecordByFilter('invite_codes', 'code = {:code}', { code: code })
    } catch (_) {
      throw new BadRequestError(refuse)
    }

    const used = txApp.countRecords('users', $dbx.hashExp({ invite_code: code }))
    const state = invite.inviteCodeState(
      {
        kind: record.getString('kind'),
        expires_at: record.getString('expires_at'),
        revoked: record.getBool('revoked'),
      },
      used,
      Date.now()
    )
    if (!invite.isUsable(state)) throw new BadRequestError(refuse)

    // Vérifié APRÈS le code : on ne révèle un pseudo pris qu'à qui détient un code valable.
    if (txApp.countRecords('users', $dbx.hashExp({ username: username })) > 0) {
      throw new BadRequestError('Cet identifiant est déjà pris.')
    }

    const user = new Record(txApp.findCollectionByNameOrId('users'))
    user.set('username', username)
    user.set('role', 'prof')
    user.set('invite_code', code)
    user.setPassword(password)
    txApp.save(user)
  })

  return e.json(200, { ok: true })
})
```

`infra/pb_hooks/users.pb.js` :

```js
/// <reference path="../pb_data/types.d.ts" />

// Un prof qui a encore des élèves ne se supprime pas — même par le
// superutilisateur, qui contourne les règles de collection : c'est donc un hook
// et non une règle. Sans lui, les élèves se retrouveraient sans prof.
onRecordDeleteRequest((e) => {
  if (e.record.getString('role') === 'prof') {
    const count = e.app.countRecords('users', $dbx.hashExp({ teacher: e.record.id }))
    if (count > 0) {
      throw new BadRequestError(
        `Ce professeur a encore ${count} élève(s) : rattachez-les à un autre professeur ou supprimez-les d’abord.`
      )
    }
  }
  e.next()
}, 'users')
```

- [ ] **Step 3: Écrire le test d'intégration (il doit échouer sans serveur)**

`infra/integration.mjs` :

```js
// Scénarios contre un VRAI PocketBase (hooks montés, schéma appliqué).
//   PB_URL=… PB_ADMIN_EMAIL=… PB_ADMIN_PASSWORD=… bun run infra/integration.mjs
// Sort en code 1 au premier échec constaté (tous les scénarios sont joués).
const { PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD } = process.env
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const PASSWORD = 'MotDePasse1234!'
const run = Date.now().toString(36)
let failures = 0
let adminToken = ''

function check(name, condition, detail = '') {
  if (condition) return console.log(`  ✓ ${name}`)
  failures += 1
  console.log(`  ✗ ${name} ${detail}`)
}
const denied = status => status === 400 || status === 403 || status === 404

async function api(path, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(`${PB_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* corps vide ou non JSON */ }
  return { status: response.status, json }
}

const randomCode = () =>
  Array.from({ length: 10 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

async function createCode(fields = {}) {
  const code = randomCode()
  const { status, json } = await api('/api/collections/invite_codes/records', {
    method: 'POST', token: adminToken, body: { code, kind: 'unique', ...fields },
  })
  if (status !== 200) throw new Error(`création du code impossible : ${status} ${JSON.stringify(json)}`)
  return { code, id: json.id }
}
const signup = (code, username, password = PASSWORD) =>
  api('/api/inscription', { method: 'POST', body: { code, username, password } })
async function login(username, password = PASSWORD) {
  const { status, json } = await api('/api/collections/users/auth-with-password', {
    method: 'POST', body: { identity: username, password },
  })
  return { status, token: json?.token ?? '', id: json?.record?.id ?? '' }
}
async function newProf(tag) {
  const username = `prof_${tag}_${run}`
  const { code } = await createCode()
  const result = await signup(code, username)
  if (result.status !== 200) throw new Error(`prof ${tag} : ${result.status}`)
  return { username, ...(await login(username)) }
}
const day = 86_400_000
const iso = ms => new Date(ms).toISOString().replace('T', ' ')

async function main() {
  const auth = await api('/api/collections/_superusers/auth-with-password', {
    method: 'POST', body: { identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD },
  })
  adminToken = auth.json?.token ?? ''
  if (!adminToken) throw new Error(`connexion admin impossible (${auth.status})`)

  console.log('S1 code unique')
  { const { code } = await createCode()
    check('première inscription : 200', (await signup(code, `s1a_${run}`)).status === 200)
    check('seconde inscription : refusée', denied((await signup(code, `s1b_${run}`)).status)) }

  console.log('S2 code à durée')
  { const future = await createCode({ kind: 'duree', expires_at: iso(Date.now() + day) })
    check('1er inscrit : 200', (await signup(future.code, `s2a_${run}`)).status === 200)
    check('2e inscrit : 200', (await signup(future.code, `s2b_${run}`)).status === 200)
    const past = await createCode({ kind: 'duree', expires_at: iso(Date.now() - day) })
    check('code expiré : refusé', denied((await signup(past.code, `s2c_${run}`)).status)) }

  console.log('S3 code révoqué (même après création)')
  { const { code, id } = await createCode()
    await api(`/api/collections/invite_codes/records/${id}`, { method: 'PATCH', token: adminToken, body: { revoked: true } })
    const result = await signup(code, `s3_${run}`)
    check('refusé', denied(result.status))
    check('message unique, sans indice', result.json?.message === 'Code invalide ou expiré.', JSON.stringify(result.json)) }

  console.log('S4 code mal saisi mais reconnaissable')
  { const { code } = await createCode()
    check('espaces, tiret et minuscules acceptés',
      (await signup(` ${code.slice(0, 5).toLowerCase()}-${code.slice(5).toLowerCase()} `, `s4_${run}`)).status === 200)
    check('code inconnu : refusé', denied((await signup(randomCode(), `s4b_${run}`)).status)) }

  console.log('S5 identifiant déjà pris : le code n’est pas consommé')
  { const taken = await createCode()
    await signup(taken.code, `s5_${run}`)
    const { code } = await createCode()
    check('refusé', denied((await signup(code, `s5_${run}`)).status))
    check('le code sert encore', (await signup(code, `s5b_${run}`)).status === 200) }

  console.log('S6 entrées invalides')
  { const { code } = await createCode()
    check('mot de passe court', denied((await signup(code, `s6_${run}`, 'court')).status))
    check('identifiant illégal', denied((await signup(code, 'a b/c')).status))
    check('le code sert encore', (await signup(code, `s6b_${run}`)).status === 200) }

  console.log('S7 huit inscriptions simultanées sur un code unique')
  { const { code } = await createCode()
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => signup(code, `s7_${i}_${run}`)))
    check('exactement une réussit', results.filter(r => r.status === 200).length === 1,
      results.map(r => r.status).join(',')) }

  console.log('S8 cloisonnement des profs')
  { const a = await newProf('a')
    const b = await newProf('b')
    const create = (prof, name, extra = {}) => api('/api/collections/users/records', {
      method: 'POST', token: prof.token,
      body: { username: name, password: PASSWORD, passwordConfirm: PASSWORD, role: 'eleve', teacher: prof.id, ...extra },
    })
    const eleve = await create(a, `e1_${run}`)
    check('A crée un élève à lui', eleve.status === 200, JSON.stringify(eleve.json))
    check('A ne crée pas un élève pour B', denied((await create(a, `e2_${run}`, { teacher: b.id })).status))
    check('A ne crée pas un prof', denied((await create(a, `e3_${run}`, { role: 'prof' })).status))
    const listB = await api('/api/collections/users/records?perPage=200', { token: b.token })
    check('B ne voit pas l’élève de A', !listB.json?.items?.some(u => u.id === eleve.json?.id))
    check('B ne modifie pas l’élève de A', denied((await api(`/api/collections/users/records/${eleve.json?.id}`,
      { method: 'PATCH', token: b.token, body: { username: `hack_${run}` } })).status))
    check('B ne supprime pas l’élève de A', denied((await api(`/api/collections/users/records/${eleve.json?.id}`,
      { method: 'DELETE', token: b.token })).status))
    check('A ne se promeut pas', denied((await api(`/api/collections/users/records/${a.id}`,
      { method: 'PATCH', token: a.token, body: { role: 'eleve' } })).status))
    check('A ne change pas son teacher', denied((await api(`/api/collections/users/records/${a.id}`,
      { method: 'PATCH', token: a.token, body: { teacher: b.id } })).status))
    const reset = await api(`/api/collections/users/records/${eleve.json?.id}`, {
      method: 'PATCH', token: a.token, body: { password: 'NouveauMdp1234!', passwordConfirm: 'NouveauMdp1234!' },
    })
    check('A réinitialise le mot de passe de son élève (sans l’ancien)', reset.status === 200, JSON.stringify(reset.json))
    check('l’élève se connecte avec le nouveau', (await login(`e1_${run}`, 'NouveauMdp1234!')).status === 200)
    const refused = await api(`/api/collections/users/records/${a.id}`, { method: 'DELETE', token: adminToken })
    check('supprimer un prof qui a des élèves : refusé, même par l’admin', refused.status === 400, String(refused.status))
    check('A supprime son élève', (await api(`/api/collections/users/records/${eleve.json?.id}`,
      { method: 'DELETE', token: a.token })).status === 204)
    check('puis l’admin supprime A', (await api(`/api/collections/users/records/${a.id}`,
      { method: 'DELETE', token: adminToken })).status === 204) }

  console.log('S9 accès anonyme et prof aux codes')
  { check('anonyme ne liste pas les codes', denied((await api('/api/collections/invite_codes/records')).status))
    const prof = await newProf('s9')
    check('un prof ne liste pas les codes', denied((await api('/api/collections/invite_codes/records', { token: prof.token })).status))
    check('anonyme ne crée pas de compte', denied((await api('/api/collections/users/records', { method: 'POST',
      body: { username: `anon_${run}`, password: PASSWORD, passwordConfirm: PASSWORD, role: 'prof' } })).status)) }

  if (failures > 0) { console.log(`\n${failures} échec(s)`); process.exit(1) }
  console.log('\nTout est conforme.')
}

main().catch((error) => { console.error(error); process.exit(1) })
```

- [ ] **Step 4: Monter un serveur et voir l'échec**

```bash
docker rm -f pbint 2>/dev/null
docker run -d --name pbint -p 8092:8090 \
  -e PB_ADMIN_EMAIL=admin@test.local -e PB_ADMIN_PASSWORD=MotDePasse1234! \
  ghcr.io/muchobien/pocketbase:0.40.3
export PB_URL=http://127.0.0.1:8092 PB_ADMIN_EMAIL=admin@test.local PB_ADMIN_PASSWORD=MotDePasse1234!
sleep 6 && bun run infra/setup-pocketbase.mjs
bun run infra/integration.mjs
```
Expected : échecs (S1 : l'endpoint `/api/inscription` n'existe pas, 404). C'est le « rouge ».

- [ ] **Step 5: Monter les hooks et rejouer**

```bash
docker rm -f pbint
docker run -d --name pbint -p 8092:8090 \
  -e PB_ADMIN_EMAIL=admin@test.local -e PB_ADMIN_PASSWORD=MotDePasse1234! \
  -v "$(pwd)/infra/pb_hooks:/pb_hooks:ro" ghcr.io/muchobien/pocketbase:0.40.3
sleep 6 && bun run infra/setup-pocketbase.mjs && bun run infra/integration.mjs
docker logs pbint 2>&1 | tail -20
```
Expected : `Tout est conforme.` En cas d'écart, **corriger le hook ou la règle, jamais l'assertion**, sauf si l'assertion reposait sur un statut HTTP que PocketBase renvoie légitimement autrement (les refus de règle valent 400/403/404 : c'est le rôle de `denied`). Écarts probables et leur remède :
- S7 plusieurs succès : la transaction ne sérialise pas. Ajouter un champ `consumed_by` (texte, index unique partiel sur `invite_code`… ) n'est pas possible pour `duree` ; pour `unique`, poser `record.set('used', true)` n'aide pas non plus. Remède : dans le hook, après `txApp.save(user)`, recompter ; si `unique` et `count > 1`, `throw` (le rollback annule la création). Ajouter ce contrôle puis rejouer S7 dix fois.
- S8 `manageRule` n'autorise pas la réinitialisation sans ancien mot de passe : lire la réponse, ajuster `USERS_RULES` (Task 4) et son test.
- Statut ≠ 204 sur DELETE : ajuster l'attendu à ce que PocketBase renvoie.

Répéter `bun run infra/integration.mjs` 3 fois : les noms contiennent `run`, donc rejouable sur le même serveur. `docker rm -f pbint` à la fin.

- [ ] **Step 6: Image et CI**

`infra/Dockerfile`, après `COPY --from=build … /pb_public` :

```dockerfile
# Les hooks JavaScript de PocketBase (inscription par code, garde de suppression).
COPY infra/pb_hooks /pb_hooks
```
(chemin vérifié au step 1). `.github/workflows/infra-pocketbase.yml` : dans l'étape `start PocketBase`, ajouter `-v "${{ github.workspace }}/infra/pb_hooks:/pb_hooks:ro" \` avant l'image ; après `an ordinary account can publish…`, ajouter :

```yaml
      - name: accounts, invite codes and hooks behave
        run: bun run infra/integration.mjs
```
Ajouter `'apps/site/**'` n'est pas nécessaire. Si Task 2 a décidé des redirections, créer `infra/pb_hooks/redirects.pb.js` maintenant.

- [ ] **Step 7: Commit**

```bash
git add infra/pb_hooks infra/integration.mjs infra/Dockerfile .github/workflows/infra-pocketbase.yml infra/pocketbase-schema.mjs
git commit -m "feat(infra): inscription par code (hook), garde de suppression d'un prof, test d'intégration

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Limitation de débit sur l'inscription

**Files:**
- Modify: `infra/pocketbase-schema.mjs`, `infra/setup-pocketbase.mjs`, `infra/integration.mjs`
- Test: `infra/pocketbase-schema.accounts.test.mjs`, `infra/setup-pocketbase.test.mjs`

**Interfaces:**
- Produces: `INSCRIPTION_RATE_RULE = { label: 'POST /api/inscription', maxRequests: 5, duration: 60, audience: '' }` et `planRateLimits(current, desired = INSCRIPTION_RATE_RULE) → { update?: { rateLimits }, changes: string[] }`, même contrat que `planBackups`.

Pourquoi une règle de PocketBase et pas un compteur dans le hook : les gestionnaires JSVM s'exécutent dans un pool de contextes isolés, un compteur en mémoire ne serait pas partagé. Et PocketBase est livré avec des règles par défaut (`*:create` : peu de requêtes par quelques secondes) **désactivées** ; les activer telles quelles brimerait la synchronisation (des dizaines de créations d'affilée). La politique : si la limitation était désactivée, on repart d'une liste qui ne contient QUE notre règle ; si l'opérateur l'avait activée, on conserve ses règles et on ajoute/remplace la nôtre.

- [ ] **Step 1: Tests qui échouent**

Ajouter à `infra/pocketbase-schema.accounts.test.mjs` :

```js
import { INSCRIPTION_RATE_RULE, planRateLimits } from './pocketbase-schema.mjs'

describe('planRateLimits', () => {
  const defaults = {
    enabled: false,
    rules: [
      { label: '*:auth', maxRequests: 2, duration: 3, audience: '' },
      { label: '*:create', maxRequests: 20, duration: 5, audience: '' },
    ],
  }

  it('désactivée : l’active avec NOTRE règle seule (pas les défauts qui brideraient la synchro)', () => {
    const plan = planRateLimits(defaults)
    expect(plan.update.rateLimits.enabled).toBe(true)
    expect(plan.update.rateLimits.rules).toEqual([INSCRIPTION_RATE_RULE])
    expect(plan.changes.length).toBeGreaterThan(0)
  })

  it('déjà activée par l’opérateur : garde ses règles et ajoute la nôtre', () => {
    const mine = { label: '/api/', maxRequests: 300, duration: 10, audience: '' }
    const plan = planRateLimits({ enabled: true, rules: [mine] })
    expect(plan.update.rateLimits.rules).toEqual([mine, INSCRIPTION_RATE_RULE])
  })

  it('remplace une version périmée de notre règle', () => {
    const stale = { ...INSCRIPTION_RATE_RULE, maxRequests: 99 }
    const plan = planRateLimits({ enabled: true, rules: [stale] })
    expect(plan.update.rateLimits.rules).toEqual([INSCRIPTION_RATE_RULE])
  })

  it('est un no-op quand tout est conforme', () => {
    expect(planRateLimits({ enabled: true, rules: [INSCRIPTION_RATE_RULE] })).toEqual({ changes: [] })
  })
})
```
Run: `bun run test:infra -- accounts` — Expected : FAIL.

- [ ] **Step 2: Implémenter**

Dans `infra/pocketbase-schema.mjs`, à côté de `planBackups` :

```js
/** 5 tentatives par minute et par adresse : assez pour une faute de frappe, trop peu pour deviner un code. */
export const INSCRIPTION_RATE_RULE = { label: 'POST /api/inscription', maxRequests: 5, duration: 60, audience: '' }

/**
 * Active la limitation de débit de PocketBase pour l'inscription.
 *
 * Les règles PAR DÉFAUT de PocketBase (`*:create`, `*:auth`, `/api/`) existent
 * même désactivées ; les activer ferait limiter la synchronisation, qui crée
 * beaucoup d'enregistrements d'affilée. Si la limitation était éteinte, on
 * repart donc d'une liste qui ne contient que notre règle. Si l'opérateur
 * l'avait allumée, ses règles sont les siennes et on y ajoute la nôtre.
 */
export function planRateLimits(current, desired = INSCRIPTION_RATE_RULE) {
  const enabled = current?.enabled === true
  const rules = enabled ? current?.rules ?? [] : []
  const mine = rules.find(rule => rule.label === desired.label)
  const same =
    mine !== undefined && mine.maxRequests === desired.maxRequests && mine.duration === desired.duration
  const changes = []
  if (!enabled) changes.push('limitation de débit : activée')
  if (!same) changes.push(`${desired.label} : ${desired.maxRequests} requêtes / ${desired.duration} s`)
  if (changes.length === 0) return { changes: [] }
  return {
    update: {
      rateLimits: {
        ...(current ?? {}),
        enabled: true,
        rules: [...rules.filter(rule => rule.label !== desired.label), desired],
      },
    },
    changes,
  }
}
```

Dans `runSetup` (`infra/setup-pocketbase.mjs`), juste après le bloc des sauvegardes, même forme :

```js
  const rateSettings = await client.getSettings()
  const ratePlan = planRateLimits(rateSettings?.rateLimits)
  report.rateLimits = { status: ratePlan.changes.length === 0 ? 'unchanged' : 'updated', changes: ratePlan.changes }
  log(
    ratePlan.changes.length === 0
      ? `${prefix}= limitation de débit : déjà à jour`
      : `${prefix}~ limitation de débit : ${ratePlan.changes.join(' ; ')}`
  )
  if (!config.dryRun && ratePlan.update !== undefined) await client.updateSettings(ratePlan.update)
```
Importer `planRateLimits`. Mettre `exitCodeFor` à jour pour que `--check` signale aussi `report.rateLimits.status === 'updated'` (lire la fonction : elle regarde déjà `report.backups`). Dans `setup-pocketbase.test.mjs`, mettre à jour les faux clients (`getSettings`) et les attendus de journal qui comptent les lignes ; ajouter un test `runSetup` : « un second passage ne change rien » avec un faux client qui mémorise `updateSettings`.

- [ ] **Step 3: Scénario d'intégration**

Dans `infra/integration.mjs`, **après** S9 :

```js
  console.log('S10 limitation de débit')
  { const results = []
    for (let i = 0; i < 8; i++) results.push((await signup('AAAAAAAAAA', `rl_${i}_${run}`)).status)
    check('au moins une réponse 429', results.includes(429), results.join(',')) }
```
(Les appels précédents ont déjà consommé le quota de cette adresse ; c'est pourquoi S10 passe en dernier, et pourquoi S1-S9 ne doivent pas faire plus de 5 inscriptions par minute… ce qu'ils font.) **Problème à traiter** : S1-S9 font bien plus de 5 appels à `/api/inscription` en moins d'une minute. Pour garder les scénarios fiables, `integration.mjs` doit s'exécuter AVANT l'application de la règle : dans le script CI et dans les commandes de test local, jouer `integration.mjs` avec `--skip-rate-limit` implicite en appliquant le schéma en deux temps : `setup-pocketbase.mjs --no-rate-limits` d'abord. Ajouter donc l'option `--no-rate-limits` (calquée sur `--no-backups` : `options.rateLimits`, `config.rateLimits !== false`, ligne d'aide), jouer S1-S9 sur un serveur configuré avec `--no-rate-limits`, puis relancer `setup-pocketbase.mjs` (qui active la règle) et jouer S10 seul : `bun run infra/integration.mjs --only-rate-limit`. Implémenter ce drapeau dans `integration.mjs` (`process.argv.includes('--only-rate-limit')` ⇒ ne joue que S10, sinon joue S1-S9).

- [ ] **Step 4: Vérifier**

```bash
bun run test:infra
docker rm -f pbint; docker run -d --name pbint -p 8092:8090 -e PB_ADMIN_EMAIL=admin@test.local \
  -e PB_ADMIN_PASSWORD=MotDePasse1234! -v "$(pwd)/infra/pb_hooks:/pb_hooks:ro" ghcr.io/muchobien/pocketbase:0.40.3
sleep 6
bun run infra/setup-pocketbase.mjs --no-rate-limits && bun run infra/integration.mjs
bun run infra/setup-pocketbase.mjs && bun run infra/integration.mjs --only-rate-limit
bun run infra/setup-pocketbase.mjs | grep "déjà à jour"
docker rm -f pbint
```
Expected : tests verts, S1-S9 conformes, S10 voit un 429, le dernier passage affiche « limitation de débit : déjà à jour ». Si le libellé `POST /api/inscription` n'est pas reconnu par PocketBase (aucun 429), essayer `/api/inscription` ; ajuster `INSCRIPTION_RATE_RULE.label` et son test.
Dans la CI, scinder en deux : `setup … --no-rate-limits` + `integration.mjs`, puis `setup` + `integration.mjs --only-rate-limit`. Le 2e passage de « a second run is a no-op » (déjà présent) doit rester vrai : placer l'étape d'intégration après lui, avec les deux appels ci-dessus.

- [ ] **Step 5: Commit**

```bash
git add infra .github/workflows/infra-pocketbase.yml
git commit -m "feat(infra): limitation de débit sur l'inscription (règle propre, sans brider la synchro)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Session, gardes, coque, connexion et inscription (site)

**Files:**
- Create: `apps/site/src/app/session/{pb,session,guards}.ts`, `apps/site/src/app/session/{guards,session}.test.ts`
- Create: `apps/site/src/app/shell/{nav.ts,nav.test.ts,AppShell.tsx,Protected.tsx}`
- Create: `apps/site/src/app/login/{LoginPage.tsx,LoginPage.test.tsx}`
- Create: `apps/site/src/app/inscription/{validateSignup.ts,validateSignup.test.ts,InscriptionPage.tsx}`
- Modify: `apps/site/src/pages/{login,inscription}.astro`

**Interfaces:**
- Consumes: `normalizeCode` (Task 5), primitives `@/ui/primitives` (Task 3).
- Produces:
  - `pb` (instance PocketBase, `session/pb.ts`) ; `Session = { kind: 'admin'; email: string } | { kind: 'prof' | 'eleve'; id: string; username: string }` ; `PageId = 'login' | 'inscription' | 'gestion' | 'dashboard' | 'eleves' | 'compte' | 'bibliotheque'`.
  - `currentSession(): Session | null`, `loginAny(identity: string, password: string): Promise<Session>` (lève `LoginError` avec un message français), `logout(): void`, `identityKind(identity): 'admin' | 'user'`.
  - `guard(session: Session | null, page: PageId): string | null` — chemin de redirection (`'/login/'`…) ou `null` si l'accès est permis. `homeFor(session): string`.
  - `navFor(session): NavItem[]` avec `NavItem = { id: PageId; label: string; href: string }`.
  - `<Protected page={…}>{enfants}</Protected>` : redirige selon `guard`, ne rend rien tant que ce n'est pas permis ; passe la session aux enfants par `children: (session: Session) => ReactNode`.
  - `validateSignup({ code, username, password, confirm }) → { ok: true; value } | { ok: false; errors: Partial<Record<'code'|'username'|'password'|'confirm', string>> }`.

- [ ] **Step 1: Tests des gardes et de la navigation (échouent)**

`apps/site/src/app/session/guards.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { guard, homeFor } from './guards'
import type { Session } from './session'

const admin: Session = { kind: 'admin', email: 'a@b.c' }
const prof: Session = { kind: 'prof', id: 'p1', username: 'prof' }
const eleve: Session = { kind: 'eleve', id: 'e1', username: 'eleve' }

describe('homeFor', () => {
  it("renvoie l'accueil de chaque rôle", () => {
    expect(homeFor(admin)).toBe('/gestion/')
    expect(homeFor(prof)).toBe('/dashboard/')
    expect(homeFor(eleve)).toBe('/login/')
  })
})

describe('guard', () => {
  it('renvoie un visiteur vers /login/ sur toute page protégée', () => {
    for (const page of ['gestion', 'dashboard', 'eleves', 'compte', 'bibliotheque'] as const) {
      expect(guard(null, page)).toBe('/login/')
    }
  })
  it('laisse un visiteur sur /login/ et /inscription/', () => {
    expect(guard(null, 'login')).toBeNull()
    expect(guard(null, 'inscription')).toBeNull()
  })
  it('renvoie un connecté de /login/ à son accueil', () => {
    expect(guard(admin, 'login')).toBe('/gestion/')
    expect(guard(prof, 'inscription')).toBe('/dashboard/')
  })
  it("réserve /gestion/ à l'admin", () => {
    expect(guard(admin, 'gestion')).toBeNull()
    expect(guard(prof, 'gestion')).toBe('/dashboard/')
  })
  it('réserve /eleves/ et /bibliotheque/ aux profs', () => {
    expect(guard(prof, 'eleves')).toBeNull()
    expect(guard(prof, 'bibliotheque')).toBeNull()
    expect(guard(admin, 'eleves')).toBe('/gestion/')
    expect(guard(admin, 'bibliotheque')).toBe('/gestion/')
  })
  it('ouvre /dashboard/ et /compte/ aux deux', () => {
    for (const page of ['dashboard', 'compte'] as const) {
      expect(guard(admin, page)).toBeNull()
      expect(guard(prof, page)).toBeNull()
    }
  })
  it("n'ouvre rien à un élève", () => {
    for (const page of ['gestion', 'dashboard', 'eleves', 'compte', 'bibliotheque'] as const) {
      expect(guard(eleve, page)).toBe('/login/')
    }
  })
})
```

`apps/site/src/app/shell/nav.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { navFor } from './nav'

describe('navFor', () => {
  it("donne à l'admin Gestion, Tableau de bord, Compte", () => {
    expect(navFor({ kind: 'admin', email: 'a@b.c' }).map(item => item.id)).toEqual(['gestion', 'dashboard', 'compte'])
  })
  it('donne au prof Tableau de bord, Élèves, Bibliothèque, Compte', () => {
    expect(navFor({ kind: 'prof', id: '1', username: 'p' }).map(item => item.id)).toEqual([
      'dashboard', 'eleves', 'bibliotheque', 'compte',
    ])
  })
  it('termine chaque lien par une barre', () => {
    for (const item of navFor({ kind: 'prof', id: '1', username: 'p' })) expect(item.href).toMatch(/\/$/)
  })
})
```

`apps/site/src/app/session/session.test.ts` (parties pures) :

```ts
import { describe, it, expect } from 'vitest'
import { identityKind, sessionFromRecord } from './session'

describe('identityKind', () => {
  it('un @ désigne le superutilisateur', () => {
    expect(identityKind('admin@mon-domaine.fr')).toBe('admin')
    expect(identityKind('prof.dupont')).toBe('user')
  })
})

describe('sessionFromRecord', () => {
  it('lit un superutilisateur', () => {
    expect(sessionFromRecord({ collectionName: '_superusers', id: 's', email: 'a@b.c' })).toEqual({ kind: 'admin', email: 'a@b.c' })
  })
  it('lit un prof et un élève', () => {
    expect(sessionFromRecord({ collectionName: 'users', id: 'p', username: 'x', role: 'prof' })).toEqual({ kind: 'prof', id: 'p', username: 'x' })
    expect(sessionFromRecord({ collectionName: 'users', id: 'e', username: 'y', role: 'eleve' })).toEqual({ kind: 'eleve', id: 'e', username: 'y' })
  })
  it('renvoie null sans enregistrement ou pour un rôle inconnu', () => {
    expect(sessionFromRecord(null)).toBeNull()
    expect(sessionFromRecord({ collectionName: 'users', id: 'x', username: 'z', role: '???' })).toBeNull()
  })
})
```
Run: `bun run --filter site test -- guards nav session` — Expected : FAIL.

- [ ] **Step 2: Implémenter session, gardes, navigation**

`apps/site/src/app/session/pb.ts` :

```ts
import PocketBase from 'pocketbase'

/**
 * Le client PocketBase du site. L'URL est celle de la page : le site est servi
 * par le serveur qu'il appelle (même origine, aucun CORS). La session vit dans
 * le `localStorage` du SDK (clé `pocketbase_auth`), partagée par toutes les
 * pages du site.
 */
export const pb = new PocketBase(window.location.origin)
```

`apps/site/src/app/session/session.ts` :

```ts
import { pb } from './pb'

export type Session =
  | { kind: 'admin'; email: string }
  | { kind: 'prof' | 'eleve'; id: string; username: string }

export type PageId = 'login' | 'inscription' | 'gestion' | 'dashboard' | 'eleves' | 'compte' | 'bibliotheque'

/** Un identifiant contenant « @ » ne peut pas être un pseudo (le motif l'interdit) : c'est le courriel du superutilisateur. */
export function identityKind(identity: string): 'admin' | 'user' {
  return identity.includes('@') ? 'admin' : 'user'
}

interface AuthRecordLike {
  collectionName: string
  id: string
  email?: string
  username?: string
  role?: string
}

export function sessionFromRecord(record: AuthRecordLike | null): Session | null {
  if (record === null) return null
  if (record.collectionName === '_superusers') return { kind: 'admin', email: record.email ?? '' }
  if (record.role === 'prof' || record.role === 'eleve') {
    return { kind: record.role, id: record.id, username: record.username ?? '' }
  }
  return null
}

export function currentSession(): Session | null {
  if (!pb.authStore.isValid) return null
  return sessionFromRecord(pb.authStore.record as AuthRecordLike | null)
}

export class LoginError extends Error {}

function describeAuthError(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: unknown }).status) : 0
  if (status === 0) return 'Serveur injoignable. Vérifiez votre connexion.'
  if (status === 400) return 'Identifiant ou mot de passe incorrect.'
  return `La connexion a échoué (erreur ${status}).`
}

/**
 * Connecte l'admin (superutilisateur) ou un compte `users`.
 *
 * Un compte élève est REFUSÉ et déconnecté aussitôt : le site n'a rien pour lui,
 * et le laisser entrer serait lui montrer des écrans où chaque bouton répondrait
 * « 403 ». C'est une politesse ; la sécurité est dans les règles de collection.
 */
export async function loginAny(identity: string, password: string): Promise<Session> {
  const name = identity.trim()
  try {
    if (identityKind(name) === 'admin') {
      await pb.collection('_superusers').authWithPassword(name, password)
    } else {
      await pb.collection('users').authWithPassword(name, password)
    }
  } catch (error) {
    throw new LoginError(describeAuthError(error))
  }
  const session = currentSession()
  if (session === null) throw new LoginError('Connexion acceptée mais session illisible. Réessayez.')
  if (session.kind === 'eleve') {
    pb.authStore.clear()
    throw new LoginError('Les comptes élèves se connectent dans l’application de bureau, pas sur le site.')
  }
  return session
}

export function logout(): void {
  pb.authStore.clear()
}
```

`apps/site/src/app/session/guards.ts` :

```ts
import type { PageId, Session } from './session'

const ALLOWED: Record<Exclude<PageId, 'login' | 'inscription'>, ReadonlyArray<'admin' | 'prof'>> = {
  gestion: ['admin'],
  dashboard: ['admin', 'prof'],
  eleves: ['prof'],
  compte: ['admin', 'prof'],
  bibliotheque: ['prof'],
}

export function homeFor(session: Session): string {
  if (session.kind === 'admin') return '/gestion/'
  if (session.kind === 'prof') return '/dashboard/'
  return '/login/'
}

/**
 * Où renvoyer ce visiteur sur cette page, ou `null` s'il peut y rester.
 * Un confort d'interface, rien de plus : les règles de collection de PocketBase
 * sont la seule vraie barrière.
 */
export function guard(session: Session | null, page: PageId): string | null {
  if (page === 'login' || page === 'inscription') {
    return session === null || session.kind === 'eleve' ? null : homeFor(session)
  }
  if (session === null || session.kind === 'eleve') return '/login/'
  return ALLOWED[page].includes(session.kind) ? null : homeFor(session)
}
```

`apps/site/src/app/shell/nav.ts` :

```ts
import type { PageId, Session } from '../session/session'

export interface NavItem {
  id: PageId
  label: string
  href: string
}

const ITEMS: Record<'gestion' | 'dashboard' | 'eleves' | 'bibliotheque' | 'compte', NavItem> = {
  gestion: { id: 'gestion', label: 'Gestion', href: '/gestion/' },
  dashboard: { id: 'dashboard', label: 'Tableau de bord', href: '/dashboard/' },
  eleves: { id: 'eleves', label: 'Élèves', href: '/eleves/' },
  bibliotheque: { id: 'bibliotheque', label: 'Bibliothèque', href: '/bibliotheque/' },
  compte: { id: 'compte', label: 'Compte', href: '/compte/' },
}

export function navFor(session: Session): NavItem[] {
  if (session.kind === 'admin') return [ITEMS.gestion, ITEMS.dashboard, ITEMS.compte]
  if (session.kind === 'prof') return [ITEMS.dashboard, ITEMS.eleves, ITEMS.bibliotheque, ITEMS.compte]
  return []
}
```
Run: `bun run --filter site test -- guards nav session` — Expected : PASS.

- [ ] **Step 3: La coque et `Protected`**

`apps/site/src/app/shell/Protected.tsx` :

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { currentSession, type PageId, type Session } from '../session/session'
import { guard } from '../session/guards'

/**
 * Ne rend rien tant que la session n'est pas jugée suffisante pour la page, et
 * redirige sinon. Les îlots sont rendus côté client uniquement : `currentSession`
 * lit le `localStorage`, qui n'existe pas à la construction.
 */
export function Protected({ page, children }: { page: PageId; children: (session: Session) => ReactNode }) {
  const [session] = useState(currentSession)
  const target = guard(session, page)

  useEffect(() => {
    if (target !== null) window.location.replace(target)
  }, [target])

  if (target !== null || session === null) return null
  return <>{children(session)}</>
}
```

`apps/site/src/app/shell/AppShell.tsx` : barre latérale fixe à gauche à partir de `md`, barre du bas en dessous, contenu centré avec `max-w-6xl`.

```tsx
import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { logout, type PageId, type Session } from '../session/session'
import { navFor } from './nav'

function label(session: Session): string {
  return session.kind === 'admin' ? session.email : session.username
}

export function AppShell({ session, page, title, children }: { session: Session; page: PageId; title: string; children: ReactNode }) {
  const items = navFor(session)
  const signOut = () => {
    logout()
    window.location.replace('/login/')
  }
  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-850 bg-ink-950 p-4 md:flex">
        <p className="mb-6 text-sm font-semibold">Zachar’t</p>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Navigation principale">
          {items.map(item => (
            <a
              key={item.id}
              href={item.href}
              aria-current={item.id === page ? 'page' : undefined}
              className={`tap flex items-center rounded-xl px-3 text-sm transition-colors ${
                item.id === page ? 'bg-ink-850 text-ink-100' : 'text-ink-300 hover:bg-ink-900'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-ink-850 pt-3">
          <span className="min-w-0 flex-1 truncate text-xs text-ink-500">{label(session)}</span>
          <button type="button" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter"
            className="tap grid w-10 place-items-center rounded-xl text-ink-500 hover:bg-ink-850 hover:text-ink-100">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top flex items-center gap-3 border-b border-ink-850 px-4 pb-2 md:px-8">
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
          <span className="truncate text-xs text-ink-500 md:hidden">{label(session)}</span>
          <button type="button" onClick={signOut} aria-label="Se déconnecter"
            className="tap grid w-10 shrink-0 place-items-center rounded-xl text-ink-500 hover:bg-ink-850 md:hidden">
            <LogOut size={18} />
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">{children}</main>
        <nav className="safe-bottom flex border-t border-ink-850 bg-ink-950 md:hidden" aria-label="Navigation principale">
          {items.map(item => (
            <a key={item.id} href={item.href} aria-current={item.id === page ? 'page' : undefined}
              className={`tap flex flex-1 items-center justify-center pt-2 text-[11px] ${item.id === page ? 'text-accent' : 'text-ink-500'}`}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
```
La bibliothèque a sa propre barre du bas ; elle sera adaptée en Task 13.

- [ ] **Step 4: Connexion**

Test `apps/site/src/app/login/LoginPage.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const loginAny = vi.fn()
vi.mock('../session/session', async () => {
  const actual = await vi.importActual<typeof import('../session/session')>('../session/session')
  return { ...actual, loginAny: (...args: unknown[]) => loginAny(...args), currentSession: () => null }
})
import { LoginPage } from './LoginPage'
import { LoginError } from '../session/session'

beforeEach(() => {
  loginAny.mockReset()
  Object.defineProperty(window, 'location', { value: { replace: vi.fn(), search: '' }, writable: true })
})

describe('LoginPage', () => {
  it("redirige un prof vers son accueil", async () => {
    loginAny.mockResolvedValue({ kind: 'prof', id: '1', username: 'p' })
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Identifiant'), 'p')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(window.location.replace).toHaveBeenCalledWith('/dashboard/')
  })

  it("affiche le refus d'un compte élève sans planter", async () => {
    loginAny.mockRejectedValue(new LoginError('Les comptes élèves se connectent dans l’application de bureau, pas sur le site.'))
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('Identifiant'), 'e')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByText(/application de bureau/)).toBeInTheDocument()
    expect(window.location.replace).not.toHaveBeenCalled()
  })

  it('propose le lien « j’ai un code »', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: /j’ai un code/i })).toHaveAttribute('href', '/inscription/')
  })
})
```
`apps/site/src/app/login/LoginPage.tsx` : formulaire (identifiant `autoComplete="username"`, mot de passe `current-password`), `Field`/`inputClass`/`Button` de `@/ui/primitives`, `loginAny`, `homeFor`, `window.location.replace(homeFor(session))` ; au montage, si `currentSession()` est déjà un admin/prof, redirige (`guard(currentSession(), 'login')`). Reprendre la structure de l'ancien `bibliotheque/components/Login.tsx` (logo `BrainCircuit`, `max-w-sm`, erreur dans le `Field` du mot de passe), en remplaçant le pied de page par le lien `<a href="/inscription/">J’ai un code</a>`. Libellés exacts : `Identifiant`, `Mot de passe`, `Se connecter`. Page : `login.astro` monte `<LoginPage client:only="react" />`.
Run: `bun run --filter site test -- LoginPage` — Expected : PASS.

- [ ] **Step 5: Inscription**

Test `apps/site/src/app/inscription/validateSignup.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { codeFromSearch, validateSignup } from './validateSignup'

const base = { code: 'abcde-fghjk', username: 'prof.dupont', password: 'unmotdepasse1', confirm: 'unmotdepasse1' }

describe('validateSignup', () => {
  it('accepte et normalise le code', () => {
    const result = validateSignup(base)
    expect(result).toEqual({ ok: true, value: { code: 'ABCDEFGHJK', username: 'prof.dupont', password: 'unmotdepasse1' } })
  })
  it('refuse un code de mauvaise longueur', () => {
    const result = validateSignup({ ...base, code: 'ABC' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.code).toBeDefined()
  })
  it('refuse un identifiant hors motif', () => {
    const result = validateSignup({ ...base, username: 'a b' })
    expect(result.ok).toBe(false)
  })
  it('refuse un mot de passe de moins de 10 caractères', () => {
    const result = validateSignup({ ...base, password: 'court', confirm: 'court' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.password).toMatch(/10/)
  })
  it('refuse une confirmation différente', () => {
    const result = validateSignup({ ...base, confirm: 'autre' })
    if (result.ok) throw new Error('attendu : refus')
    expect(result.errors.confirm).toBeDefined()
  })
})

describe('codeFromSearch', () => {
  it('lit ?code=', () => expect(codeFromSearch('?code=abcde-fghjk')).toBe('ABCDE-FGHJK'.toLowerCase().toUpperCase()))
  it('ignore un code absurde sans planter', () => {
    expect(codeFromSearch('?code=' + 'x'.repeat(5000))).toHaveLength(32)
    expect(codeFromSearch('?code=%E0%A4%A')).toBe('')
    expect(codeFromSearch('')).toBe('')
  })
})
```
`apps/site/src/app/inscription/validateSignup.ts` :

```ts
import { INVITE_LENGTH, normalizeCode } from '../lib/inviteCode'

export interface SignupInput { code: string; username: string; password: string; confirm: string }
type Field = 'code' | 'username' | 'password' | 'confirm'
export type SignupResult =
  | { ok: true; value: { code: string; username: string; password: string } }
  | { ok: false; errors: Partial<Record<Field, string>> }

/** Les mêmes règles que le hook `POST /api/inscription` : le serveur re-vérifie tout. */
export function validateSignup(input: SignupInput): SignupResult {
  const errors: Partial<Record<Field, string>> = {}
  const code = normalizeCode(input.code)
  const username = input.username.trim()
  if (code.length !== INVITE_LENGTH) errors.code = `Un code fait ${INVITE_LENGTH} caractères.`
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(username)) {
    errors.username = 'Lettres, chiffres, point, tiret et underscore uniquement (64 au plus).'
  }
  if (input.password.length < 10) errors.password = 'Au moins 10 caractères.'
  if (input.confirm !== input.password) errors.confirm = 'Les deux mots de passe diffèrent.'
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { code, username, password: input.password } }
}

/** Le code d'un lien `/inscription/?code=…`, borné : l'URL est une entrée non fiable. */
export function codeFromSearch(search: string): string {
  try {
    const raw = new URLSearchParams(search).get('code') ?? ''
    return raw.toUpperCase().slice(0, 32)
  } catch {
    return ''
  }
}
```
Run `bun run --filter site test -- validateSignup`. Si `URLSearchParams` ne lève pas sur `%E0%A4%A` (il renvoie une chaîne avec un caractère de remplacement), ajuster le test pour attendre `''` **ou** une chaîne sans crash : l'exigence est « ne plante pas, ne dépasse pas 32 caractères ».

`apps/site/src/app/inscription/InscriptionPage.tsx` : quatre `Field` (Code d'inscription prérempli par `codeFromSearch(window.location.search)`, Identifiant, Mot de passe, Confirmation), `validateSignup` à l'envoi, puis

```ts
const response = await fetch('/api/inscription', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(result.value),
})
```
`200` → `await loginAny(username, password)` puis `window.location.replace('/dashboard/')` ; sinon afficher `(await response.json()).message` (repli : `L’inscription a échoué (erreur ${status}).`) sous le champ concerné (message contenant « Code » → sous le code, sinon en tête de formulaire). `429` → `Trop de tentatives. Réessayez dans une minute.` Lien « J’ai déjà un compte » → `/login/`. `inscription.astro` monte l'îlot. Libellés exacts : `Code d’inscription`, `Identifiant`, `Mot de passe`, `Confirmer le mot de passe`, bouton `Créer mon compte`.

- [ ] **Step 6: Vérification manuelle et commit**

```bash
bun run --filter site test && bun run --filter site build
```
Puis lancer un PocketBase local avec hooks (commande de Task 6 step 5), `PB_URL=http://127.0.0.1:8092 bun run --filter site dev`, ouvrir `http://localhost:1460/login/`, créer un code dans `/_/` (collection `invite_codes`), s'inscrire sur `/inscription/?code=…`, vérifier l'arrivée sur `/dashboard/` (placeholder pour l'instant), se déconnecter, se reconnecter avec l'admin (courriel) → `/gestion/`.

```bash
git add apps/site/src apps/site/package.json
git commit -m "feat(site): session, gardes de rôle, coque, connexion et inscription par code

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `/gestion` — couche de données et calculs purs

**Files:**
- Create: `apps/site/src/app/gestion/{api.ts,summaries.ts,summaries.test.ts,api.test.ts}`

**Interfaces:**
- Consumes: `pb` (Task 8), `inviteCodeState`, `generateCode`, `InviteState` (Task 5).
- Produces (`summaries.ts`, pur) : `UserRow = { id: string; username: string; role: 'prof' | 'eleve'; teacher: string; invite_code: string; created: string }` ; `CodeRow = { id: string; code: string; kind: 'unique' | 'duree'; expires_at: string; revoked: boolean; note: string; created: string }` ; `CodeView = CodeRow & { state: InviteState; inscrits: string[] }` ; `teacherCounts(users: UserRow[]): Map<string, number>` ; `summarizeCodes(codes, users, nowMs): CodeView[]` ; `filterEleves(users, teacherId: string | 'all'): UserRow[]`.
- Produces (`api.ts`, prend un `client` injectable, défaut `pb`) : `listUsers()`, `createUser({ username, password, role, teacher })`, `updateUser(id, { username?, teacher? })`, `setPassword(id, password)`, `deleteUser(id)`, `listCodes()`, `createCode({ kind, expiresAt, note })`, `revokeCode(id)`, `deleteCode(id)`. Tous renvoient des lignes typées ; les erreurs PocketBase sont traduites par `describeApiError(error)` (français).

- [ ] **Step 1: Tests purs (échouent)**

`apps/site/src/app/gestion/summaries.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { filterEleves, summarizeCodes, teacherCounts, type CodeRow, type UserRow } from './summaries'

const user = (over: Partial<UserRow>): UserRow => ({
  id: 'u', username: 'u', role: 'eleve', teacher: '', invite_code: '', created: '2026-10-01 00:00:00.000Z', ...over,
})
const code = (over: Partial<CodeRow>): CodeRow => ({
  id: 'c', code: 'ABCDEFGHJK', kind: 'unique', expires_at: '', revoked: false, note: '', created: '2026-10-01 00:00:00.000Z', ...over,
})
const NOW = Date.parse('2026-10-10T12:00:00Z')

describe('teacherCounts', () => {
  it('compte les élèves par prof et ignore les profs', () => {
    const counts = teacherCounts([
      user({ id: '1', teacher: 'A' }), user({ id: '2', teacher: 'A' }), user({ id: '3', teacher: 'B' }),
      user({ id: 'A', role: 'prof' }),
    ])
    expect(counts.get('A')).toBe(2)
    expect(counts.get('B')).toBe(1)
    expect(counts.has('')).toBe(false)
  })
})

describe('summarizeCodes', () => {
  it('calcule l’état et liste les inscrits de chaque code', () => {
    const views = summarizeCodes(
      [code({ id: '1', code: 'AAAAAAAAAA' }), code({ id: '2', code: 'BBBBBBBBBB', kind: 'duree', expires_at: '2026-10-20 00:00:00.000Z' })],
      [user({ id: 'p1', role: 'prof', username: 'dupont', invite_code: 'AAAAAAAAAA' }),
       user({ id: 'p2', role: 'prof', username: 'martin', invite_code: 'BBBBBBBBBB' }),
       user({ id: 'p3', role: 'prof', username: 'durand', invite_code: 'BBBBBBBBBB' })],
      NOW
    )
    expect(views[0]).toMatchObject({ state: 'utilise', inscrits: ['dupont'] })
    expect(views[1]).toMatchObject({ state: 'actif', inscrits: ['martin', 'durand'] })
  })
  it('met les codes actifs avant les autres, puis du plus récent au plus ancien', () => {
    const views = summarizeCodes(
      [code({ id: 'old', code: 'AAAAAAAAAA', revoked: true, created: '2026-10-09 00:00:00.000Z' }),
       code({ id: 'new', code: 'BBBBBBBBBB', created: '2026-10-08 00:00:00.000Z' })],
      [], NOW
    )
    expect(views.map(view => view.id)).toEqual(['new', 'old'])
  })
})

describe('filterEleves', () => {
  const users = [user({ id: '1', teacher: 'A' }), user({ id: '2', teacher: 'B' }), user({ id: 'A', role: 'prof' })]
  it('ne garde que les élèves', () => expect(filterEleves(users, 'all').map(u => u.id)).toEqual(['1', '2']))
  it('filtre par prof', () => expect(filterEleves(users, 'B').map(u => u.id)).toEqual(['2']))
})
```

- [ ] **Step 2: Implémenter `summaries.ts`**

```ts
import { inviteCodeState, type InviteKind, type InviteState } from '../lib/inviteCode'

export interface UserRow {
  id: string
  username: string
  role: 'prof' | 'eleve'
  teacher: string
  invite_code: string
  created: string
}

export interface CodeRow {
  id: string
  code: string
  kind: InviteKind
  expires_at: string
  revoked: boolean
  note: string
  created: string
}

export interface CodeView extends CodeRow {
  state: InviteState
  inscrits: string[]
}

export function teacherCounts(users: readonly UserRow[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const user of users) {
    if (user.role === 'eleve' && user.teacher !== '') counts.set(user.teacher, (counts.get(user.teacher) ?? 0) + 1)
  }
  return counts
}

/** Les codes actifs d'abord, puis du plus récent au plus ancien. */
export function summarizeCodes(codes: readonly CodeRow[], users: readonly UserRow[], nowMs: number): CodeView[] {
  return codes
    .map<CodeView>(row => {
      const inscrits = users.filter(user => user.role === 'prof' && user.invite_code === row.code)
      return {
        ...row,
        state: inviteCodeState(row, inscrits.length, nowMs),
        inscrits: inscrits.map(user => user.username),
      }
    })
    .sort((a, b) => {
      const rank = (view: CodeView) => (view.state === 'actif' ? 0 : 1)
      return rank(a) - rank(b) || b.created.localeCompare(a.created)
    })
}

export function filterEleves(users: readonly UserRow[], teacherId: string | 'all'): UserRow[] {
  return users.filter(user => user.role === 'eleve' && (teacherId === 'all' || user.teacher === teacherId))
}
```
Run: `bun run --filter site test -- summaries` — Expected : PASS.

- [ ] **Step 3: `api.ts` et son test (client factice)**

`apps/site/src/app/gestion/api.test.ts` : fabrique un faux client `{ collection(name) { return { getFullList, create, update, delete } } }` enregistrant les appels et vérifie :
1. `createUser` envoie `passwordConfirm` identique au mot de passe, `role` et `teacher` (vide pour un prof).
2. `setPassword` envoie `password` et `passwordConfirm`.
3. `createCode` appelle `create` avec un code de 10 caractères de l'alphabet, `kind`, `expires_at` seulement pour `duree` ; si le premier `create` lève une erreur `{ status: 400 }` (code déjà pris), il réessaie avec un autre code, jusqu'à 3 fois, puis relance l'erreur.
4. `describeApiError({ status: 400, response: { data: { username: { message: 'x' } } } })` renvoie un message français non vide ; `{ status: 0 }` → « Serveur injoignable. ».

`apps/site/src/app/gestion/api.ts` :

```ts
import { pb } from '../session/pb'
import { generateCode } from '../lib/inviteCode'
import type { CodeRow, UserRow } from './summaries'

/** Ce dont l'API a besoin du SDK : permet d'injecter un faux client en test. */
export interface Client {
  collection(name: string): {
    getFullList(options?: Record<string, unknown>): Promise<any[]>
    create(body: Record<string, unknown>): Promise<any>
    update(id: string, body: Record<string, unknown>): Promise<any>
    delete(id: string): Promise<unknown>
  }
}

const toUser = (r: any): UserRow => ({
  id: r.id, username: r.username, role: r.role === 'prof' ? 'prof' : 'eleve',
  teacher: r.teacher ?? '', invite_code: r.invite_code ?? '', created: r.created ?? '',
})
const toCode = (r: any): CodeRow => ({
  id: r.id, code: r.code, kind: r.kind, expires_at: r.expires_at ?? '', revoked: r.revoked === true,
  note: r.note ?? '', created: r.created ?? '',
})

export function describeApiError(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as any).status) : 0
  if (status === 0) return 'Serveur injoignable.'
  if (status === 401 || status === 403) return 'Accès refusé : reconnectez-vous.'
  const fields = (error as any)?.response?.data
  if (fields && typeof fields === 'object') {
    const first = Object.entries(fields)[0] as [string, { message?: string }] | undefined
    if (first?.[1]?.message) return `${first[0]} : ${first[1].message}`
  }
  const message = (error as any)?.response?.message
  return typeof message === 'string' && message !== '' ? message : `Erreur ${status}.`
}

export async function listUsers(client: Client = pb): Promise<UserRow[]> {
  return (await client.collection('users').getFullList({ sort: 'username' })).map(toUser)
}

export function createUser(
  input: { username: string; password: string; role: 'prof' | 'eleve'; teacher: string },
  client: Client = pb
) {
  return client.collection('users').create({
    username: input.username, password: input.password, passwordConfirm: input.password,
    role: input.role, teacher: input.role === 'eleve' ? input.teacher : '',
  })
}

export function updateUser(id: string, patch: { username?: string; teacher?: string }, client: Client = pb) {
  return client.collection('users').update(id, patch)
}

export function setPassword(id: string, password: string, client: Client = pb) {
  return client.collection('users').update(id, { password, passwordConfirm: password })
}

export function deleteUser(id: string, client: Client = pb) {
  return client.collection('users').delete(id)
}

export async function listCodes(client: Client = pb): Promise<CodeRow[]> {
  return (await client.collection('invite_codes').getFullList({ sort: '-created' })).map(toCode)
}

export async function createCode(
  input: { kind: 'unique' | 'duree'; expiresAt: string; note: string },
  client: Client = pb
): Promise<CodeRow> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return toCode(
        await client.collection('invite_codes').create({
          code: generateCode(), kind: input.kind, note: input.note,
          ...(input.kind === 'duree' ? { expires_at: input.expiresAt } : {}),
        })
      )
    } catch (error) {
      lastError = error
      if ((error as any)?.status !== 400) throw error   // seul un code en double mérite un nouveau tirage
    }
  }
  throw lastError
}

export function revokeCode(id: string, client: Client = pb) {
  return client.collection('invite_codes').update(id, { revoked: true })
}

export function deleteCode(id: string, client: Client = pb) {
  return client.collection('invite_codes').delete(id)
}
```
Run: `bun run --filter site test -- gestion` — Expected : PASS. (Les `any` sont confinés à ce fichier d'adaptation ; si `astro check` les refuse, typer avec `RecordModel` du SDK.)

- [ ] **Step 4: Commit**

```bash
git add apps/site/src/app/gestion
git commit -m "feat(site): données de /gestion (comptes, codes) et calculs purs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `/gestion` — interface (Profs, Élèves, Codes)

**Files:**
- Create: `apps/site/src/app/gestion/{GestionPage.tsx,ProfsTab.tsx,ElevesTab.tsx,CodesTab.tsx,useGestion.ts,TwoStepButton.tsx,GestionPage.test.tsx}`
- Modify: `apps/site/src/pages/gestion.astro`

**Interfaces:**
- Consumes: `api.ts`, `summaries.ts` (Task 9), `Protected`, `AppShell` (Task 8), `formatCode` (Task 5), primitives.
- Produces: `useGestion(): { users: UserRow[]; codes: CodeRow[]; loading: boolean; error: string | null; reload(): Promise<void> }` ; `<TwoStepButton label="Supprimer" confirmLabel="Confirmer" onConfirm={…}/>` (premier clic arme le bouton 4 s, le second exécute : remplace `confirm()` pour rester testable et ne jamais ouvrir de boîte de dialogue bloquante).

- [ ] **Step 1: Test de la page (échoue)**

`GestionPage.test.tsx` : mocke `./api` (`listUsers` renvoie un prof « dupont » avec 2 élèves, `listCodes` un code actif) et `../session/session` (`currentSession` → admin). Vérifie :
1. les trois onglets `Profs`, `Élèves`, `Codes` existent (rôle `tab`) ;
2. l'onglet Profs montre « dupont » et « 2 élèves » ;
3. le bouton `Supprimer` de « dupont » est désactivé et son titre dit qu'il reste des élèves (la suppression est de toute façon refusée par le serveur) ;
4. l'onglet Codes affiche le code formaté `AAAAA-AAAAA` avec le badge `Actif` ;
5. créer un code `duree` sans date affiche l'erreur « Choisissez une date d'expiration. » et n'appelle pas `createCode` ;
6. révoquer passe par `TwoStepButton` : un clic n'appelle pas `revokeCode`, le second oui.

- [ ] **Step 2: Implémenter**

`useGestion.ts` : charge `listUsers()` et `listCodes()` en parallèle au montage (`Promise.all`), expose `reload`, mappe l'erreur par `describeApiError`.

`TwoStepButton.tsx` :

```tsx
import { useEffect, useState } from 'react'
import { Button } from '@/ui/primitives'

export function TwoStepButton({ label, confirmLabel = 'Confirmer', onConfirm, disabled, title }: {
  label: string; confirmLabel?: string; onConfirm: () => void; disabled?: boolean; title?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])
  return (
    <Button tone="danger" disabled={disabled} title={title}
      onClick={() => { if (armed) { setArmed(false); onConfirm() } else setArmed(true) }}>
      {armed ? confirmLabel : label}
    </Button>
  )
}
```

`GestionPage.tsx` : `<Protected page="gestion">{session => <AppShell session={session} page="gestion" title="Gestion"><GestionTabs /></AppShell>}</Protected>`. `GestionTabs` = onglets `role="tablist"` (état local, `Profs` par défaut), un `ErrorBanner` avec « Réessayer » si `error`, `Spinner` pendant le chargement.

`ProfsTab` : tableau à partir de `md` (colonnes Identifiant, Élèves, Inscrit avec le code, Créé, Actions), liste de cartes en dessous (`md:hidden` / `hidden md:block`). Un formulaire « Ajouter un professeur » (identifiant + mot de passe d'au moins 10 caractères, validation locale identique à l'inscription) appelle `createUser({ role: 'prof', teacher: '' })`. Par ligne : renommer (champ inline), réinitialiser le mot de passe (champ + bouton ; **afficher le mot de passe saisi une seule fois** dans un encart `role="status"` après succès), `TwoStepButton` Supprimer **désactivé** si `teacherCounts.get(id) > 0` (`title="Rattachez ou supprimez d’abord ses N élèves"`).

`ElevesTab` : un `<select>` « Prof » (`Tous` + chaque prof) pilote `filterEleves`. Tableau (Identifiant, Prof, Créé, Actions) / cartes. Formulaire d'ajout : identifiant, mot de passe, `<select>` du prof (obligatoire). Par ligne : renommer, changer de prof (`<select>` + `updateUser(id, { teacher })`), réinitialiser le mot de passe (même encart « affiché une seule fois »), supprimer (`TwoStepButton`).

`CodesTab` : formulaire de création : `<select>` type (`Usage unique` / `Durée`), champ `datetime-local` visible seulement pour `Durée`, note. Validation : `Durée` sans date ou avec une date passée → erreur « Choisissez une date d'expiration. » / « La date d'expiration est déjà passée. ». Après création, le code s'affiche en grand dans un encart avec bouton **Copier** (`navigator.clipboard.writeText`) et le lien d'inscription `${location.origin}/inscription/?code=${code}`. Liste : `formatCode(code)`, badge d'état (`Actif`=ok, `Utilisé`=neutral, `Expiré`=warn, `Révoqué`=danger), type, échéance, note, inscrits (noms séparés par des virgules), actions : `Révoquer` (`TwoStepButton`, masqué si l'état n'est pas `actif`), `Supprimer` (`TwoStepButton`).

Toutes les actions : `try { await … ; await reload() } catch (e) { setError(describeApiError(e)) }`. Texte d'état vide pour chaque liste via `EmptyState`.

`gestion.astro` : monte `<GestionPage client:only="react" />`.
Run: `bun run --filter site test -- GestionPage && bun run --filter site build` — Expected : PASS.

- [ ] **Step 3: Vérification manuelle**

Avec le serveur local de Task 6 et `bun run --filter site dev` : se connecter en admin (`admin@test.local`), créer un code unique, s'inscrire avec dans un autre navigateur, constater que le code passe à `Utilisé` et que « Inscrits » affiche le prof ; créer un élève rattaché ; vérifier que `Supprimer` du prof est désactivé ; réduire la fenêtre sous 768 px : les tableaux deviennent des cartes, la barre du bas apparaît.

- [ ] **Step 4: Commit**

```bash
git add apps/site/src/app/gestion apps/site/src/pages/gestion.astro
git commit -m "feat(site): /gestion — profs, élèves, codes d'inscription (CRUD complet)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `/eleves` (le prof gère ses élèves)

**Files:**
- Create: `apps/site/src/app/eleves/{ElevesPage.tsx,ElevesPage.test.tsx}`
- Modify: `apps/site/src/pages/eleves.astro`

**Interfaces:**
- Consumes: `listUsers`, `createUser`, `setPassword`, `deleteUser`, `describeApiError` (Task 9), `TwoStepButton`, `Protected`, `AppShell`.
- Produces: `ElevesPage` (îlot).

Un prof ne reçoit de l'API que SES élèves (règle `listRule`) : l'interface n'a donc aucun filtre à faire, et aucune chance d'afficher ceux d'un autre.

- [ ] **Step 1: Test (échoue)**

`ElevesPage.test.tsx` : session prof `p1` ; `listUsers` mocké renvoie `[ {id:'p1', role:'prof', …}, {id:'e1', role:'eleve', teacher:'p1', username:'lea'} ]` (le prof se voit lui-même : `listRule` inclut `id = @request.auth.id`). Vérifie :
1. seule « lea » est listée (pas le prof lui-même) ;
2. le formulaire de création appelle `createUser({ username, password, role: 'eleve', teacher: 'p1' })` ;
3. un mot de passe de moins de 10 caractères n'appelle pas l'API et affiche l'erreur ;
4. après création, le mot de passe saisi est affiché une fois dans un `role="status"` avec la mention « Notez-le : il ne sera plus affiché. » ;
5. `Supprimer` passe par `TwoStepButton`.

- [ ] **Step 2: Implémenter**

`ElevesPage.tsx` : `<Protected page="eleves">` + `AppShell` titre « Mes élèves » ; `listUsers()` puis filtre `role === 'eleve' && teacher === session.id` (ceinture et bretelles) ; formulaire (Identifiant, Mot de passe avec bouton « Générer » qui remplit un mot de passe de 12 caractères tirés de `crypto.getRandomValues` sur l'alphabet de `INVITE_ALPHABET` + chiffres), liste (tableau `md+`, cartes en dessous) avec réinitialiser le mot de passe (`setPassword`, affiché une seule fois) et supprimer. Texte d'aide : « Donnez ces identifiants à l’élève, ou saisissez-les vous-même dans l’application sur sa machine. » `eleves.astro` monte l'îlot.
Run: `bun run --filter site test -- ElevesPage` — Expected : PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/site/src/app/eleves apps/site/src/pages/eleves.astro
git commit -m "feat(site): /eleves — le prof crée et gère ses élèves

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: `/dashboard` et `/compte`

**Files:**
- Create: `apps/site/src/app/dashboard/{stats.ts,stats.test.ts,DashboardPage.tsx}`, `apps/site/src/app/compte/{ComptePage.tsx,ComptePage.test.tsx}`
- Modify: `apps/site/src/pages/{dashboard,compte}.astro`

**Interfaces:**
- Consumes: `listUsers`, `listCodes` (Task 9), `summarizeCodes`, session, shell. Collections existantes `sync_events` (champs `username`, `level`, `summary`, `created`) et `sync_conflicts` (`username`, `status`).
- Produces (`stats.ts`, pur) :
  - `profStats(eleves: UserRow[], events: SyncEventRow[], conflicts: ConflictRow[]): { eleveCount: number; openConflicts: number; perEleve: { username: string; lastSyncAt: string | null; lastLevel: string | null; openConflicts: number }[] }` avec `SyncEventRow = { username: string; level: string; created: string }`, `ConflictRow = { username: string; status: string }`.
  - `adminStats(users: UserRow[], codes: CodeView[]): { profCount: number; eleveCount: number; activeCodes: number }`.

- [ ] **Step 1: Tests de `stats` (échouent)**

```ts
import { describe, it, expect } from 'vitest'
import { adminStats, profStats } from './stats'
import type { UserRow, CodeView } from '../gestion/summaries'

const eleve = (username: string): UserRow => ({ id: username, username, role: 'eleve', teacher: 'p', invite_code: '', created: '' })

describe('profStats', () => {
  const eleves = [eleve('lea'), eleve('tom')]
  it('prend la dernière synchronisation de chaque élève', () => {
    const stats = profStats(eleves, [
      { username: 'lea', level: 'info', created: '2026-10-09 10:00:00.000Z' },
      { username: 'lea', level: 'error', created: '2026-10-10 08:00:00.000Z' },
    ], [])
    const lea = stats.perEleve.find(e => e.username === 'lea')!
    expect(lea.lastSyncAt).toBe('2026-10-10 08:00:00.000Z')
    expect(lea.lastLevel).toBe('error')
    expect(stats.perEleve.find(e => e.username === 'tom')).toMatchObject({ lastSyncAt: null, lastLevel: null })
  })
  it('ne compte que les conflits ouverts de SES élèves', () => {
    const stats = profStats(eleves, [], [
      { username: 'lea', status: 'open' }, { username: 'lea', status: 'resolved' }, { username: 'autre', status: 'open' },
    ])
    expect(stats.openConflicts).toBe(1)
    expect(stats.perEleve.find(e => e.username === 'lea')!.openConflicts).toBe(1)
  })
  it('gère zéro élève', () => {
    expect(profStats([], [], [])).toEqual({ eleveCount: 0, openConflicts: 0, perEleve: [] })
  })
})

describe('adminStats', () => {
  it('compte profs, élèves et codes actifs', () => {
    const users: UserRow[] = [{ ...eleve('a') }, { ...eleve('b') }, { ...eleve('p'), role: 'prof' }]
    const codes = [{ state: 'actif' }, { state: 'utilise' }] as CodeView[]
    expect(adminStats(users, codes)).toEqual({ profCount: 1, eleveCount: 2, activeCodes: 1 })
  })
})
```
(Le prof ne reçoit les conflits et événements que des élèves de la collection selon `IS_PROF` — il voit en fait tous les comptes ; `profStats` filtre donc par les noms de SES élèves, ce que teste le second cas.)

- [ ] **Step 2: Implémenter `stats.ts`**

```ts
import type { CodeView, UserRow } from '../gestion/summaries'

export interface SyncEventRow { username: string; level: string; created: string }
export interface ConflictRow { username: string; status: string }

export function profStats(eleves: readonly UserRow[], events: readonly SyncEventRow[], conflicts: readonly ConflictRow[]) {
  const names = new Set(eleves.map(e => e.username))
  const open = conflicts.filter(c => c.status === 'open' && names.has(c.username))
  const perEleve = eleves.map(e => {
    const last = events
      .filter(ev => ev.username === e.username)
      .reduce<SyncEventRow | null>((best, ev) => (best === null || ev.created > best.created ? ev : best), null)
    return {
      username: e.username,
      lastSyncAt: last?.created ?? null,
      lastLevel: last?.level ?? null,
      openConflicts: open.filter(c => c.username === e.username).length,
    }
  })
  return { eleveCount: eleves.length, openConflicts: open.length, perEleve }
}

export function adminStats(users: readonly UserRow[], codes: readonly CodeView[]) {
  return {
    profCount: users.filter(u => u.role === 'prof').length,
    eleveCount: users.filter(u => u.role === 'eleve').length,
    activeCodes: codes.filter(c => c.state === 'actif').length,
  }
}
```
Run: `bun run --filter site test -- stats` — Expected : PASS.

- [ ] **Step 3: `DashboardPage`**

`<Protected page="dashboard">` + `AppShell` titre « Tableau de bord ». Prof : charge `listUsers()` (ses élèves), `pb.collection('sync_events').getFullList({ sort: '-created', filter: …, perPage: 500 })` limité aux 500 plus récents, et `sync_conflicts` ouverts (`filter: 'status = "open"'`) ; affiche trois tuiles (Élèves, Conflits ouverts, Dernière synchro la plus récente), un tableau par élève (dernière synchro relative via `formatRelative`, niveau en `Badge`, conflits ouverts), et des liens-cartes vers `/eleves/`, `/bibliotheque/#/conflits` (si conflits > 0, badge), `/compte/`. Les erreurs de collections absentes (404 : serveur non migré) s'affichent par `ErrorBanner` sans masquer le reste. Admin : `adminStats` en trois tuiles (Profs, Élèves, Codes actifs) et un lien-carte vers `/gestion/`. `formatRelative(iso, nowMs)` : « à l’instant », « il y a 5 min », « il y a 3 h », « il y a 2 j » (fonction pure ajoutée à `stats.ts` avec 4 cas de test : <1 min, minutes, heures, jours, et `null` → « jamais »). `dashboard.astro` monte l'îlot.

- [ ] **Step 4: `ComptePage` et son test (échoue d'abord)**

`ComptePage.test.tsx` :
1. session prof : le formulaire propose Identifiant (prérempli), Mot de passe actuel, Nouveau mot de passe, Confirmation ; changer de mot de passe appelle `pb.collection('users').update(id, { oldPassword, password, passwordConfirm })` ; un nouveau mot de passe de moins de 10 caractères n'appelle rien.
2. changer l'identifiant appelle `update(id, { username })` ; une erreur 400 de PocketBase (pseudo pris) s'affiche en français.
3. session admin : **aucun** champ de mot de passe ; un texte explique « Vos identifiants d’administration sont définis dans infra/.env (PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD) ; les modifier ici serait annulé au redémarrage du serveur. » ; le bouton `Se déconnecter` est présent.

Implémentation : `<Protected page="compte">`, deux sections pour le prof (Identifiant ; Mot de passe) avec `describeApiError`, un encart informatif pour l'admin, et `Se déconnecter` (`logout()` puis `location.replace('/login/')`). Après un changement de mot de passe, PocketBase invalide le jeton : appeler `loginAny(username, nouveauMotDePasse)` pour rester connecté. `compte.astro` monte l'îlot.

- [ ] **Step 5: Vérifier et commit**

```bash
bun run --filter site test && bun run --filter site build
git add apps/site/src/app/dashboard apps/site/src/app/compte apps/site/src/pages/dashboard.astro apps/site/src/pages/compte.astro
git commit -m "feat(site): /dashboard (récap prof et admin) et /compte

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: La bibliothèque rejoint la session et la coque du site

**Files:**
- Modify: `apps/site/src/app/bibliotheque/lib/pb.ts`, `apps/site/src/app/bibliotheque/BibliothequeApp.tsx`, `apps/site/src/pages/bibliotheque.astro`
- Delete: `apps/site/src/app/bibliotheque/components/Login.tsx` (et son usage)
- Test: les tests existants de la bibliothèque (`api.test.ts`, etc.) + un test de non-régression de `lib/pb.ts`

**Interfaces:**
- Consumes: `pb` de `session/pb.ts` (Task 8), `Protected`, `AppShell`.
- Produces: `bibliotheque/lib/pb.ts` ré-exporte `pb`, `currentUser`, `describeApiError` (mêmes noms qu'avant : le reste du code de la bibliothèque ne change pas) ; `logout` et `login` sont retirés.

- [ ] **Step 1: Une seule instance PocketBase**

Dans `bibliotheque/lib/pb.ts`, supprimer `new PocketBase(…)`, `login`, `LoginError`, `logout`, `describeAuthError` et remplacer par :

```ts
import { pb } from '@/../app/session/pb'   // chemin réel : '../../session/pb' depuis lib/
export { pb }
```
(utiliser le chemin relatif `../../session/pb`). Garder `AdminUser`, `currentUser()` (inchangé) et `describeApiError` (inchangé). Deux instances du SDK sur la même clé `localStorage` se désynchroniseraient dès qu'une seule rafraîchit son jeton : il n'y en a donc qu'une.

- [ ] **Step 2: Retirer l'écran de connexion et la coque dupliquée**

Dans `BibliothequeApp.tsx` : supprimer le `if (user === null) return <Login …/>` et l'état `user` ; la page est derrière `<Protected page="bibliotheque">`. Remplacer le `<header>` (titre, pseudo, bouton déconnexion) et la `<nav>` du bas par `AppShell` (`page="bibliotheque"`, `title="Bibliothèque"`) ; les onglets internes (`Fichiers`, `Nouvelle`, `Conflits`, `Doublons`, `Journal`, navigation `#/onglet`) deviennent une barre d'onglets en haut du contenu (rangée de liens `<a href="#/conflits">`, `aria-current`), identique en logique à l'ancienne `nav` mais visible à toutes les largeurs, le badge des conflits conservé. `LibraryView` & co. reçoivent `user` depuis `currentUser()` calculé une fois dans le composant (non nul grâce à `Protected`). Supprimer `components/Login.tsx` et tout test qui ne servait qu'à lui.

- [ ] **Step 3: Monter l'îlot protégé**

`bibliotheque.astro` reste `<BibliothequeApp client:only="react" />` ; `BibliothequeApp` enveloppe son contenu dans `<Protected page="bibliotheque">{session => …}</Protected>`.

- [ ] **Step 4: Vérifier**

```bash
bun run --filter site test 2>&1 | tail -8
bun run --filter site build
```
Expected : tous les tests de la bibliothèque passent (les imports `login`/`logout` supprimés ne sont plus utilisés ailleurs : `grep -rn "from '@/bibliotheque/lib/pb'" apps/site/src | grep -E "login|logout"` ne renvoie rien).
Vérification manuelle : connecté en prof, `/bibliotheque/` affiche la coque du site (barre latérale sur grand écran) et les cinq onglets ; déconnecté, il redirige vers `/login/` ; connecté en admin, il redirige vers `/gestion/`.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src
git commit -m "feat(site): la bibliothèque partage la session et la coque du site

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Vitrine, `CLAUDE.md` du designer, skill Astro, documentation

**Files:**
- Create: `apps/site/CLAUDE.md`, `apps/site/src/site/Hero.astro` (exemple minimal), éventuellement `.claude/skills/astro/SKILL.md` ou plugin installé
- Modify: `apps/site/src/pages/index.astro`, `infra/.env.example`, `infra/README_INFRA.md`, `CLAUDE.md` (racine), `chantier/sync/suivi.md`, `chantier/sync/06-lots.md`, `docs/superpowers/specs/2026-10-10-site-comptes-design.md`

**Interfaces:**
- Consumes: la garde `check-dist.mjs` (Task 2).
- Produces: rien pour le code ; un périmètre documenté pour la personne qui dessinera la vitrine.

- [ ] **Step 1: Chercher une skill Astro**

```bash
claude plugin marketplace list 2>/dev/null | head
```
Chercher dans les marketplaces déjà ajoutées (`/plugin` → Discover, recherche « astro ») une skill officielle ou largement utilisée. Si une existe et est maintenue, l'installer pour le projet et noter son nom dans `apps/site/CLAUDE.md`. Sinon, écrire `.claude/skills/astro-vitrine/SKILL.md` (frontmatter `name`, `description`) résumant les règles du step 3, sans copier de documentation externe. **Demander à l'utilisateur avant d'installer un plugin tiers** (installation = exécuter du code d'un tiers).

- [ ] **Step 2: La vitrine de départ**

`apps/site/src/pages/index.astro` : remplacer la page provisoire par un squelette de page produit utilisant `src/site/Hero.astro` (titre, phrase d'accroche, deux liens `/login/` et `/inscription/`), balises sémantiques (`header`, `main`, `footer`), `lang="fr"`, `<title>` et `<meta name="description">`, aucun `<script>`, aucun import de `src/app/`. Le design final est hors périmètre.
Run: `bun run --filter site build` — Expected : `✓ 7 routes + vitrine sans script`.

- [ ] **Step 3: `apps/site/CLAUDE.md`**

Contenu (en français) :
1. Ce que c'est : le site de la suite, Astro statique ; la vitrine `/` et l'application connectée (îlots React) cohabitent.
2. **Périmètre du designer** : `src/pages/index.astro`, `src/site/`, et les images sous `src/assets/`. Tout le reste (`src/app/`, `src/pages/<autres>.astro`, `astro.config.mjs`, `scripts/`) est hors périmètre.
3. Règles Astro : zéro JavaScript côté client par défaut (la garde du build échoue sinon) ; composants `.astro` pour tout ce qui est statique ; un îlot (`client:*`) seulement pour un vrai besoin d'interaction, jamais pour de la mise en page ; images via `astro:assets` (`<Image>`) avec `width`/`height`/`alt` ; polices auto-hébergées (aucun appel à un CDN) ; Tailwind 4 avec les jetons de `src/styles/app.css` (ne pas les renommer : l'application s'en sert) ou des styles `<style>` scopés ; titres hiérarchisés, contrastes AA, `prefers-reduced-motion` respecté.
4. Liens internes : toujours avec la barre finale (`/login/`).
5. Commandes : `bun run --filter site dev` (port 1460), `build`, `test`.
6. Pas d'import de `@suite/shared` côté vitrine ; pas de `@tauri-apps/*` nulle part dans ce projet.
7. Le nom de la skill Astro retenue au step 1.

- [ ] **Step 4: Documentation d'exploitation**

`infra/.env.example` : ajouter, au-dessus des variables, un paragraphe : « `PB_ADMIN_EMAIL` et `PB_ADMIN_PASSWORD` sont aussi l'identifiant de la page /gestion du site (connexion de l'administrateur). Les changer ici change la connexion de /gestion ; ne les modifiez pas depuis /compte, ce serait annulé au redémarrage. » Garder les trois variables existantes ; **aucune nouvelle**.
`infra/README_INFRA.md` : (a) tableau d'URL : `/` vitrine, `/login/ /inscription/ /gestion/ /dashboard/ /eleves/ /compte/ /bibliotheque/` le site, `/api/…`, `/_/` ; (b) section « Comptes » : admin = superutilisateur, un prof naît d'un code créé dans `/gestion/`, un élève est créé par son prof dans `/eleves/` ; (c) section « Hooks » : `pb_hooks/` copié dans `/pb_hooks`, ce que font `inscription.pb.js` et `users.pb.js`, et que le Dockerfile les embarque ; (d) section « Tests » : `bun run test:infra`, `bun run infra/integration.mjs` (procédure de Task 6/7) ; (e) retirer tout ce qui parle de `admin/` comme dossier.
`CLAUDE.md` (racine) : (1) arbre du dépôt : ajouter `apps/site/` et `infra/` ; (2) remplacer la section « Zachar't Mentale's second front-end: the web admin » par une section « Le site (`apps/site`) » : Astro statique, routes, îlots React, `/bibliotheque` = ex-admin avec l'alias `@app` réservé à `src/app/bibliotheque/` (frontière dans `src/boundary.test.ts`), hooks, `infra/` à la racine ; (3) commandes : `bun run test:infra`, `test:all`, `infra:apply|check|plan`, port 1460 ; retirer `test:admin` ; (4) corriger « Synchronisation and PocketBase belong to Zachar't Mentale only » : la synchronisation reste celle de Mentale, mais le serveur et les comptes (profs, élèves, codes) servent désormais la suite. **Attention** : `CLAUDE.md` a des modifications locales non committées dans le dépôt principal ; faire cette édition dans le worktree, et prévenir l'utilisateur d'un possible conflit à la fusion.
`chantier/sync/suivi.md` et `06-lots.md` : S1 « déplacement d'`infra/` : fait » ; S7 « inscription prof, gestion des élèves : livré par le plan 2026-10-10-site-comptes (distribution, copies, corbeille : restent à faire) ».
Spec : noter les deux écarts assumés (§3 : `invite_code` est un texte et non une relation ; fonction d'état en deux implémentations + table commune ; `/compte` de l'admin en lecture seule).

- [ ] **Step 5: Vérification finale**

```bash
bun run test:all
bunx tsc --noEmit -p apps/zachart-mentale 2>&1 | tail -3
bun run --filter site build
PB_ADMIN_EMAIL=a@b.test PB_ADMIN_PASSWORD=MotDePasse1234! docker compose -f infra/docker-compose.yml build
```
Expected : tout vert. Puis lancer l'image construite, appliquer le schéma, jouer `integration.mjs` (Task 7 step 4) et parcourir à la main : `/` (vitrine sans JS : onglet Réseau sans `.js`), `/login/`, inscription, `/dashboard/`, `/eleves/`, `/bibliotheque/`, `/gestion/` (admin), `/compte/` ; réduire à 375 px.

- [ ] **Step 6: Commit**

```bash
git add apps/site infra/.env.example infra/README_INFRA.md CLAUDE.md chantier/sync docs/superpowers/specs/2026-10-10-site-comptes-design.md
git commit -m "docs(site): vitrine de départ, périmètre du designer, doc d'exploitation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Couverture de la spec** (section → tâche) : §1 structure/build → T2, T3 (+ Dockerfile T3) ; §2 comptes et règles → T4, T6 (S8), T8 (gardes) ; §3 codes (collection, état, hook, erreurs, plafond, alphabet) → T4, T5, T6, T7 ; §4 pages → T8 (`/login`, `/inscription`), T10 (`/gestion`), T11 (`/eleves`), T12 (`/dashboard`, `/compte`), T13 (`/bibliotheque`) ; §5 `.env`, designer, tests, docs, ordre → T14, T1-T14 dans l'ordre de la spec (la migration de la bibliothèque passe en T3, avant la connexion, pour que l'image ne perde jamais l'admin ; l'étape 7 de la spec devient T13 pour la partie session). Aucune exigence sans tâche.

**Écarts avec la spec, à valider par l'utilisateur** : (1) `invite_code` est un champ texte et non une relation vers `invite_codes` ; (2) la fonction d'état des codes existe en deux implémentations (JS du hook, TS du site) qui rejouent une même table de cas, faute de pouvoir importer un module CommonJS dans le bundle ; (3) `/compte` de l'admin est en lecture seule (son mot de passe serait réécrit par `infra/.env` à chaque démarrage) ; (4) la limitation de débit repose sur les règles de PocketBase et sa propre politique d'activation.

**Cohérence des noms** : `inviteCodeState`, `isUsable`, `normalizeCode` (T5) sont repris à l'identique dans T6 (hook) et T9 ; `Session`/`PageId`/`guard`/`homeFor`/`navFor`/`Protected` (T8) dans T10-T13 ; `UserRow`/`CodeRow`/`CodeView` (T9) dans T10-T12 ; `TwoStepButton` (T10) dans T11.

**Points d'incertitude assumés** : la compatibilité exacte des versions Astro / `@astrojs/react` / Vite 8 (T2 step 1), le libellé de règle de débit reconnu par PocketBase (T7 step 4), le comportement de `manageRule` sur la création et la réinitialisation (T6 S8), le service de `/login` sans barre finale (T2 step 6) et `bun install --filter` avec `--frozen-lockfile` dans Docker (T3 step 7). Chacun a une commande de vérification et un remède écrit dans la tâche.
