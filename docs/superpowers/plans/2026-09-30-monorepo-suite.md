# Monorepo de la suite éducative — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le dépôt en monorepo (Bun + Cargo) avec `apps/zachart-mentale`, `apps/base`, `packages/shared` et `crates/suite-tauri`, sans régression de Zachar't Mentale.

**Architecture:** L'app actuelle est déplacée avec `git mv` dans `apps/zachart-mentale/`. Le code générique est extrait par petits lots vers un seul package `@suite/shared` (sources TS brutes, sous-chemins `exports`) et une crate `suite-tauri`. Chaque lot laisse `tsc` et la suite de tests verts. Le moteur de recherche Orama est ajouté à `@suite/shared/search`, puis `apps/base` et un script `new-app` en découlent.

**Tech Stack:** Bun workspaces, Cargo workspace, React 19, TypeScript 6, Vite 8, Vitest 5, Tailwind 4, Tauri 2, Orama.

**Spec:** `docs/superpowers/specs/2026-09-30-monorepo-suite-design.md`

## Global Constraints

- Une version par app ; tags `zachart-v*`, `base-v*` ; un `latest.json` par app.
- Ports Vite : zachart-mentale 1420, admin 1430, base 1440. Ports HMR : 1421, 1431, 1441.
- `packages/shared` n'importe **jamais** depuis une app : ni `@/…`, ni `@app`, ni chemin relatif qui sort de `packages/shared/src`. Dans `shared`, les imports internes sont **relatifs** (jamais `@/`).
- Rien sous `admin/` n'importe `@tauri-apps/*`, ni `@suite/shared/update`.
- Sous-chemins publics : `@suite/shared/{ui,theme,update,shell,commands,settings,search}` + `@suite/shared/theme.css`. On n'importe jamais un fichier interne de `shared`.
- Chaque app déclare `@source` vers `packages/shared/src` dans son CSS d'entrée (Tailwind 4).
- Toute étape finit avec `bunx tsc --noEmit` propre (par workspace) et `bun run test` vert. Base de référence : **2468 tests** (168 fichiers) avant la migration.
- Les tests suivent leur code. Ne jamais `git add -A` : ajouter des chemins explicites (`infra/.env`, `.cours/`, `.cartes-mentales/` ne doivent jamais être ajoutés ; ne jamais `git add -f` dessus).
- Le chemin du dépôt contient une apostrophe (`Zachar't-Mentale`) : citer tous les chemins dans les scripts shell.
- Aucun secret n'est créé, lu ni écrit par l'agent (clés de signature Tauri, `infra/.env`).
- Chaque commit se termine par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (deuxième `-m`).
- Les messages de commit et commentaires suivent le style existant (français, `type(scope): …`).

## Review Focus

Les entrées que la spec implique mais que les tests de chaque tâche ne couvriraient pas naturellement. Chacune a un test attaché dans la tâche indiquée.

