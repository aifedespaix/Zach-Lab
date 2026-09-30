# Monorepo de la suite éducative — design

Date : 2026-09-30. Statut : à relire avant plan d'implémentation.

## 1. Intention

Transformer ce dépôt (aujourd'hui une seule app, Zachar't Mentale) en monorepo
hébergeant une **suite de logiciels éducatifs Tauri** qui partagent une base
commune : mise à jour automatique, coquille d'interface, charte graphique,
palette de commandes, raccourcis, recherche. Le prochain logiciel est une app
de **maths / exercices**.

### Ce qui a été dit

- Stack : **React 19 + TypeScript** (le brief parlait de Vue 3 ; c'est faux, on
  reste en React).
- Recherche : un **vrai moteur plein texte partagé**, **Orama**, en JS en mémoire.
- Versions : **une version par app**, tags préfixés.
- Consommation de `packages/shared` : **un seul package en sources TS brutes**.
- La synchro PocketBase, `admin/` et `infra/` restent **propres à Zachar't
  Mentale**. L'app de maths n'a pas de synchro : cours versionnés dans git et
  compilés dans l'app, exercices gérés en local par l'élève.

### Hypothèses (à corriger si fausses)

- Les cours de l'app de maths sont indexés au build (index sérialisé), les
  exercices de l'élève à l'exécution.
- `admin/` et `infra/` déménagent avec Zachar't Mentale ; une autre app
  aura son propre dossier d'infra le jour où elle en a besoin.

### Critères de succès

- Zachar't Mentale fonctionne à l'identique : `tsc` propre, **2468 tests** verts,
  `tauri build` OK, mises à jour des installations existantes préservées.
- `apps/base` démarre (`tauri dev`) et affiche un shell vide fonctionnel.
- `bun run new-app <nom>` produit une app qui démarre.

### Hors périmètre

L'app de maths elle-même, la synchro partagée, toute publication d'un package
hors du monorepo, la réécriture en Vue.

## 2. Structure

```
package.json          workspaces Bun : apps/*, packages/*
Cargo.toml            workspace Cargo : apps/*/src-tauri, crates/*
bun.lock, Cargo.lock  uniques, à la racine

apps/zachart-mentale/   app actuelle (git mv, historique conservé)
  src/ src-tauri/ admin/ infra/ public/ index.html vite.config.ts …
apps/base/              coquille vide, template de départ
packages/shared/        @suite/shared (React, TS, sources brutes)
crates/suite-tauri/     crate Rust partagé

scripts/ tools/ docs/ .github/   restent à la racine
```

- Un seul `target/` Rust et un seul `Cargo.lock`. Chaque app garde son
  `tauri.conf.json` (identifiant, nom, icônes, updater).
- Scripts par app : `bun run --filter zachart-mentale tauri dev`. Les scripts
  racine `dev`, `test`, `build` délèguent avec `--filter`.
- Ports Vite : zachart-mentale 1420, admin 1430, base 1440 ; ports HMR
  décalés en conséquence.
- `bump-version.mjs` prend le nom de l'app et met à jour ensemble son
  `package.json`, son `tauri.conf.json` et son `Cargo.toml` (corrige la dérive
  actuelle : Cargo en 1.6.0 contre 1.20.5).
- `.cours/` et `.cartes-mentales/` (gitignorés, données réelles) ne bougent pas ;
  les chemins ignorés (`.gitignore`, `watch.ignored` de Vite) restent valables.
- L'alias `@app` de `admin/` pointe vers le nouveau `apps/zachart-mentale/src`.

## 3. `packages/shared`

Sous-chemins : `@suite/shared/{ui,theme,update,shell,commands,settings,search}`.
`theme.css` s'importe côté CSS ; chaque app déclare `@source` vers
`packages/shared` (Tailwind 4 ne scanne pas un package externe).

**Règle d'or : `shared` n'importe jamais depuis une app.** Les apps injectent
leur contenu par props, slots ou enregistrement de commandes. Un test le vérifie,
ainsi que « rien sous `admin/` n'importe `@tauri-apps/*` ». Chaque sous-dossier
n'est importé que par son chemin public.

### Extraction directe (aucun couplage)

`useAppUpdater`, `UpdateReadyBanner`, `components/ui/*`, `BootScreen`,
`AnimatedLogo`, `circularReveal`, `contrast`, `shortcuts/keys.ts`.

### Extraction avec découpe

| Élément | Découpe |
|---|---|
| Palette, commandes, raccourcis | Le bloc registre + `useCommand` + `CommandPalette` + `useShortcutSettingsStore` est partagé. `useGlobalShortcuts` perd son import de `useQuizStore` : l'app injecte ses contextes de raccourcis. |
| Thème | `useThemeStore` (clair/sombre/système) partagé ; l'apparence des cartes (couleurs de niveaux) reste dans l'app. `useResolvedTheme` se rebranche sur le store partagé. |
| Paramètres | Cadre partagé (`SettingsDialog` en slots, `SettingsSection`, `SettingToggle`, `ShortcutSettingsPanel`) ; les panneaux Quiz, Sync, Apparence restent dans l'app. |
| Layout | `AppShell` à trois slots (gauche, centre, droite), largeurs redimensionnables et persistées (`sidebarWidth`, `panelWidth`). `FileSidebar` et `CardDetailPanel` restent dans l'app. |
| Barre d'outils | `AppToolbar` reste dans l'app (dépend des cartes, export, publication, quiz). Le partagé fournit un cadre de barre et `CommandButton`/`CommandMenuItem`. |
| Charte | `index.css` (1760 lignes) : jetons (`:root`, `@theme`, `.dark`), Geist et animations vont dans `theme.css` ; styles de cartes/canvas restent dans l'app. Le tri du reste se fait pendant le plan, section par section. |