1. **Recherche française : entrées limites.** Requête vide, requête faite uniquement de caractères spéciaux (`(`, `[`, `.*`, `\`), accents (`été` ↔ `ete`), pluriels, faute de frappe, index de 0 document. → Tâche 11.
2. **Index sérialisé corrompu ou d'une autre version.** Doit se reconstruire, pas planter. → Tâche 11.
3. **Arguments de lancement inattendus.** `.ZMAP` en majuscules, `--` de `cargo tauri dev`, argument sans extension, `argv[0]` seul. → Tâche 3 (tests Rust portés).
4. **Premier lancement sans aucun état persisté.** `base` démarre avec zéro fichier de config. → Tâche 13.
5. **Endpoint de mise à jour.** Un `latest.json` par app ; celui de Zachar't ne doit jamais pointer vers `releases/latest`. → Tâche 15.

---

## Task 1: Branche de travail et référence

**Files:** aucun changement de code.

- [ ] **Step 1: Créer la branche**

```bash
cd "C:/Users/clape/Documents/dev/Zachar't-Mentale"
git status --short          # doit être vide
git switch -c feat/monorepo
```

- [ ] **Step 2: Noter la référence**

```bash
bunx tsc --noEmit && bun run test 2>&1 | tail -6
```
Expected: `Tests 2468 passed (2468)`. Reporter le nombre dans `.superpowers/sdd/monorepo/baseline.txt` (dossier gitignoré) pour comparer plus tard.

- [ ] **Step 3: Sauvegarde du seul état non versionné qui compte**

`infra/.env` est ignoré par git ; il suit le dossier lors du `git mv`, mais on en garde une copie :
```bash
mkdir -p ".superpowers/sdd/monorepo" && cp infra/.env ".superpowers/sdd/monorepo/infra.env.bak" 2>/dev/null; echo done
```
(`.superpowers/` est gitignoré. Ne pas afficher le contenu.)

---

## Task 2: Racine Bun et déplacement de l'app

**Files:**
- Create: `package.json` (racine, remplace l'ancien), `tsconfig.base.json`
- Move: tout ce qui appartient à l'app → `apps/zachart-mentale/`
- Modify: `.gitignore`, `.dockerignore`, `infra/docker-compose.yml`, `infra/Dockerfile`, `infra/Dockerfile.schema`, `.github/workflows/{build,release,infra-pocketbase}.yml`, `scripts/bump-version.mjs` (chemins seulement)

**Interfaces:**
- Produces : workspace Bun `zachart-mentale` ; scripts racine `dev`, `build`, `test`, `test:admin`, `test:all`, `tauri` qui délèguent avec `--filter`.

- [ ] **Step 1: Déplacer l'app avec l'historique**

```bash
cd "C:/Users/clape/Documents/dev/Zachar't-Mentale"
mkdir -p apps/zachart-mentale
git mv src src-tauri admin infra public index.html vite.config.ts vitest.config.ts tsconfig.json tsconfig.node.json components.json apps/zachart-mentale/
git mv package.json apps/zachart-mentale/package.json
rm -rf dist node_modules bun.lock   # regénérés par bun install
```
`README.md`, `CLAUDE.md`, `scripts/`, `tools/`, `docs/`, `.github/` restent à la racine.

- [ ] **Step 2: Nouveau `package.json` racine**

```json
{
  "name": "suite-educative",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun run --filter zachart-mentale dev",
    "build": "bun run --filter zachart-mentale build",
    "tauri": "bun run --filter zachart-mentale tauri",
    "test": "bun run --filter '*' test",
    "test:admin": "cd apps/zachart-mentale/admin && bun run test",
    "test:all": "bun run test && bun run test:admin",
    "admin:dev": "cd apps/zachart-mentale/admin && bun run dev",
    "admin:build": "cd apps/zachart-mentale/admin && bun run build",
    "infra:check": "bun run apps/zachart-mentale/infra/setup-pocketbase.mjs --check",
    "infra:plan": "bun run apps/zachart-mentale/infra/setup-pocketbase.mjs --dry-run",
    "infra:apply": "bun run apps/zachart-mentale/infra/setup-pocketbase.mjs",
    "version:bump": "bun scripts/bump-version.mjs"
  }
}
```

Dans `apps/zachart-mentale/package.json`, retirer les scripts `test:admin`, `test:all`, `admin:*`, `infra:*`, `version:bump` (désormais à la racine) et garder `dev`, `build`, `preview`, `tauri`, `test`. Ajouter `"@tauri-apps/cli": "^2"` s'il n'y est pas (il y est déjà en devDependencies).

- [ ] **Step 3: `tsconfig.base.json` à la racine**

Y mettre les `compilerOptions` communs (target, lib, module, moduleResolution `bundler`, `jsx`, `strict`, `noUnused*`, `noEmit`, `skipLibCheck`, `isolatedModules`, `allowImportingTsExtensions`, `resolveJsonModule`, `useDefineForClassFields`) tels qu'actuellement dans `apps/zachart-mentale/tsconfig.json`, **sans** `paths`/`include`. Puis réduire `apps/zachart-mentale/tsconfig.json` à :

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Corriger les chemins ignorés**

Dans `.gitignore`, remplacer (un motif contenant `/` au milieu est ancré à la racine, il ne matcherait plus) :
```
src-tauri/target/            ->  /target/
src-tauri/gen/schemas        ->  apps/*/src-tauri/gen/schemas
infra/.env                   ->  apps/*/infra/.env
infra/backups/               ->  apps/*/infra/backups/
```
Vérifier que `.env` reste ignoré **avant** tout `git add` :
```bash
git check-ignore -v apps/zachart-mentale/infra/.env
```
Expected : une ligne citant la règle. Sinon STOP.

Dans `.dockerignore`, remplacer `admin/node_modules/` par `**/node_modules/`, `admin/dist/` par `**/dist/`, `src-tauri/target/` et `src-tauri/` par `**/src-tauri/`, `infra/backups/` et `infra/.env` par `apps/*/infra/backups/` et `apps/*/infra/.env`.

- [ ] **Step 5: Docker et compose**

`apps/zachart-mentale/infra/docker-compose.yml` : `context: ..` devient `context: ../../..` (racine du dépôt) et `dockerfile: infra/Dockerfile` devient `dockerfile: apps/zachart-mentale/infra/Dockerfile` (idem `Dockerfile.schema`).
`Dockerfile` :
```dockerfile
COPY apps/zachart-mentale/admin/package.json apps/zachart-mentale/admin/bun.lock ./apps/zachart-mentale/admin/
RUN cd apps/zachart-mentale/admin && bun install --frozen-lockfile
COPY apps/zachart-mentale/admin ./apps/zachart-mentale/admin
COPY apps/zachart-mentale/src ./apps/zachart-mentale/src
RUN cd apps/zachart-mentale/admin && bun run build
COPY --from=build /build/apps/zachart-mentale/admin/dist /pb_public
```
`Dockerfile.schema` : `COPY package.json bun.lock ./` devient `COPY apps/zachart-mentale/package.json ./package.json` **seulement si** il dépend des dépendances de l'app ; lire le fichier et n'y installer que `pocketbase` (voir ses lignes 24-41) ; `COPY infra ./infra` devient `COPY apps/zachart-mentale/infra ./infra`.
Grep de contrôle :
```bash
grep -rn "\.\./src\|src-tauri\|\.\./admin" apps/zachart-mentale/infra | head
```
Corriger chaque chemin relatif trouvé (`pocketbase-schema.mjs`, `docker-compose.yml`).

- [ ] **Step 6: CI (chemins seulement)**

`build.yml` : jobs `admin` : `working-directory: apps/zachart-mentale/admin`. Job `build-windows` : `rust-cache` `workspaces: './apps/zachart-mentale/src-tauri -> target'`, `working-directory: apps/zachart-mentale/src-tauri` pour `cargo test`, `bun tauri build` sous `working-directory: apps/zachart-mentale`, artefact `apps/zachart-mentale/src-tauri/target/release/bundle/nsis/*-setup.exe`.
`release.yml` : `rust-cache` idem ; `tauri-action` reçoit `projectPath: apps/zachart-mentale`.
`infra-pocketbase.yml` : préfixer `infra/`, `src/sync/**`, `src/persistence/**` et les commandes `bun run infra/...` par `apps/zachart-mentale/`.
`scripts/bump-version.mjs` : les deux chemins (`package.json`, `src-tauri/tauri.conf.json`) deviennent `apps/zachart-mentale/package.json` et `apps/zachart-mentale/src-tauri/tauri.conf.json` (réécrit proprement à la Tâche 15).

- [ ] **Step 7: Installer et vérifier**

```bash
bun install
bunx tsc --noEmit -p apps/zachart-mentale
bun run test 2>&1 | tail -6
bun run test:admin 2>&1 | tail -6
```
Expected : `2468 passed` ; suite admin verte (mêmes nombres qu'avant). Si l'alias `@app` d'admin est cassé : `../src` reste correct (admin et src ont bougé ensemble), donc c'est un autre chemin.

- [ ] **Step 8: Vérifier Tauri en vrai**

```bash
cd apps/zachart-mentale && bun tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}' 2>&1 | tail -15
```
Expected : installeur NSIS produit sous `src-tauri/target/release/bundle/nsis/`. Vérifier au passage que `beforeBuildCommand: "bun run build"` s'est exécuté dans `apps/zachart-mentale` (le build Vite écrit `apps/zachart-mentale/dist`). Si Tauri lance ces commandes ailleurs, corriger `tauri.conf.json` avec `bun run --cwd`/`--filter` et noter la règle dans la spec (§8).

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.base.json .gitignore .dockerignore .github scripts apps bun.lock
git commit -m "refactor(monorepo): l'app devient apps/zachart-mentale, workspaces Bun à la racine" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git status --short   # rien d'inattendu, et surtout pas infra/.env
```

---

## Task 3: Workspace Cargo et crate `suite-tauri`

**Files:**
- Create: `Cargo.toml` (racine), `crates/suite-tauri/Cargo.toml`, `crates/suite-tauri/src/lib.rs`
- Modify: `apps/zachart-mentale/src-tauri/Cargo.toml`, `apps/zachart-mentale/src-tauri/src/lib.rs`, workflows
- Move: `apps/zachart-mentale/src-tauri/Cargo.lock` → `Cargo.lock`

**Interfaces:**
- Produces (crate `suite_tauri`) :
  - `pub fn file_arg(args: &[String], extensions: &[&str]) -> Option<String>`
  - `pub fn size_main_window_to_screen(app: &tauri::App)`
  - `pub struct SuiteConfig { pub open_extensions: &'static [&'static str], pub open_event: &'static str }`
  - `pub fn builder(config: SuiteConfig) -> tauri::Builder<tauri::Wry>` — enregistre fs, opener, dialog, updater, et single-instance (desktop) qui émet `config.open_event` avec le fichier trouvé puis ramène la fenêtre `main` au premier plan.

- [ ] **Step 1: Workspace racine** — `Cargo.toml` :

```toml
[workspace]
resolver = "2"
members = ["apps/zachart-mentale/src-tauri", "crates/suite-tauri"]

# Les profils ne sont lus que depuis la racine du workspace.
[profile.release]
codegen-units = 1
lto = true
opt-level = 3
panic = "abort"
strip = true
```
Retirer le bloc `[profile.release]` de `apps/zachart-mentale/src-tauri/Cargo.toml`. Puis :
```bash
git mv apps/zachart-mentale/src-tauri/Cargo.lock Cargo.lock
cargo check --workspace 2>&1 | tail -5
```
Expected : compile. Le répertoire `target/` est maintenant à la racine (ignoré par `/target/`).

- [ ] **Step 2: Test qui échoue — la crate**

`crates/suite-tauri/Cargo.toml` :
```toml
[package]
name = "suite-tauri"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-opener = "2"
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-updater = "2"

[target.'cfg(any(target_os = "macos", windows, target_os = "linux"))'.dependencies]
tauri-plugin-single-instance = "2"
```
Ajouter `"crates/suite-tauri"` aux membres (déjà fait), puis dans `crates/suite-tauri/src/lib.rs` **d'abord** les tests, en reprenant tous les tests existants de `mind_map_arg` (lire `apps/zachart-mentale/src-tauri/src/lib.rs`, module `tests`) et en remplaçant `mind_map_arg(&args(&[…]))` par `file_arg(&args(&[…]), &["zmap", "json"])`. Ajouter :

```rust
#[test]
fn ignores_the_cargo_tauri_dev_separator() {
    assert_eq!(file_arg(&args(&["app.exe", "--", "x.zmap"]), &["zmap"]), Some("x.zmap".to_string()));
}
#[test]
fn ignores_an_extension_it_was_not_told_about() {
    assert_eq!(file_arg(&args(&["app.exe", "x.pdf"]), &["zmap"]), None);
}
#[test]
fn rejects_a_bare_extension_without_a_dot() {
    assert_eq!(file_arg(&args(&["app.exe", "zmap"]), &["zmap"]), None);
}
```
```bash
cargo test -p suite-tauri 2>&1 | tail -8
```
Expected : FAIL (`file_arg` non défini).

- [ ] **Step 3: Implémenter la crate**

```rust
use tauri::{Emitter, Manager};

/// Extensions à reconnaître et événement à émettre : c'est tout ce qui diffère
/// d'une app à l'autre dans la gestion « Ouvrir avec ».
pub struct SuiteConfig {
    pub open_extensions: &'static [&'static str],
    pub open_event: &'static str,
}

/// Le fichier d'une ligne de commande, s'il y en a un.
///
/// Comparer sur l'extension plutôt que prendre `argv[1]` à l'aveugle évite de
/// transmettre au frontend un drapeau, ou le `--` que `cargo tauri dev` ajoute.
pub fn file_arg(args: &[String], extensions: &[&str]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|arg| {
            let lower = arg.to_lowercase();
            extensions
                .iter()
                .any(|extension| lower.ends_with(&format!(".{extension}")))
        })
        .cloned()
}

pub fn size_main_window_to_screen(app: &tauri::App) {
    // Corps repris tel quel de `src-tauri/src/lib.rs` (fonction du même nom).
}

pub fn builder(config: SuiteConfig) -> tauri::Builder<tauri::Wry> {
    let builder = tauri::Builder::default();

    // Enregistré EN PREMIER, comme l'exige le plugin.
    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(move |app, argv, _cwd| {
        if let Some(path) = file_arg(&argv, config.open_extensions) {
            let _ = app.emit(config.open_event, path);
        }
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
}
```
Copier le corps réel de `size_main_window_to_screen` et **tous** les commentaires d'origine (ils expliquent le pourquoi) ; ne pas utiliser `cfg(desktop)` dans la crate (cet alias n'existe que dans les crates qui appellent `tauri_build`) : la liste explicite des OS ci-dessus le remplace.

- [ ] **Step 4: Faire passer**

```bash
cargo test -p suite-tauri 2>&1 | tail -8
```
Expected : PASS (tous les tests portés + 3 nouveaux).

- [ ] **Step 5: Brancher l'app**

`apps/zachart-mentale/src-tauri/Cargo.toml` : ajouter `suite-tauri = { path = "../../../crates/suite-tauri" }`, retirer `tauri-plugin-opener`, `-fs`, `-dialog`, `-updater`, `-single-instance` (désormais portés par la crate). `src-tauri/src/lib.rs` devient :

```rust
const OPEN_EXTENSIONS: &[&str] = &["zmap", "json"];

/// The map the app was launched to open, read fresh from the process's own
/// command line. Returns `None` for a normal launch, which is the common case.
#[tauri::command]
fn launch_mind_map() -> Option<String> {
    suite_tauri::file_arg(&std::env::args().collect::<Vec<_>>(), OPEN_EXTENSIONS)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    suite_tauri::builder(suite_tauri::SuiteConfig {
        open_extensions: OPEN_EXTENSIONS,
        open_event: "open-mind-map",
    })
    .invoke_handler(tauri::generate_handler![launch_mind_map])
    .setup(|app| {
        suite_tauri::size_main_window_to_screen(app);
        Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```
Supprimer de ce fichier `mind_map_arg`, `size_main_window_to_screen` et le module `tests` (déplacés). Conserver `MIND_MAP_EXTENSIONS` sous le nom `OPEN_EXTENSIONS` avec son commentaire d'origine.

- [ ] **Step 6: Vérifier**

```bash
cargo test --workspace 2>&1 | tail -6
cd apps/zachart-mentale && bun tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}' 2>&1 | tail -8
```
Expected : tests Rust verts, installeur produit sous `../../target/release/bundle/nsis/`.

- [ ] **Step 7: CI** — `build.yml`/`release.yml` : `rust-cache` `workspaces: '. -> target'` ; `cargo test` devient `cargo test --workspace` à la racine ; artefact `target/release/bundle/nsis/*-setup.exe`.

- [ ] **Step 8: Commit**

```bash
git add Cargo.toml Cargo.lock crates apps/zachart-mentale/src-tauri .github
git commit -m "refactor(tauri): workspace Cargo et crate suite-tauri (plugins, fichier ouvert, fenêtre)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Squelette de `packages/shared` et garde-fous

**Files:**
- Create: `packages/shared/{package.json,tsconfig.json,vitest.config.ts}`, `packages/shared/src/{lib/utils.ts,test/setup.ts,boundary.test.ts}`, `scripts/move-module.mjs`
- Modify: `apps/zachart-mentale/package.json` (dépend de `@suite/shared`)

**Interfaces:**
- Produces : `@suite/shared` (workspace) ; `scripts/move-module.mjs <ancien-chemin> <nouveau-chemin> <spécificateur>` réécrit les imports de l'app ; `cn` dans `packages/shared/src/lib/utils.ts`.

- [ ] **Step 1: `packages/shared/package.json`**

```json
{
  "name": "@suite/shared",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    "./theme.css": "./src/theme/theme.css"
  },
  "scripts": { "test": "vitest run" },
  "peerDependencies": { "react": "^19.1.0", "react-dom": "^19.1.0" },
  "dependencies": {},
  "devDependencies": {
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^6.0.2",
    "jsdom": "^30.0.1",
    "typescript": "~6.0.3",
    "vitest": "^5.0.0"
  }
}
```
Les entrées `exports` (`./ui`, `./update`, …) et les dépendances runtime (radix-ui, lucide-react, motion, class-variance-authority, zustand, `@tauri-apps/plugin-updater`, `@orama/orama`) sont ajoutées **par la tâche qui extrait le module correspondant**, pour que chaque commit reste cohérent. Dans `apps/zachart-mentale/package.json` ajouter `"@suite/shared": "workspace:*"`.

- [ ] **Step 2: `tsconfig.json` et `vitest.config.ts`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```
`src/test/setup.ts` : `import '@testing-library/jest-dom/vitest'`, puis copier de `apps/zachart-mentale/src/test/setup.ts` **uniquement** le shim `jest.advanceTimersByTime` (sans les mocks React Flow) et ajouter, si absent, un `ResizeObserver` no-op (Radix en a besoin sous jsdom) :

```ts
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
```

- [ ] **Step 3: Test de frontière (échoue d'abord s'il y a une violation)**

`packages/shared/src/boundary.test.ts` :

```ts
import { describe, expect, it } from 'vitest'

const sources = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const IMPORT = /(?:from|import|vi\.mock)\s*\(?\s*['"]([^'"]+)['"]/g

function specifiers(source: string): string[] {
  return [...source.matchAll(IMPORT)].map(match => match[1])
}

describe('frontière de @suite/shared', () => {
  const files = Object.entries(sources).filter(([path]) => !path.endsWith('boundary.test.ts'))

  it('scanne bien des fichiers', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s n\'importe rien d\'une app', (path, source) => {
    for (const specifier of specifiers(source)) {
      expect(specifier, `${path} importe ${specifier}`).not.toMatch(/^@\//)
      expect(specifier, `${path} importe ${specifier}`).not.toMatch(/^@app/)
      expect(specifier, `${path} importe ${specifier}`).not.toMatch(/apps\//)
    }
  })

  it.each(files)('%s ne sort pas de packages/shared/src', (path, source) => {
    const depth = path.split('/').length - 2 // « ./a/b.ts » : 1 niveau dans src
    for (const specifier of specifiers(source)) {
      if (!specifier.startsWith('.')) continue
      const up = specifier.split('/').filter(part => part === '..').length
      expect(up, `${path} remonte trop haut avec ${specifier}`).toBeLessThanOrEqual(depth)
    }
  })
})
```
Avec `lib/utils.ts` créé (Step 4), lancer `bun run --filter @suite/shared test` : le test « scanne des fichiers » doit passer.

- [ ] **Step 3b: Test de frontière d'`admin`** — `apps/zachart-mentale/admin/src/boundary.test.ts`, même mécanique que ci-dessus (`import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', … })`), qui vérifie qu'aucun fichier d'`admin/src` ne contient un import de `@tauri-apps/`, et que ses seuls imports `@suite/shared/…` sont `ui`, `theme` ou `search` (liste blanche). `commands`, `settings`, `shell` et `update` peuvent toucher Tauri (persistance des raccourcis, mises à jour) et sont donc interdits à `admin`. Il s'exécute avec `bun run test:admin`.

- [ ] **Step 4: `cn`**

Copier `apps/zachart-mentale/src/lib/utils.ts` vers `packages/shared/src/lib/utils.ts` (`cn` = `clsx` + `tailwind-merge` ou ce que le fichier utilise ; ajouter ses dépendances à `packages/shared/package.json`). Ne pas le supprimer de l'app tant que `components/ui/*` n'a pas bougé (Tâche 5).

- [ ] **Step 5: Script de déplacement**

`scripts/move-module.mjs` — réécrit tous les imports de l'app qui pointaient sur un module déplacé :

```js
#!/usr/bin/env bun
// Usage : bun scripts/move-module.mjs <app> <ancien> <nouveau> <spécificateur>
//   <app>           dossier de l'app, ex. apps/zachart-mentale
//   <ancien>        chemin (depuis <app>/src, sans extension) du module qui BOUGE
//   <nouveau>       chemin du fichier dans packages/shared/src (sans extension)
//   <spécificateur> ce que l'app importera désormais, ex. @suite/shared/ui
//
// `git mv` est fait par l'appelant ; ce script ne touche qu'aux imports.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const [app, oldModule, , specifier] = process.argv.slice(2)
if (!specifier) {
  console.error('Usage: bun scripts/move-module.mjs <app> <ancien> <nouveau> <spécificateur>')
  process.exit(1)
}
const srcRoot = resolve(app, 'src')
const target = resolve(srcRoot, oldModule)
const LITERAL = /(['"])((?:\.{1,2}\/|@\/)[^'"]+)\1/g

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx)$/.test(name)) yield full
  }
}

const strip = path => path.replace(/\.(tsx?|jsx?)$/, '')
let changed = 0
for (const file of walk(srcRoot)) {
  const source = readFileSync(file, 'utf8')
  const next = source.replace(LITERAL, (whole, quote, value) => {
    const absolute = value.startsWith('@/')
      ? resolve(srcRoot, value.slice(2))
      : resolve(dirname(file), value)
    return strip(absolute) === strip(target) ? `${quote}${specifier}${quote}` : whole
  })
  if (next !== source) {
    writeFileSync(file, next)
    changed += 1
  }
}
console.log(`${changed} fichier(s) réécrit(s) pour ${oldModule} -> ${specifier}`)
```
Limite connue : un module à **export par défaut** ne peut pas devenir un import nommé automatiquement ; pour ceux-là, ajouter `export { default as Nom } from './chemin'` au barrel et corriger l'import de l'app à la main.

- [ ] **Step 6: Vérifier et committer**

```bash
bun install
bun run test 2>&1 | tail -6   # app + shared verts
git add packages scripts/move-module.mjs apps/zachart-mentale/package.json bun.lock
git commit -m "feat(shared): squelette de @suite/shared, test de frontière et outil de déplacement" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Charte graphique et primitives UI

**Files:**
- Create: `packages/shared/src/theme/theme.css`, `packages/shared/src/ui/index.ts`, `packages/shared/src/theme/index.ts`
- Move: `components/ui/{button,context-menu,dialog,dropdown-menu,hint,slider,switch,tooltip}.tsx` (+ tests), `theme/circularReveal.ts` (+ test), `colors/contrast.ts` (+ test) → `packages/shared/src/{ui,theme}/`
- Modify: `packages/shared/package.json` (exports + deps), `apps/zachart-mentale/src/index.css`, `apps/zachart-mentale/components.json`

**Interfaces:**
- Produces : `@suite/shared/ui` (tous les composants ci-dessus, exports nommés) ; `@suite/shared/theme` (`circularReveal`, `contrast`) ; `@suite/shared/theme.css` (jetons + Geist + animations).

- [ ] **Step 1: Trier `index.css`**

Lire `apps/zachart-mentale/src/index.css` en entier. Classer chaque bloc :
- **Partagé** : `@import "tw-animate-css"`, `"shadcn/tailwind.css"`, `"@fontsource-variable/geist"`, `@custom-variant dark`, `:root`, `.dark`, `@theme` (jetons de couleurs, rayons, polices) et les `@layer base` génériques (bordures, `body`).
- **App** : tout ce qui vise `.react-flow`, cartes, canvas, description/équations, KaTeX, quiz, arbre de fichiers.
Écrire la liste des blocs déplacés dans le message de commit. En cas de doute sur un bloc, il **reste** dans l'app (il pourra migrer plus tard ; l'inverse casserait l'apparence de `base`).

- [ ] **Step 2: Créer `theme.css` et l'importer**

Y coller les blocs partagés (mêmes valeurs, mêmes commentaires). Dans `apps/zachart-mentale/src/index.css`, à la place des blocs déplacés :
```css
@import "tailwindcss";
@import "@suite/shared/theme.css";
@source "../../../packages/shared/src";
```
(garder les autres `@import` propres à l'app : `katex/dist/katex.min.css`, etc.). Ajouter `"./theme.css"` déjà exporté (Tâche 4) et `@fontsource-variable/geist`, `tw-animate-css`, `shadcn` aux dépendances de `shared`.

- [ ] **Step 3: Vérifier l'apparence sans régression**

```bash
bun run --filter zachart-mentale build 2>&1 | tail -8
```
Expected : build OK. Puis lancer `bun run dev`, ouvrir l'app (skill `run`) et comparer thème clair et sombre à la version d'avant : couleurs, polices, boutons. Un composant sans style = `@source` manquant.

- [ ] **Step 4: Déplacer les composants UI**

Pour chaque module (exemple `button`) :
```bash
cd "C:/Users/clape/Documents/dev/Zachar't-Mentale"
git mv apps/zachart-mentale/src/components/ui/button.tsx packages/shared/src/ui/button.tsx
bun scripts/move-module.mjs apps/zachart-mentale components/ui/button ui/button @suite/shared/ui
```
Faire de même pour `context-menu`, `dialog`, `dropdown-menu`, `hint`, `slider`, `switch`, `tooltip` **et leurs `*.test.tsx`** (les tests déplacés gardent leurs imports relatifs `./button`). Dans chaque fichier déplacé : remplacer `@/lib/utils` par `../lib/utils`. Puis `circularReveal` → `theme/`, `contrast` → `theme/`, avec le spécificateur `@suite/shared/theme`.

- [ ] **Step 5: Barrels et exports**

`packages/shared/src/ui/index.ts` : `export * from './button'` … pour chaque module (si deux modules exportent le même nom, préfixer à la main). `theme/index.ts` : `export * from './circularReveal'; export * from './contrast'`. Dans `packages/shared/package.json` :
```json
"exports": {
  "./theme.css": "./src/theme/theme.css",
  "./theme": "./src/theme/index.ts",
  "./ui": "./src/ui/index.ts"
}
```
Ajouter les dépendances runtime utilisées (au minimum `radix-ui`, `lucide-react`, `class-variance-authority`, `motion`, `clsx`/`tailwind-merge` selon `lib/utils.ts`) en reprenant les versions de l'app. `apps/zachart-mentale/components.json` : alias `ui` → `@suite/shared/ui`… **non** : shadcn génère dans un dossier réel. Mettre `"ui": "../../packages/shared/src/ui"` dans `aliases` pour que `shadcn add` écrive dans le partagé, et noter la règle dans le README du package.

- [ ] **Step 6: Vérifier**

```bash
bun install && bunx tsc --noEmit -p apps/zachart-mentale && bunx tsc --noEmit -p packages/shared
bun run test 2>&1 | tail -6
```
Expected : tout vert ; le total de tests (app + shared) égale la référence (2468 + tests de frontière). Vérifier aussi `admin` :
```bash
grep -rn "components/ui\|circularReveal\|contrast" apps/zachart-mentale/admin/src | head
```
Si `admin` importe un module déplacé via `@app/…`, ajouter l'alias `@suite/shared` à `admin/{vite.config.ts,vitest.config.ts,tsconfig.json}` (chemin `../../../packages/shared/src`), et `COPY packages ./packages` au `Dockerfile` (après `COPY apps/zachart-mentale/src …`).

- [ ] **Step 7: Commit**

```bash
git add packages apps/zachart-mentale bun.lock
git commit -m "refactor(shared): charte graphique (theme.css) et primitives UI" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Mise à jour automatique

**Files:**
- Move: `hooks/useAppUpdater.ts` (+ test), `components/update/UpdateReadyBanner.tsx` (+ test) → `packages/shared/src/update/`
- Create: `packages/shared/src/update/index.ts`
- Modify: `packages/shared/package.json`

**Interfaces:**
- Produces : `@suite/shared/update` : `useAppUpdater`, `UpdateReadyBanner` (exports tels que dans les fichiers d'origine).

- [ ] **Step 1: Lire** `hooks/useAppUpdater.ts` et `UpdateReadyBanner.tsx` pour repérer export par défaut ou nommés ; ils n'ont aucun import interne.
- [ ] **Step 2: Déplacer**

```bash
git mv apps/zachart-mentale/src/hooks/useAppUpdater.ts packages/shared/src/update/useAppUpdater.ts
git mv apps/zachart-mentale/src/hooks/useAppUpdater.test.ts packages/shared/src/update/useAppUpdater.test.ts
git mv apps/zachart-mentale/src/components/update/UpdateReadyBanner.tsx packages/shared/src/update/UpdateReadyBanner.tsx
git mv apps/zachart-mentale/src/components/update/UpdateReadyBanner.test.tsx packages/shared/src/update/UpdateReadyBanner.test.tsx
bun scripts/move-module.mjs apps/zachart-mentale hooks/useAppUpdater update/useAppUpdater @suite/shared/update
bun scripts/move-module.mjs apps/zachart-mentale components/update/UpdateReadyBanner update/UpdateReadyBanner @suite/shared/update
```
- [ ] **Step 3: Barrel, exports, dépendances**

`update/index.ts` : `export * from './useAppUpdater'` et `export * from './UpdateReadyBanner'` (ajouter `export { default as UpdateReadyBanner }` si export par défaut, et corriger l'import de l'app). `package.json` de `shared` : `"./update": "./src/update/index.ts"`, dépendance `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process` si utilisé. L'endpoint et la clé publique restent dans le `tauri.conf.json` de chaque app.
- [ ] **Step 4: Vérifier** `bun install && bunx tsc --noEmit -p apps/zachart-mentale && bun run test 2>&1 | tail -6` → vert.
- [ ] **Step 5: Commit** `refactor(shared): mise à jour automatique`.

---

## Task 7: Commandes, palette et raccourcis

**Files:**
- Move → `packages/shared/src/commands/` : `shortcuts/keys.ts`, `types/commands.ts` (+ test), `types/shortcutSettings.ts`, `persistence/shortcutSettings.ts` (+ test), `state/{useCommandRegistry,useShortcutSettingsStore}.ts` (+ test), `hooks/{useCommand,useGlobalShortcuts}.ts` (+ tests), `components/commands/*`, `components/settings/{ShortcutRecorder,ShortcutSettingsPanel,SettingsSection}.tsx` (+ tests)
- Create: `packages/shared/src/commands/index.ts`
- Modify: `useGlobalShortcuts` (découplage), `apps/zachart-mentale/src/App.tsx`

**Interfaces:**
- Consumes : `@suite/shared/ui`, `@suite/shared/theme`.
- Produces : `useGlobalShortcuts({ isContextActive })` où `isContextActive: (context: string) => boolean` est fourni par l'app ; le reste conserve ses signatures actuelles.

- [ ] **Step 1: Cartographier** — lire `hooks/useGlobalShortcuts.ts` et repérer chaque usage de `useQuizStore` (contexte « quiz actif »). Lire `types/commands.ts` pour voir si un champ « contexte » existe déjà.
- [ ] **Step 2: Test qui échoue** — dans le nouveau `useGlobalShortcuts.test.tsx` déplacé, remplacer la mise en place du `useQuizStore` par le paramètre :

```tsx
renderHook(() => useGlobalShortcuts({ isContextActive: context => context === 'quiz' }))
```
et garder les mêmes assertions (une commande de contexte `quiz` ne se déclenche que si `isContextActive('quiz')`). Lancer : FAIL (paramètre inconnu).
- [ ] **Step 3: Implémenter** — `useGlobalShortcuts` remplace chaque lecture de `useQuizStore` par `isContextActive(...)`. Dans l'app, `App.tsx` passe `isContextActive: context => context === 'quiz' && useQuizStore.getState().active` (adapter au vrai champ lu à l'étape 1).
- [ ] **Step 4: Déplacer** les fichiers listés (`git mv` + `bun scripts/move-module.mjs … @suite/shared/commands` pour chacun, en mirroir : `commands/keys.ts`, `commands/types.ts` …). Dans les fichiers déplacés, remplacer les imports vers `../ui/…` par `../ui` (qui existent déjà) et **supprimer tout import restant vers l'app** (le test de frontière et `tsc` les signalent).
- [ ] **Step 5: Recherche de la palette** — `CommandPalette` importe `../../search/textSearch` : **ne pas déplacer** `textSearch` (il disparaît à la Tâche 12). Injecter le classement : `CommandPalette` reçoit la prop `rank: (query: string, commands: Command[]) => Command[]` avec, en attendant, l'implémentation actuelle passée par l'app. La Tâche 12 remplacera cette implémentation par Orama.
- [ ] **Step 6: Barrel et exports** — `commands/index.ts` re-exporte tout ; `"./commands": "./src/commands/index.ts"` ; dépendances `zustand`, etc.
- [ ] **Step 7: Vérifier** `bunx tsc --noEmit` (app et shared) puis `bun run test` → vert, total inchangé. Lancer l'app (`run`) : Ctrl+K ouvre la palette, un raccourci personnalisé se conserve après redémarrage.
- [ ] **Step 8: Commit** `refactor(shared): palette de commandes et raccourcis clavier`.

---

## Task 8: Store de thème partagé

**Files:**
- Create: `packages/shared/src/theme/{useThemeStore.ts,useThemeStore.test.ts,useResolvedTheme.ts,useResolvedTheme.test.ts}`
- Modify: `apps/zachart-mentale/src/state/useAppearanceSettingsStore.ts`, `hooks/useResolvedTheme.ts` (remplacé), les appelants

**Interfaces:**
- Produces :
  - `type ThemeMode = 'light' | 'dark' | 'system'`
  - `useThemeStore` : `{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }`, persisté (clé `theme-mode`).
  - `useResolvedTheme(): 'light' | 'dark'`.

- [ ] **Step 1: Lire** `useAppearanceSettingsStore.ts`, `types/appearanceSettings.ts` et `persistence/appearanceSettings.ts` : repérer le champ « thème » (mode clair/sombre/système) et tout ce qui en dépend.
- [ ] **Step 2: Tests d'abord** — `useThemeStore.test.ts` : mode par défaut `'system'` sans état persisté ; `setMode('dark')` persiste et se relit ; valeur persistée invalide → retombe sur `'system'`. `useResolvedTheme.test.ts` : `'system'` suit `prefers-color-scheme` (mock `matchMedia`) ; `'dark'` renvoie `'dark'`. Lancer : FAIL.
- [ ] **Step 3: Implémenter** en reprenant la persistance existante (mêmes clés que l'app pour ne pas perdre le réglage des utilisateurs : lire la clé actuelle et la réutiliser ou migrer la valeur à la première lecture).
- [ ] **Step 4: Rebrancher l'app** — `useAppearanceSettingsStore` perd son champ de mode ; les appelants (`AppToolbar`, `AppliedFontFamily`, etc.) utilisent `useThemeStore`. Supprimer `hooks/useResolvedTheme.ts` de l'app au profit du partagé (`move-module.mjs`).
- [ ] **Step 5: Vérifier** — tests verts ; dans l'app, basculer clair/sombre, redémarrer : le choix est conservé (y compris pour un utilisateur qui avait déjà choisi « sombre » avant la migration).
- [ ] **Step 6: Commit** `refactor(shared): store de thème clair/sombre/système`.

---

## Task 9: `AppShell` (sidebars gauche/droite)

**Files:**
- Create: `packages/shared/src/shell/{AppShell.tsx,AppShell.test.tsx,AppToolbarFrame.tsx,index.ts}`
- Move: `persistence/{sidebarWidth,panelWidth}.ts` (+ tests) → `shell/`, `components/{BootScreen,AnimatedLogo,CanvasErrorBoundary}.tsx` → `shell/`
- Modify: `apps/zachart-mentale/src/App.tsx`

**Interfaces:**
- Produces :
  ```tsx
  interface AppShellProps {
    toolbar?: ReactNode
    left?: ReactNode          // contenu de la sidebar gauche ; absente => pas de sidebar
    right?: ReactNode         // contenu du panneau droit
    children: ReactNode       // zone centrale
    leftStorageKey: string    // clé de persistance de la largeur
    rightStorageKey: string
  }
  export function AppShell(props: AppShellProps): JSX.Element
  ```

- [ ] **Step 1: Lire** `App.tsx` autour des lignes 418 et 583 (`FileSidebar`, `CardDetailPanel`), la mise en page qui les entoure, et `sidebarWidth.ts`/`panelWidth.ts` pour comprendre le redimensionnement et les bornes.
- [ ] **Step 2: Tests d'abord** (`AppShell.test.tsx`) :
  - rend `children` seul quand `left` et `right` sont absents ;
  - rend `left` et `right` quand fournis, chacun dans une région étiquetée (`role="complementary"`, `aria-label` « Panneau gauche » / « Panneau droit ») ;
  - la largeur restaurée depuis le stockage est appliquée (`style.width`) ;
  - une largeur persistée absurde (négative, `NaN`, énorme) est ramenée dans les bornes.
  Lancer : FAIL.
- [ ] **Step 3: Implémenter** `AppShell` en reprenant la logique de largeur et de glissement de `App.tsx` (sans le contenu). Les bornes viennent de `sidebarWidth.ts`/`panelWidth.ts`.
- [ ] **Step 4: Déplacer** `BootScreen`, `AnimatedLogo`, `CanvasErrorBoundary`, `sidebarWidth`, `panelWidth` avec leurs tests ; `move-module.mjs … @suite/shared/shell`.
- [ ] **Step 5: Rebrancher `App.tsx`** : `<AppShell left={<FileSidebar …/>} right={<CardDetailPanel />} …>` à la place de la mise en page manuelle. `AppToolbar` reste dans l'app et passe dans `toolbar`.
- [ ] **Step 6: Vérifier** tests verts ; dans l'app, redimensionner les deux panneaux, redémarrer, retrouver les largeurs. `App.test.tsx` doit rester vert **sans** être réécrit ; s'il casse, corriger le code, pas le test.
- [ ] **Step 7: Commit** `refactor(shared): AppShell à sidebars redimensionnables`.

---

## Task 10: Cadre des paramètres

**Files:**
- Move → `packages/shared/src/settings/` : `SettingToggle.tsx`, `SettingsSection.tsx` (si pas déjà déplacé en Tâche 7), `SettingsDialog` (refondu en cadre)
- Modify: `apps/zachart-mentale/src/components/settings/SettingsDialog.tsx` (devient une composition)
- Create: `packages/shared/src/settings/{SettingsDialog.tsx,SettingsDialog.test.tsx,index.ts}`

**Interfaces:**
- Produces :
  ```tsx
  interface SettingsPanelDef { id: string; label: string; icon?: ReactNode; render: () => ReactNode }
  interface SettingsDialogProps { open: boolean; onOpenChange: (open: boolean) => void; panels: SettingsPanelDef[] }
  ```
  `SettingsDialog` affiche la liste `panels` en navigation et le `render()` du panneau actif.

- [ ] **Step 1: Lire** `SettingsDialog.tsx` et `SettingsDialog.test.tsx` (il importe les panneaux Quiz/Sync/Apparence et `useAppUpdater`).
- [ ] **Step 2: Tests d'abord** dans `packages/shared/src/settings/SettingsDialog.test.tsx` : rend un onglet par panneau ; le premier est actif par défaut ; cliquer un autre affiche son contenu ; `panels=[]` ne plante pas (message vide) ; fermer appelle `onOpenChange(false)`. FAIL attendu.
- [ ] **Step 3: Implémenter** le cadre en reprenant le balisage de `SettingsDialog.tsx` d'origine, sans aucun panneau importé.
- [ ] **Step 4: Recomposer dans l'app** — `SettingsDialog.tsx` de l'app devient : construit la liste `panels` (Général, Apparence, Quiz, Raccourcis via `ShortcutSettingsPanel` partagé, Synchronisation) et renvoie le `SettingsDialog` partagé. Déplacer/adapter le test existant : ses assertions sur les panneaux restent dans l'app.
- [ ] **Step 5: Vérifier** tests verts, total en hausse seulement des nouveaux tests ; ouvrir les paramètres dans l'app, parcourir tous les panneaux.
- [ ] **Step 6: Commit** `refactor(shared): cadre de paramètres à panneaux injectés`.

---

## Task 11: Moteur de recherche Orama

**Files:**
- Create: `packages/shared/src/search/{createSearchIndex.ts,createSearchIndex.test.ts,serialize.ts,serialize.test.ts,index.ts}`
- Modify: `packages/shared/package.json` (`"./search"`, dépendances `@orama/orama` et le stemmer français — voir Step 1)

**Interfaces:**
- Produces :
  ```ts
  export interface SearchDocument { id: string; [field: string]: string | number | boolean | string[] }
  export interface SearchHit { id: string; score: number }
  export interface SearchIndex {
    add(doc: SearchDocument): void
    update(doc: SearchDocument): void
    remove(id: string): void
    search(term: string, options?: { limit?: number; fields?: string[] }): SearchHit[]
    size(): number
    serialize(): string
  }
  export function createSearchIndex(fields: string[]): SearchIndex
  export function loadSearchIndex(fields: string[], serialized: string): SearchIndex // reconstruit à vide si le contenu est illisible ou d'une autre forme
  ```
  `createSearchIndex(fields)` : tous les champs sont des `string` indexés en plein texte, en français.

- [ ] **Step 1: Sonder l'API réelle (spike de 5 minutes)** — la doc Orama n'a pas pu être consultée pendant la rédaction du plan (Context7 indisponible). Installer, puis vérifier dans les types réels avant d'écrire du code :
```bash
cd packages/shared && bun add @orama/orama @orama/stemmers
grep -n "french\|stemmer" node_modules/@orama/orama/dist/esm/index.d.ts ../../node_modules/@orama/stemmers/package.json 2>/dev/null | head
```
Noter : nom de l'option de langue (`language: 'french'`), export du stemmer français, signatures de `create`, `insert`, `update`, `remove`, `search` (`term`, `tolerance`, `properties`, `limit`), et `save`/`load` (sérialisation). Si un nom diffère de ceux utilisés ci-dessous, **corriger le code et les tests de ce plan avant de continuer**, et consigner la différence dans la spec (§3, « Moteur de recherche »).
- [ ] **Step 2: Tests d'abord** (`createSearchIndex.test.ts`) — chaque cas est indépendant :

```ts
import { describe, expect, it } from 'vitest'
import { createSearchIndex } from './createSearchIndex'

const cours = () => {
  const index = createSearchIndex(['title', 'body'])
  index.add({ id: 'a', title: 'Les fractions', body: 'Additionner deux fractions de même dénominateur' })
  index.add({ id: 'b', title: 'Été et saisons', body: 'Le cycle des saisons' })
  index.add({ id: 'c', title: 'Géométrie', body: 'Triangles et cercles' })
  return index
}

describe('createSearchIndex', () => {
  it('trouve un mot exact', () => {
    expect(cours().search('fractions')[0]?.id).toBe('a')
  })
  it('ignore les accents dans les deux sens', () => {
    expect(cours().search('ete')[0]?.id).toBe('b')
    expect(cours().search('géométrie')[0]?.id).toBe('c')
  })
  it('reconnaît le singulier et le pluriel', () => {
    expect(cours().search('fraction')[0]?.id).toBe('a')
    expect(cours().search('triangle')[0]?.id).toBe('c')
  })
  it('tolère une faute de frappe', () => {
    expect(cours().search('fractoins')[0]?.id).toBe('a')
  })
  it('renvoie [] pour une requête vide ou blanche', () => {
    expect(cours().search('')).toEqual([])
    expect(cours().search('   ')).toEqual([])
  })
  it.each(['(', '[', '.*', '\\', '"', '%', '🙂'])('ne plante pas sur %s', term => {
    expect(() => cours().search(term)).not.toThrow()
  })
  it('fonctionne sur un index vide', () => {
    expect(createSearchIndex(['title']).search('x')).toEqual([])
    expect(createSearchIndex(['title']).size()).toBe(0)
  })
  it('respecte limit', () => {
    expect(cours().search('les', { limit: 1 }).length).toBeLessThanOrEqual(1)
  })
  it('update remplace, remove supprime', () => {
    const index = cours()
    index.update({ id: 'a', title: 'Décimaux', body: 'Nombres à virgule' })
    expect(index.search('fractions')).toEqual([])
    expect(index.search('décimaux')[0]?.id).toBe('a')
    index.remove('a')
    expect(index.search('décimaux')).toEqual([])
    expect(index.size()).toBe(2)
  })
  it('add sur un id déjà présent ne crée pas de doublon', () => {
    const index = cours()
    index.add({ id: 'a', title: 'Les fractions', body: 'x' })
    expect(index.size()).toBe(3)
  })
  it('gère de longs textes', () => {
    const index = createSearchIndex(['body'])
    index.add({ id: 'long', body: 'mot '.repeat(50_000) })
    expect(index.search('mot')[0]?.id).toBe('long')
  })
})
```
Lancer : FAIL (module absent).
- [ ] **Step 3: Implémenter** `createSearchIndex.ts` avec les noms vérifiés au Step 1. Forme attendue :

```ts
import { create, insert, remove, search, update, count, save } from '@orama/orama'
// + import du stemmer français relevé au Step 1

export function createSearchIndex(fields: string[]): SearchIndex {
  const schema = Object.fromEntries(fields.map(field => [field, 'string' as const]))
  const db = create({ schema, language: 'french' /* + components.tokenizer.stemmer selon le Step 1 */ })
  // add : si l'id existe déjà, faire update (jamais de doublon)
  // search : trim, '' => [], try/catch => [], tolerance: 1, limit par défaut 20
  // size : count(db)
  // serialize : JSON.stringify(save(db)) plus un champ de forme { v: 1, fields }
}
```
Tenir un `Set<string>` des ids pour `add`/`update`/`remove` idempotents. `search` ne doit jamais lever : un `try/catch` renvoie `[]`.
- [ ] **Step 4: Sérialisation — tests d'abord** (`serialize.test.ts`) :

```ts
it('un index rechargé donne les mêmes résultats', () => { /* build, serialize, loadSearchIndex, comparer search('fractions') */ })
it.each(['', 'pas du json', '{}', '{"v":999}', 'null', '[1,2,3]'])(
  'un contenu illisible (%s) donne un index vide, sans planter',
  bad => {
    const index = loadSearchIndex(['title'], bad)
    expect(index.size()).toBe(0)
    expect(() => index.add({ id: 'x', title: 'ok' })).not.toThrow()
  },
)
it('refuse un index construit avec d\'autres champs', () => { /* champs différents => index vide */ })
```
FAIL, puis implémenter `loadSearchIndex` : `try { JSON.parse; vérifier v === 1 et fields identiques; load(db, data) } catch { return createSearchIndex(fields) }`.
- [ ] **Step 5: Vérifier** `bun run --filter @suite/shared test` vert ; `tsc` propre. Ajouter `"./search": "./src/search/index.ts"` aux exports.
- [ ] **Step 6: Commit** `feat(search): moteur plein texte Orama en français (index sérialisable)`.

---

## Task 12: Migrer la palette et la recherche de cartes sur Orama

**Files:**
- Modify: `apps/zachart-mentale/src/components/commands/*` (déjà partagé) → l'app fournit `rank` ; `apps/zachart-mentale/src/search/{scoreCard.ts,textSearch.ts}` (supprimés) ; consommateurs de `scoreCard`/`textSearch` (dispatcher `app.find`, recherche de cartes)
- Create: `apps/zachart-mentale/src/search/useCardSearch.ts` (+ test)

**Interfaces:**
- Consumes : `createSearchIndex`, `SearchIndex` de `@suite/shared/search`.
- Produces : `useCardSearch(cards): (query: string) => string[]` — ids de cartes classés.

- [ ] **Step 1: Inventaire** — `grep -rn "textSearch\|scoreCard\|matchScore\|rankedScore\|fold(" apps/zachart-mentale/src | grep -v "\.test\."` : liste exacte des consommateurs à migrer. Lire leurs tests : ils décrivent le comportement à conserver (ordre de classement, correspondances partielles, accents).
- [ ] **Step 2: Tests d'abord** (`useCardSearch.test.ts`) — construire des cartes de test, vérifier : trouve par titre, par contenu de description, ignore les accents, index mis à jour quand une carte change ou est supprimée, requête vide → `[]`. FAIL.
- [ ] **Step 3: Implémenter** `useCardSearch` : index construit avec `['title', 'text']`, reconstruit au chargement d'un fichier, mis à jour incrémentalement (`update`/`remove`) quand `useCardsStore` change.
- [ ] **Step 4: Basculer les consommateurs** vers `useCardSearch` (dispatcher Ctrl+F conservé tel quel : seul le classement change) et la palette vers un `rank` construit avec `createSearchIndex(['label', 'keywords'])` sur les commandes.
- [ ] **Step 5: Supprimer** `textSearch.ts`, `scoreCard.ts` et leurs tests **uniquement** quand `grep` (Step 1) ne renvoie plus rien. Les cas que ces tests couvraient et qui ne sont pas repris par les tests de `useCardSearch` sont portés vers ces derniers avant suppression.
- [ ] **Step 6: Vérifier** tests verts ; dans l'app, Ctrl+F et la palette trouvent `fraction` ↔ `fractions`, `ete` ↔ `été`.
- [ ] **Step 7: Commit** `feat(search): la palette et la recherche de cartes utilisent le moteur partagé`.

---

## Task 13: `apps/base`

**Files:**
- Create: `apps/base/{package.json,index.html,vite.config.ts,vitest.config.ts,tsconfig.json,tsconfig.node.json}`, `apps/base/src/{main.tsx,App.tsx,App.test.tsx,index.css,vite-env.d.ts}`, `apps/base/src-tauri/{Cargo.toml,build.rs,tauri.conf.json,capabilities/default.json,src/main.rs,src/lib.rs,icons/*}`
- Modify: `Cargo.toml` (membre), `package.json` racine (scripts `dev:base`, `build:base`)

**Interfaces:**
- Consumes : `AppShell`, `SettingsDialog`, `ShortcutSettingsPanel`, `UpdateReadyBanner`, `useThemeStore`, commandes/palette.
- Produces : une app minimale démarrable. Nom de package `base`, identifiant `com.clape.base`, port 1440.

- [ ] **Step 1: Test d'abord** (`apps/base/src/App.test.tsx`) — **premier lancement sans aucun état persisté** :

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App base', () => {
  it('démarre sans aucun état persisté', () => {
    localStorage.clear()
    render(<App />)
    expect(screen.getByRole('complementary', { name: 'Panneau gauche' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Panneau droit' })).toBeInTheDocument()
  })
  it('ouvre la palette de commandes au clavier', async () => { /* Ctrl+K => dialogue de palette visible */ })
  it('bascule le thème', () => { /* clic sur le bouton de thème => classe "dark" sur <html> */ })
})
```
FAIL (module absent).
- [ ] **Step 2: Fichiers Vite** — copier ceux de `apps/zachart-mentale` en les réduisant : `vite.config.ts` port `1440`, HMR `1441`, aucun `watch.ignored` spécifique aux cartes, alias `@` uniquement. `vitest.config.ts` avec `setupFiles: ['../../packages/shared/src/test/setup.ts']`. `package.json` :
```json
{
  "name": "base",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "tsc && vite build", "tauri": "tauri", "test": "vitest run" },
  "dependencies": { "@suite/shared": "workspace:*", "@tauri-apps/api": "^2", "react": "^19.1.0", "react-dom": "^19.1.0", "tailwindcss": "^4.3.3", "@tailwindcss/vite": "^4.3.3" },
  "devDependencies": { "@tauri-apps/cli": "^2", "@vitejs/plugin-react": "^6.0.2", "typescript": "~6.0.3", "vite": "^8.0.16", "vitest": "^5.0.0", "jsdom": "^30.0.1", "@testing-library/react": "^16.3.3", "@testing-library/jest-dom": "^7.0.1", "@types/react": "^19.1.8", "@types/react-dom": "^19.1.6" }
}
```
- [ ] **Step 3: `index.css`**

```css
@import "tailwindcss";
@import "@suite/shared/theme.css";
@source "../../../packages/shared/src";
```
Et un test dans `App.test.tsx` : `import css from './index.css?raw'` doit contenir `@source` vers `packages/shared` (garde-fou contre l'oubli, qui rendrait les composants partagés sans style).
- [ ] **Step 4: `App.tsx`** — `AppShell` avec `left`/`right` = placeholders vides (texte « Panneau gauche vide »), barre d'outils (bouton palette, bouton thème, bouton paramètres), `UpdateReadyBanner`, `SettingsDialog` avec le seul panneau de raccourcis, palette avec une commande d'exemple `base.about`.
- [ ] **Step 5: Tauri** — `src-tauri/src/lib.rs` :

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    suite_tauri::builder(suite_tauri::SuiteConfig {
        open_extensions: &[],
        open_event: "open-file",
    })
    .setup(|app| {
        suite_tauri::size_main_window_to_screen(app);
        Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```
`Cargo.toml` (nom `base`, lib `base_lib`, `suite-tauri = { path = "../../../crates/suite-tauri" }`, `tauri-build`, `tauri`, `serde`), `build.rs` = celui de Zachar't (contournement de l'apostrophe : la copie temporaire de l'icône, avec un nom de fichier `base-icon.ico`), `capabilities/default.json` = celui de Zachar't sans les permissions d'écriture de fichiers dont `base` n'a pas besoin, `tauri.conf.json` : `productName: "Base"`, `identifier: "com.clape.base"`, `devUrl: http://localhost:1440`, `createUpdaterArtifacts: false`, pas d'`updater.pubkey` ni `endpoints` tant qu'aucune clé n'existe. Copier `icons/` de Zachar't (à remplacer par app). Ajouter `"apps/base/src-tauri"` aux membres du `Cargo.toml` racine.
- [ ] **Step 6: Vérifier**

```bash
bun install
bun run --filter base test 2>&1 | tail -6
bunx tsc --noEmit -p apps/base
cargo check --workspace 2>&1 | tail -4
cd apps/base && bun tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}' 2>&1 | tail -8
```
Expected : tests verts, build NSIS produit. Puis `bun tauri dev` : la fenêtre s'ouvre avec deux sidebars vides, Ctrl+K ouvre la palette, le thème bascule.
- [ ] **Step 7: Commit** `feat(base): coquille de départ pour les nouveaux logiciels`.