### Reste dans `apps/zachart-mentale`

`content/`, `quiz/`, `xmind/`, `export/`, `validation/`, `colors/`, `layout/`,
reducers et historique, `sync/`, `pocketbaseClient`, `FileSidebar`/`FileTreeRow`,
`admin/`, `infra/`, association `.zmap`, identifiant `com.clape.zachart-mentale`.

### Moteur de recherche (`/search`)

- Basé sur **Orama** (`@orama/orama`) ; version et API exactes à vérifier au
  moment du plan.
- `createSearchIndex(schema, options)` avec analyseur français configuré une
  fois (accents, stemming, tolérance aux fautes) ; ajout, mise à jour,
  suppression de documents ; `search()` avec scores ; sérialisation de
  l'index (index précompilé des cours au build).
- Chaque app décrit ses documents et son schéma.
- Remplace `src/search/textSearch.ts` et `scoreCard.ts` (apportés par
  `card-search-quick-capture`). `CommandPalette` et la recherche de cartes
  migrent dessus. Le dispatcher Ctrl+F (`app.find`) est conservé.

### Rust : `crates/suite-tauri`

`suite_tauri::builder()` enregistre updater, dialog, fs, opener et
single-instance (déjà dans `lib.rs`) et fournit le dimensionnement de fenêtre
selon l'écran. Le décodage des fichiers ouverts (`mind_map_arg`) prend la liste
d'extensions en paramètre (`.zmap`, autre chose pour les maths).

## 4. `apps/base`

Coquille : `AppShell` avec sidebars vides, barre minimale (palette, thème,
paramètres), `SettingsDialog` avec le seul panneau de raccourcis,
`UpdateReadyBanner`, `src-tauri` appelant `suite_tauri::builder()`, test de
fumée du shell. `createUpdaterArtifacts` désactivé tant qu'aucune clé n'est
configurée.

`bun run new-app <nom>` copie `apps/base` et remplace nom, identifiant Tauri,
port Vite, endpoint updater.

## 5. Migration (chaque étape finit verte : `tsc` + tests ; `tauri build` aux étapes 1 et 5)

1. Racine + workspaces Bun + `git mv` vers `apps/zachart-mentale/` + correction
   des chemins (alias, `@app`, `frontendDist`, scripts). Aucun changement de code.
2. Workspace Cargo + extraction de `crates/suite-tauri`.
3. `packages/shared`, dans l'ordre : `theme.css` + `ui`, `update`, `commands` +
   raccourcis, `shell`, `settings`. Tests déplacés avec le code.
4. Moteur Orama, puis migration de la palette et de la recherche de cartes.
5. `apps/base` + `new-app`.
6. Release/CI, `CLAUDE.md`, README, regénération du graphe graphify.

## 6. Tests

Les tests suivent leur code. `packages/shared` a son `vitest.config.ts` (comme
`admin/`). Tests de frontière (voir §3). Moteur de recherche testé en français
(accents, pluriels, fautes). Le `vitest.config.ts` racine continue d'exclure
`admin/**`.

## 7. Release et CI

- `release.yml` se déclenche sur `zachart-v*`, `base-v*`… avec le bon
  `projectPath` pour `tauri-action` ; `rust-cache` pointe vers la racine.
  `build.yml` et `infra-pocketbase.yml` adaptés aux nouveaux chemins.
- **Risque principal — l'updater en production.** Les installations actuelles
  interrogent `releases/latest/download/latest.json`, et `releases/latest`
  désigne la dernière release **du dépôt, toutes apps confondues**. Une release
  de l'app de maths casserait les mises à jour de Zachar't Mentale.
  Décision : un endpoint stable par app, sur une release « roulante »
  (ex. tag `updater-zachart`) dont le `latest.json` est réécrit à chaque
  publication. Zachar't Mentale publie une version de transition qui pointe
  vers ce nouvel endpoint ; pendant la transition, ses releases restent les
  « latest » du dépôt et celles des autres apps sont créées sans ce statut.
  La mécanique exacte de `tauri-action` est à valider dans le plan.
- Signature : une clé **par app** (`TAURI_SIGNING_PRIVATE_KEY_<APP>`) pour
  limiter l'impact d'une fuite. Aucun secret n'est créé ni lu par l'agent.

## 8. Points ouverts pour le plan

- Tri fin de `index.css` (jetons génériques contre styles de cartes).
- Vérification de la mécanique `tauri-action` (`projectPath`, `make_latest`,
  releases multiples) et du répertoire de travail de `beforeDevCommand`.
- Branche distante `origin/claude/nifty-carson-ionw1j` (`newMapOwner`) : non
  mergée, en conflit avec `main` sur la synchro ; à retraiter dans
  `apps/zachart-mentale` après la bascule si on la veut.