---

## Task 14: Script `new-app`

**Files:**
- Create: `scripts/new-app.mjs`, `scripts/new-app.test.mjs`
- Modify: `package.json` racine (`"new-app": "bun scripts/new-app.mjs"`)

**Interfaces:**
- Produces : `bun run new-app <nom> [--port 1450]` copie `apps/base` vers `apps/<nom>` et remplace : `"name": "base"`, `productName`, `identifier` (`com.clape.<nom>`), port Vite et HMR, nom de crate (`<nom>` et `<nom>_lib`), et ajoute `apps/<nom>/src-tauri` aux membres du `Cargo.toml` racine.

- [ ] **Step 1: Tests d'abord** (`scripts/new-app.test.mjs`, lancé avec `bun test scripts/new-app.test.mjs`) : dans un dossier temporaire contenant une copie minimale de `apps/base` et du `Cargo.toml` racine, vérifier : les remplacements ci-dessus ; **refus** d'un nom invalide (`""`, `../x`, `A b`, majuscules) ; **refus** si `apps/<nom>` existe déjà (rien n'est écrit) ; aucun fichier hors de `apps/<nom>` et du `Cargo.toml` racine n'est modifié ; ne copie ni `node_modules`, ni `dist`, ni `target`. FAIL.
- [ ] **Step 2: Implémenter** avec `node:fs` (`cpSync` avec filtre, puis remplacements ciblés dans une liste fermée de fichiers). Validation du nom : `/^[a-z][a-z0-9-]{1,30}$/`. Écriture atomique : copier vers un dossier temporaire, remplacer, puis renommer.
- [ ] **Step 3: Vérifier** en vrai : `bun run new-app essai --port 1450`, puis `bun install && bun run --filter essai test && cargo check --workspace`, puis **supprimer** `apps/essai` et l'entrée du `Cargo.toml` racine (`git checkout Cargo.toml && rm -rf apps/essai`).
- [ ] **Step 4: Commit** `feat(scripts): new-app crée un logiciel à partir de base`.

---

## Task 15: Versions, releases et CI par app

**Files:**
- Modify: `scripts/bump-version.mjs` (+ `scripts/bump-version.test.mjs`), `.github/workflows/{release,build}.yml`, `apps/zachart-mentale/src-tauri/tauri.conf.json`, `apps/zachart-mentale/src/test/packaging.test.ts`

**Interfaces:**
- Produces : `bun run version:bump -- <app> <patch|minor|major|X.Y.Z>` met à jour ensemble `apps/<app>/package.json`, `apps/<app>/src-tauri/tauri.conf.json` et `apps/<app>/src-tauri/Cargo.toml` (+ l'entrée de la crate dans `Cargo.lock`), et imprime les commandes de tag `<app>-v<X.Y.Z>`.

- [ ] **Step 1: Tests d'abord** (`bump-version.test.mjs`, dossier temporaire) : bump `patch`/`minor`/`major`/version explicite ; les 3 fichiers et `Cargo.lock` ont la même version ensuite ; app inconnue → erreur sans écriture ; version invalide → erreur sans écriture ; pour `zachart-mentale` le tag imprimé est `zachart-v<X.Y.Z>` (préfixe court, voir Step 2), pour `base` c'est `base-v<X.Y.Z>`. FAIL.
- [ ] **Step 2: Nom de tag** — `zachart-mentale` a un tag court `zachart-v*` (spec) : table `TAG_PREFIX = { 'zachart-mentale': 'zachart', base: 'base' }`, défaut = nom de l'app.
- [ ] **Step 3: Implémenter** ; le tag reste dérivé du `tauri.conf.json` par `tauri-action` (`tagName: zachart-v__VERSION__`).
- [ ] **Step 4: `release.yml`**

```yaml
on:
  push:
    tags: ['zachart-v*', 'base-v*']
jobs:
  publish-tauri:
    permissions: { contents: write }
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v7
      - id: app
        shell: bash
        run: |
          case "$GITHUB_REF_NAME" in
            zachart-v*) echo "path=apps/zachart-mentale" >> "$GITHUB_OUTPUT"; echo "name=zachart" >> "$GITHUB_OUTPUT" ;;
            base-v*)    echo "path=apps/base"            >> "$GITHUB_OUTPUT"; echo "name=base"    >> "$GITHUB_OUTPUT" ;;
          esac
      # … setup bun, rust, cache ('. -> target'), bun install, tests de l'app …
      - uses: tauri-apps/tauri-action@v1
        with:
          projectPath: ${{ steps.app.outputs.path }}
          tagName: ${{ steps.app.outputs.name }}-v__VERSION__
```
Les secrets sont passés par nom, `TAURI_SIGNING_PRIVATE_KEY_ZACHART` etc., sélectionnés selon `steps.app.outputs.name` ; le mécanisme exact d'attribution du `latest.json` à la release roulante (`updater-<app>`) et le statut « latest » (`makeLatest`) sont **vérifiés dans la doc de `tauri-action` au moment de cette tâche** (Step 5).
- [ ] **Step 5: Mécanique de l'updater** — lire la doc de `tauri-apps/tauri-action` (options `uploadUpdaterJson`, `updaterJsonPreferNsis`, `releaseId`, `makeLatest` selon la version) et choisir : (a) l'action publie `latest.json` sur la release taguée, puis une étape `gh release upload updater-zachart latest.json --clobber` le copie sur la release roulante ; (b) `prerelease: true` pour les apps non-Zachar't tant que la transition dure. Documenter le choix et les commandes exactes dans `apps/zachart-mentale/infra/README_INFRA.md` ou `docs/RELEASE.md` (créer). **Ne jamais toucher** aux secrets : lister seulement leurs noms attendus à l'utilisateur.
- [ ] **Step 6: Endpoint — test d'abord** (`packaging.test.ts`, Review Focus 5) : `tauriConfig.plugins.updater.endpoints` de Zachar't ne contient **pas** `releases/latest/` et contient `updater-zachart`. **Attention à l'ordre** : cette valeur ne peut être publiée qu'avec la version de transition ; la Tâche est donc découpée en deux commits — (1) tout le reste, avec le test qui vérifie `endpoints[0]` inchangé ; (2) sur décision explicite de l'utilisateur au moment de sortir la version de transition, le passage à l'endpoint roulant et l'inversion du test.
- [ ] **Step 7: Vérifier** `bun test scripts/`, `bun run test`, et un `workflow_dispatch` de `build.yml` sur la branche (le job Windows compile les deux apps).
- [ ] **Step 8: Commit** `chore(release): versions et releases par app`.

---

## Task 16: Documentation et graphe

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `packages/shared/README.md` (créer), `docs/superpowers/specs/2026-09-30-monorepo-suite-design.md` (§3 si le Step 1 de la Tâche 11 a corrigé l'API, §8 si des questions se sont fermées)

- [ ] **Step 1: `CLAUDE.md`** — remplacer l'intro « Tauri + React/TypeScript app (not a monorepo). Frontend in `src/`… » par la structure du monorepo (`apps/`, `packages/shared`, `crates/suite-tauri`), les commandes racine (`bun run --filter <app> …`, `bun run test`, `bun run new-app`), la règle d'or de `shared`, et corriger les chemins de `admin/`, `infra/`, `.cours/`, `.cartes-mentales/`, `graphify-out/`. Mettre à jour la phrase sur graphify (« 513 nodes, 28 communities ») après regénération.
- [ ] **Step 2: `README.md` et `packages/shared/README.md`** — comment ajouter un composant partagé (`shadcn add` écrit dans `packages/shared/src/ui`), ajouter un sous-chemin (`exports` + barrel), créer une app (`new-app`), publier (tags préfixés, `docs/RELEASE.md`).
- [ ] **Step 3: Graphe** — `graphify update .` (sans coût LLM) ; vérifier que `graphify-out/graph.json` reflète les nouveaux chemins (`apps/…`, `packages/shared/…`).
- [ ] **Step 4: Vérification finale de la branche**

```bash
git status --short
bunx tsc --noEmit -p apps/zachart-mentale && bunx tsc --noEmit -p apps/base && bunx tsc --noEmit -p packages/shared
bun run test:all 2>&1 | tail -8
cargo test --workspace 2>&1 | tail -6
```
Expected : tout vert ; le total de tests est supérieur ou égal à 2468 (jamais inférieur : aucun test de l'app n'a été supprimé sans être porté ailleurs).
- [ ] **Step 5: Commit** `docs: monorepo — CLAUDE.md, README, graphe`.
- [ ] **Step 6: Intégration** — invoquer `superpowers:finishing-a-development-branch` (revue d'ensemble de `feat/monorepo`, puis décision merge/PR avec l'utilisateur ; aucune poussée ni suppression de branche distante sans son accord explicite).
