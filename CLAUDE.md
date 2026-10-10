# Suite éducative (Zachar't Mentale et suivants) — agent instructions

Monorepo of Tauri + React/TypeScript desktop apps that share one base. Bun
workspaces for the frontends, a Cargo workspace for the Rust side. **React, not
Vue** — there is no Vue anywhere.

```
apps/zachart-mentale/   Zachar't Mentale (src/, src-tauri/, admin/, infra/)
apps/zachart-maths/     Zach'Math (src/exercises, src/cours, src/math)
apps/base/              empty, working shell: the template of every new app
packages/shared/        @suite/shared — the React code every app reuses
crates/suite-tauri/     the Rust code every app reuses
scripts/                new-app, bump-version (+ their tests)
docs/RELEASE.md         how an app is versioned and published
```

## Commands

Run everything from the repository root.

- `bun run test` — every workspace's suite (`--filter '*'`). `bun run test:admin`
  (the web admin), `bun run test:scripts`, and `bun run test:all` for the three.
- `bun run --filter <app> dev|build|tauri …` — per app, e.g.
  `bun run --filter zachart-mentale tauri dev`. `dev`, `build` and `tauri` at the
  root default to Zachar't Mentale.
- `bunx tsc --noEmit -p apps/<app>` (or `-p packages/shared`) — type-check one workspace.
- `cargo test --workspace` — the Rust side.
- `bun run new-app <nom> [--port <n>]` — a new app, copied from `apps/base`.
- `bun run measure:sharing [apps/<app>]` — part of the lines reachable from `main.tsx` that live in `packages/shared`.
- `node scripts/baseline-shots.mjs <app>` — 6 screenshots (no Tauri: fake `__TAURI_INTERNALS__`, Chromium) into `chantier/captures/` (gitignored).
- `bun run deploy [<app|all> <patch|minor|major|X.Y.Z>]` — publishes (bump, commit, push, tag); interactive without args, see `docs/RELEASE.md`.
- `bun run version:bump -- <app> <patch|minor|major|X.Y.Z>` — see `docs/RELEASE.md`.
- `bun run update:mentale|update:maths|update:all [-- patch|minor|major|X.Y.Z]` — builds the signed
  update locally (Windows) into `updates/`; publishes nothing. See `docs/RELEASE.md`.

Ports: zachart-mentale 1420, its admin 1430, base 1440, zachart-maths 1450 (HMR = port + 1).

## `packages/shared` — the one rule

**`shared` never imports from an app**: no `@/…`, no `@app`, no relative path that
leaves `packages/shared/src` (`src/boundary.test.ts` enforces it). Apps inject
what is theirs by props, slots, options, or by registering it — the command
catalogue (`defineCommandCatalog`), the settings panels and sources, the search
ranking.

- Public entry points only: `@suite/shared/{app,ui,theme,update,shell,commands,settings,search,math,tree,equation,storage,view,history,files,testing}`
  and `@suite/shared/theme.css`. Never import a file inside a sub-path.
- Sources are consumed as TypeScript, with no build step. Inside `shared`, imports
  are **relative**, never `@suite/shared/…`.
- Every app's CSS entry needs `@source "…/packages/shared/src"` (Tailwind 4 does not
  scan a package outside the app), next to `@import "@suite/shared/theme.css"`.
- New shared UI: the shadcn config in `components.json` still writes to the app.
  Generate there, then `git mv` the files into `packages/shared/src/ui` and run
  `bun scripts/move-module.mjs <app> <old path> @suite/shared/ui`.
- Tests (`@suite/shared/testing`, never imported by production code — `boundary.test.ts`): `describeAppContract(() => <App />, { name, reset, commandIds })` is the conformance suite every app plugs in via `src/app.contract.test.tsx` (the app declares its own `vi.mock`s); the next lots turn its `todo`s into checks. `createMemoryFs` is an in-memory `Fs`.
- Standard commands (`@suite/shared/commands`, chantier L1): `standardCommands(['file.new', 'edit.undo', …], overrides?)` returns the
  definitions of the shared vocabulary (`app.*`, `file.*`, `edit.*`, `view.toggleLeftPanel/RightPanel/zoom*/toggleDensity`,
  `tree.*`; `STANDARD_CATEGORIES`) — an app may reword one or move its default key, never change its meaning. A catalogue that gives a
  standard command's key to another command of the same scope throws in dev. `defineCommandCatalog({ …, aliases })` takes
  `oldId → newId`: `commandById`, `isCommandId`, `runCommand`, `useCommand`, `useBinding` resolve an old id, and
  `sanitizeShortcutSettings` rewrites it in an old `shortcuts.json` (the new id wins if both are there). Never rename a command id
  without an alias. `createTypedCommands<typeof COMMANDS, 'old.id'>()` gives `useCommand`, `runCommand`, `CommandButton`,
  `CommandMenuItem`, `CommandDropdownItem`… typed on the app's ids: call it once, in `commands.ts`. `apps/base` is the reference.
- App frame (`@suite/shared/app`, chantier L3): `defineApp({ id, name, mark, bootFloorMs?, panels?, settings?, shortcuts?, onReady? })`
  is an inert object (`id` prefixes the storage keys, e.g. `<id>:left-width`); `<SuiteApp app left? right? file? ready? overlays?>{work area}</SuiteApp>`
  wires theme sync, global shortcuts (`app.shortcuts` = `isSuspended` / `canvasSelector`), the shortcut store init, `app.onReady` (once; may
  return a cleanup — keep the app's store init order there), the updater, the palette, the settings window, the loading screen and the
  banners, and registers `app.palette`, `app.settings`, `app.shortcuts` (opens the « Raccourcis » tab) and `app.toggleTheme`. `left`/`right`
  omitted = an empty resizable panel; `null` = no panel (Mentale during a quiz). `systemButtons={false}` drops the palette/theme/settings
  buttons (an app with its own toolbar, until L4). The app's `app.config.ts` must import its `commands.ts` (the catalogue registers itself on
  import). `useAppStatus()` → `push({ id, kind: 'error'|'info', text, action?, dismiss? })` / `remove(id)` feeds `StatusBannerStack` (same id =
  replaced in place); « Mise à jour prête » is one entry of it. Shell: `AnimatedMark` (`MarkConfig`: 4 `points`, `colors`, ≤3 `segments`
  as polylines, optional `origins` for where dots 2–4 slide in from; CSS `.animated-mark*` in `theme.css`; modes `draw-fade` / `draw-pulse`),
  `AppBoot` (`ready` + `floorMs`), `StatusBanner`. Theme: `useToggleTheme()` (origin = click if given, else top centre), `ThemeToggle`.
  Settings: `standardSettings({ shortcuts?, updates })` → `{ panels, sources, placement }`, `mergeSettings(standard, app)` puts the app's
  panels between « Raccourcis » (first) and « Mises à jour » (last); an app panel with a standard id replaces it. Maths and Mentale still wire
  all of this by hand (and keep their own `AnimatedLogo`) until their L3 migration (chantier 3). `apps/base/src/App.tsx` is 12 lines.
- Top bar (`@suite/shared/shell`, chantier L4): `<SuiteApp file?>` draws `<AppToolbar toolbar={app.toolbar} file>` on an `OverflowToolbar`. Seven
  zones, fixed order `file · edit · title · app · panels · view · system` (`TOOLBAR_ZONES`), each with a priority (`ZONE_PRIORITY`: file and
  system leave last, the title first). The suite draws its own items when the catalogue has the command: `file.newOrClose` (`file.new` with no
  file open, `file.close` with one — one slot), `file.menu` (« Fichier », from 3 actions: `file.new/open`, `tree.newFolder`, `file.save/rename/duplicate`,
  `file.reveal`, `file.close/delete`), `edit.undo`, `edit.redo` (enabled by the app's `useCommand`), `title` (`FileTitle`, from `file = { open, name, path,
  status: 'saved'|'saving'|'error' }`), `app.palette`, `app.toggleTheme` (`ThemeToggle`), `app.settings`. The app declares its own with
  `defineApp({ toolbar: defineToolbar({ items: [{ id, zone: 'app', node, menu?, priority? }], hide: ['file.menu'] }) })`. `panels` and `view` stay
  empty until L7 / L5. Buttons are `ghost` + `icon-sm`. Maths and Mentale still draw their own bar until their L4 migration (chantier 3).
- View (`@suite/shared/view`, chantier L5): `<SuiteApp>` applies and offers the interface zoom, the density and the font (`defineApp({ view?: { zoom?, density?, font? } })`,
  all on; `false` = no command, no bar button, no settings row, no effect — Mentale may turn the zoom off until its canvas is checked, S1). Voie A (CSS): `useApplyView`
  writes `documentElement.style.zoom`, `--app-zoom`, `--app-height` (read by `AppShell`) and `--font-sans`; the Radix popover rule is in `theme.css`, never in an app.
  `useUiZoom()` (`percent`, `zoomIn/zoomOut/reset/set`; 50–150, step 10), `useDensity()` (`compact`, `toggle`), `useFontFamily()`, `spacing(compact)`; stores per app id
  (`viewStores(id)`; `AppIdProvider` is put by `SuiteApp`), keys `<id>:zoom`, `<id>:compact` (`on`/`off`), `<id>:font` — Maths' `zachart-maths:zoom|compact` are these. Commands
  `view.zoomOut/zoomIn/zoomReset/toggleDensity` (standard; registered by `SuiteApp`, the app declares them in its catalogue); bar items `view.zoom` (`ZoomControls`) and
  `view.density` (`DensityToggle`) in the `view` zone when the catalogue has the commands; « Apparence » panel (`AppearanceSettingsPanel`, `standardSettings({ appearance })`,
  applied at once, no draft). Maths and Mentale still use their own zoom/compact/font code until their L5 migration (chantier 3).
- Files and history (`@suite/shared/history` + `files`, chantier L6): `createHistoryStore<T>({ limit = 200, groupMs = 700 })` is a zustand store
  `{ present, past, future, reset, commit(next, groupKey?), undo, redo }` (whole snapshots; same `groupKey` within `groupMs` = one step; a commit clears the
  redo); `useHistoryCommands(store)` registers `edit.undo/redo`. `DocumentPort<T>` = `{ read (null = gone), write, validate?, repair?, create? }`.
  `useFileSession(port, { session?, history?, delay? })` → `{ status: idle|opening|ready, path, doc, saveStatus, saveError, failure, prompt, open, close, create,
  relocate(from, to), flush, edit(next, groupKey?), undo, redo, canUndo, canRedo }` and registers `file.close`, `file.save`, `edit.undo`, `edit.redo` (the app
  registers `file.new`). The order is the rule: a path is left only after `flush` wrote what was pending; autosave is armed only for the file actually loaded;
  a failed open (missing / unreadable / invalid) leaves the previous file open (`failure`); a failed flush before open/close asks (`prompt`, shown by
  `SaveFailedDialog`); `relocate` (a sync renamed the open file) flushes to the OLD path first. `useAutosave({ save, version, enabled, delay = 600 })` is armed by
  `version` bumps (edits), never by a load. `createSessionStore(appId)` keeps `<id>:session` (`currentFilePath`, `expandedPaths`, `recentFiles` ≤ 10), reads
  Maths' and Mentale's old formats, writes the superset. `useWindowTitle(appName, fileName)`, `HomeScreen` (+ `recentItem`), `UnreadableFileDialog`.
  `apps/base` shows it: `textFiles.ts` (the port, `Documents/Base/*.txt`), `TextDocument`. Maths and Mentale keep their own engines until their L6 migration
  (chantier 3); `useUnsavedChangesGuard`, `useLaunchFile`, `useFileDropZone`, `NewFileDialog` are not extracted yet (see `chantier/suivi.md`).
- Persistence (`@suite/shared/storage`, chantier L2): the ONLY place that touches `localStorage` (`boundary.test.ts`).
  `readStored`/`writeStored` never throw and fall back to memory. `defineAppStorage('zachart-maths').key('zoom')` →
  `zachart-maths:zoom` (existing keys are kept as they are). `createPersisted({ key, fallback, parse, serialize?, migrate?, normalize? })`
  is a zustand store `{ value, set, reset }` read once at creation; `persistedFlag` (`on`/`off` = the strings the key already holds),
  `persistedNumber`, `persistedEnum`, `persistedSet`, `persistedJson` are its common cases. `readJsonConfig(name, { fallback, parse })` /
  `writeJsonConfig(name, value)` read and write `appConfigDir` files (missing → fallback; unreadable → moved to `<name>.bak`; written
  beside and renamed, which needs `fs:allow-rename`). `readVersioned(raw, { current, steps })` runs format migrations in order.
  Maths and Mentale still use their own readers until their L2 migration (chantier 3).
- Search is Orama (`@suite/shared/search`): `createSearchIndex(fields)`,
  `loadSearchIndex(fields, serialized)`. French, accent- and typo-tolerant.
- Math is KaTeX (`@suite/shared/math`): `renderMathToHtml(latex, display?)`, bounded, never
  throws, `trust: false`, with `\ce` / `\pu` (mhchem). It touches no Tauri, so the web admin may use it.
  It also holds the pure equation logic both apps share: `equationStepIsSolved`, `isBareVariable`,
  and the keyboard map `navigate` / `readingOrder` / `operationVisible` (steps are `{ left, right, operation? }`).
- Shell panels fold (`@suite/shared/shell`): `usePanelCollapsed(key)` (remembered like the width),
  `CollapsedRail` (the 32px strip with the unfold button) and `CollapsiblePanel` (`ResizablePanel` +
  fold + the app's toggle command, registered BEFORE the folded early-return so the shortcut still
  unfolds it). Maths uses it on both sides (`view.toggleTree` Mod+B, `view.toggleCourses`
  Mod+Shift+B); Mentale only reuses `usePanelCollapsed` (left sidebar), `CollapsedRail` (right
  panel), `PanelSearch` (sidebar filter, type filter in `trailing`) and `PanelFooter`: their panel
  logic is too app-specific to migrate. The fold button of a `CollapsiblePanel` lives in its footer
  (toolbar label `Actions — ${label}`), last; an app passes its own actions through the `footer`
  prop, as commands. Shared too: `PanelSearch`, `PanelFooter`, `PanelFooterSeparator`.
- Tree drag-and-drop (`@suite/shared/tree`): `beginTreeDrag(event, source, handlers)` is a pointer-event
  engine (5px threshold, hover-to-expand after 600 ms, Escape/blur/pointercancel cancel, the click
  that follows a real drag is swallowed once — `consumeSwallowedClick`), NOT HTML5 drag & drop,
  which is unreliable in the Tauri webview. The app injects `canDrop` / `isExpanded` / `expand` /
  `onDrop`; rows carry `data-tree-row`, `data-tree-kind` and the enclosing branch `data-drop-folder`.
  `TreeDragGhost` + `useTreeDragStore` are shared too (the ghost's CSS is in `theme.css`). Mentale
  keeps `sidebar/treeDrag.ts`, `state/useTreeDragStore.ts` and `sidebar/TreeDragGhost.tsx` as thin
  facades over it; Maths' `ExerciseTree` uses it directly. `admin/` must not import it.
- Blocks and sub-blocks (`@suite/shared/equation`): `MathFieldEditor` (MathLive + raw-LaTeX fallback that is
  a complete editor), the keyboard intents (`rawFieldKeyDown`, `latchEdgeKey`, `BlockPlace`…),
  `EquationStepsField` (steps `{ left, right, operation? }`, no ids) and `LinesBlockField` (lines
  `{ id, latex }`). A block holds sub-blocks: Enter = new sub-block, Ctrl/Cmd+Enter = new block (Shift =
  « inside the group », same as outside in Maths, which has no groups). No buttons next to a sub-block.
  Mentale keeps `content/EquationEditor.tsx`, `fieldIntents.ts` and `MathFieldEditor.tsx` as thin facades.
  `MathFieldEditor`'s `focusNow` calls MathLive `focus()` then the native `HTMLElement.focus()`:
  MathLive moves DOM focus ~60 ms late, so keys typed right after Enter would miss the new line.
- `TableGrid` (`@suite/shared/equation`): presentational grid with a « + » on every row/column boundary
  and a trash on the hovered/focused row/column (`tableLabel`, `rowCount`, `columnCount`, optional
  `renderHeader`, `renderCell`, `onAddRow/onAddColumn/onRemoveRow/onRemoveColumn`, `data-testid`
  passthrough; headerless tables work). Data stays the app's; the app provides the `TooltipProvider`.
  Mentale's `TableField` is an adapter around it; Maths' `TableEditor` uses it directly.
  `RecentFilesList` / `formatRelativeTime` are in `@suite/shared/shell` (slots `adornment`, `wrap`).
  `OverflowToolbar` (`@suite/shared/shell`) is the top bar that never overflows: items `{ id, node, menu, priority }`;
  what does not fit (lowest priority, then the later ones) moves into a « … » dropdown (`CommandDropdownItem`s). Every item
  stays rendered (hidden, absolute) so its width stays measurable; unmeasured (jsdom) = all shown. `visibleIds` is the pure rule.
  `TableGrid`'s `handlesTabbable={false}` takes the « + » and bins out of the Tab order (Maths).

A tauri app's `src-tauri/Cargo.toml` must declare **directly** every plugin its
capability names (`fs`, `updater`…): `tauri-build` reads plugin permissions from
direct dependencies only, and `suite-tauri` registering them is not enough. It
also needs `serde_json` (`generate_context!`). `apps/base` is the reference.

## Zachar't Mentale's second front-end: the web admin

`apps/zachart-mentale/admin/` is a SECOND, standalone Vite app — the teacher's web
admin panel, built into the PocketBase image (`apps/zachart-mentale/infra/Dockerfile`)
and served from `/pb_public` at the root of the sync domain. It has its own
`package.json`, `tsconfig`, `vitest.config.ts` and `node_modules`.

- It imports the desktop app's **pure** modules through the `@app` alias
  (`admin/src/…` → `../src/…`, i.e. `apps/zachart-mentale/src`): card types,
  `validateCards`/`repairCards`, serialization, path helpers. Never copy that
  code into `admin/` — a validator that drifts from the real format is worse
  than none.
- Nothing under `admin/` may import `@tauri-apps/*`, directly or transitively, nor
  the `@suite/shared` sub-paths that touch Tauri (`commands`, `settings`, `shell`,
  `update`) — `admin/src/boundary.test.ts` enforces it.
- Run its suite with `bun run test:admin` from the root. Invoking `vitest`
  directly from the root against `admin/` picks up the wrong binary and its
  jest-dom matchers go missing.
- The app's `vitest.config.ts` deliberately excludes `admin/**`.

Server-side schema lives in `apps/zachart-mentale/infra/pocketbase-schema.mjs` as
data, and `infra/setup-pocketbase.mjs` applies it idempotently — `bun run
infra:plan` / `infra:apply` / `infra:check`. Adding a collection means editing the
schema module, nothing else: the script, its tests and the docs all read that one
definition. Synchronisation and PocketBase belong to Zachar't Mentale only; the
other apps of the suite have none.

## Zach'Math (`apps/zachart-maths`)

Born from `apps/base` with `new-app`; it has no sync and no PocketBase. Three areas, each
under `src/`, wired together in `App.tsx`:

- **`exercises/`** — the student's files and the centre area. With no file open the centre shows the
  recently opened ones (`recentFiles.ts`, `localStorage` key `zachart-maths:session`, 10 max). A file is a *sheet* (`Sheet`
  in `types.ts`, v2, `exercices[]`) in a chapter folder under `Documents/Zach'Math/`; a v1
  file (one flat exercise) is read as a one-exercise sheet and only rewritten on its first
  edit. The order of a folder lives in its `_ordre.json`. `sheet.ts` holds the pure
  operations (`insertExercise`, `neighbour`, `dropExercise`…) and `SheetOutline` lists the
  open sheet under the file tree. Everything touching the disk goes through the
  `ExerciseFs` port (`fsPort.ts`): `tauriFs.ts` in the app, `memoryFs.ts` in tests — write
  new file logic in `library.ts` against the port, never against `@tauri-apps/plugin-fs`.
  `useOpenExercise` loads the selected sheet whole, exposes the current exercise as
  `exercise`, and autosaves the sheet (600 ms, and on switching file).
  `library.duplicateExercise` copies a file right after the original (« … (copie) », new ids);
  `sheet.moveExercise` / `insertExerciseAt` reorder and insert inside a sheet (the tree and the
  open-sheet outline have right-click menus; a row's menu stops propagation so the blank-area
  menu never opens over it).
  An exercise has one work zone (`blocs`) or two independent ones: `blocsB` present, even empty,
  means split (`zones.ts`: `splitZones`, `mergeZones` appends B under A, `sendBlock`). Blocks
  always get an `id` when a file is read, so they can be moved between zones.
  The tree's search (`treeSearch.ts`, `filterChapters(tree, query)`, Orama) covers chapter names and
  exercise titles ONLY, not file contents; it is a view over the tree (matching chapters forced
  open), never touching the real folded state. The left panel footer carries the commands
  `tree.newChapter` and `tree.toggleAll` (category `tree`), then the fold button.
- **Corrigé** (`Exercise.corrige?`, `corrigeLe?`, `rate?`, `creeLe?` — jamais écrits à `false`; `corrigeLe` et `rate`
  n'existent que si `corrige`) : bouton à bascule dans le pied de l'exercice (cadre vert, orange si « à revoir »).
  `correction.ts` est la logique pure : `summarizeSheet` (alimente `ExerciseEntry.aCorriger/corriges/aRevoir/premierACorriger/
  corrigeLes/enAttente`), `toggleCorrected`, `toggleRate`, `findNextToCorrect` (fiche ouverte, puis fiches suivantes en boucle),
  `correctionStats` (série de jours, corrigés depuis lundi, relance après `STALE_DAYS` = 10). `sheet.needsCorrection` : commencé
  et non corrigé (un vierge n'attend rien). UI : `ToCorrectBadge`/`ToReviewBadge` (arbre, récents), `CorrectionStatsBar` et section
  « À finir » sur l'accueil, commandes `correction.next` (Mod+Shift+J, `jumpToNextToCorrect`, `goToExercise` ouvre une fiche sur un
  exercice), `tree.onlyToCorrect` (filtre de l'arbre), `correction.toggleHide` (le plan grise ou masque les corrigés), `review.open`
  (`ReviewDialog` : tous les corrigés, filtre chapitre / à revoir, cours suggérés pour les ratés). État de vue : `useCorrectionView`.
- **Tri du plan et recherche avancée** : le plan de la fiche (`SheetOutline`) a un menu de tri (`sheetSort.ts`, `sortedIndices` : ordre de la
  fiche, numéro naturel 1, 1a, 1b, 2, 10 croissant/décroissant, date de création, état en tête ; `useSheetSort`, clé `zachart-maths:sheet-sort`) ;
  Monter/Descendre sont désactivés hors « ordre ». À droite de la recherche de l'arbre, `search.advanced` (Mod+Shift+F) ouvre
  `AdvancedSearchDialog` : `librarySearch.ts` (`loadSearchEntries` relit toute la bibliothèque, `searchEntries` = Orama + extrait surligné) cherche
  dans fiches ET exercices (énoncé, réponse, notes, blocs), filtrable par type et chapitre.
- **Blocks** (`blocks.ts`): `texte`, `calcul`, `tableau`, `equation`. A new block type = a
  type in `blocks.ts` (`newBlock`, `parseBlocks`), an editor in `BlockStack.tsx`, an icon and
  hue in `blockMeta.ts`. A block of an unknown type is kept verbatim in the file, never dropped.
  `equation` and `calcul` use the shared sub-block editors: `EquationEditor` / `CalcEditor` are adapters.
  An equation step is `{ id, left, right, operation }`; the shared engine has no ids, `stepIds.ts`
  (`toPlain`, `withIds`) puts them back. `operation` is read AFTER its step; an old `{ latex, action }`
  step is split on its first `=` at read time. `calcul` is `{ lignes: { id, latex }[] }` (sub-blocks); an
  old `{ expression, resultat }` is read as two lines (an empty `resultat` is ignored). `BlockStack`
  wires Ctrl/Cmd+Enter (new block of the same type), arrows leaving a block, and the removal of an empty
  block (`edges`, `enterBlock`, `removeAndFocus`). `BlockCard` is the gutter (icon, ▲ ▼, trash);
  moves are animated with `motion` (`layout="position"`) plus a `block-halo` ring, with no slide
  under `prefers-reduced-motion`. Right-click has two levels, each stopping propagation to the
  next: `BlockContextMenu` (a card) and `EmptyAreaContextMenu` (blank space of a zone); text fields
  keep `FieldContextMenu`, formula fields have none.
- **Annuler / rétablir** (`useOpenExercise`: `undo`, `redo`, `undoDepth`, `redoDepth`; commandes `edit.undo` Mod+Z /
  `edit.redo` Mod+Shift+Z, `allowInEditable`, boutons en tête de la barre du haut) : historique de clichés de la FICHE
  entière, remis à zéro à chaque ouverture ; les `edit` sur les mêmes champs du même exercice à moins de `UNDO_GROUP_MS`
  (700 ms) ne font qu'un pas ; toute nouvelle modification vide le rétablissement ; 200 pas max.
- **Tableaux au clavier** (`tableNav.ts`, `cellKeyAction`, branché dans `TableEditor`) : Tab = case suivante, dernière case
  → « + » de ligne ; Entrée = case suivante (ligne suivante au bout), dernière case → nouvelle ligne ; Maj+Entrée recule ;
  Ctrl/Cmd+Entrée = nouvelle colonne ; Retour arrière dans une case vide recule, et supprime la ligne vide depuis sa première
  case (jamais en répétition de touche). Maj+flèches / Maj+clic = sélection rectangulaire (Suppr vide, Ctrl+C/X copient en TSV) ;
  Ctrl/Cmd+Suppr = supprime les colonnes de la sélection, Ctrl/Cmd+Maj+Suppr ses lignes, Ctrl/Cmd+Alt+Maj+Suppr les deux (`deleteShortcut`, `removeRect`, `canRemoveRect` ; un axe entièrement couvert est laissé, il reste au moins une ligne et une colonne ; mêmes actions dans le clic droit d'une sélection multiple, ajoutées dans `BlockStack` autour de `TableCellMenuItems`) ; coller du TSV agrandit le tableau (12 max) ; `crossProduct` propose le produit en croix d'une case vide (bouton « Remplir »).
- **Orthographe et flèches** : `FieldContextMenu` met en tête du clic droit les corrections du mot sous le curseur
  (`spell.ts` : `misspellingAt`, dictionnaire Hunspell français `nspell` + `dictionary-fr` chargé dans un worker,
  `spell.worker.ts`/`spellCore.ts` ; l'alias `@dictionary-fr` existe parce que le paquet n'exporte que `index.js`).
  Dans un tableau, `tableNav.ts` (`cellMove`) : haut/bas = même colonne, gauche/droite = case voisine seulement
  quand le curseur n'a plus de caractère à franchir.
- **Toolbar** (`toolbarCatalog.ts`): symbols are data, one hue per family. A symbol has a
  `glyph` (plain fields), a `latex` (MathLive; `#0`/`#?` placeholders) and an optional `plain`.
  Text fields are filled with `insertAtCursor` (`setRangeText`, not `value =`: React and
  user-event both track `value`).
- **Affichage** (`useZoom.ts`, `useCompact.ts`, barre du haut) : le zoom (`documentElement.style.zoom`, 50–150 %, pas de 10, clé `zachart-maths:zoom`, commandes `view.zoomOut` Mod+Minus / `view.zoomIn` Mod+Plus / `view.zoomReset` Mod+0, le « % » cliquable remet à 100) et le mode condensé (`view.toggleCompact`, clé `zachart-maths:compact`, `spacing(compact)` donne les paddings/gaps de la zone centrale : `ExerciseWorkspace`, `BlockStack`, `BlockCard`).
- **Coloration des unités** (`quantities.ts`, `unitColors.ts`, `HighlightedTextarea.tsx`,
  `useUnitColors.ts`) : `findQuantities(text)` trouve les grandeurs (`16 km`, `3 km/h`, `x km/h`, `km/h`
  seul) ; `assignExerciseHues(exercise)` donne une teinte par unité canonique pour TOUT l'exercice
  (énoncé → zone A → zone B → réponse, blocs dans l'ordre de lecture : textes ET en-têtes de tableau) ; `HighlightedTextarea` remplace les `<textarea>` de l'énoncé, des blocs
  texte et de la réponse : un calque miroir coloré derrière un champ transparent, dont l'arbre ne dépend QUE du
  réglage (jamais des teintes, sinon la première unité tapée remonte le champ et fait sauter le curseur). Il est
  contrôlé uniquement (`value` chaîne ; `style` ne vaut que pour le `<textarea>`) ; le champ prend
  `field-sizing: content`, `overflow-y: auto`, `resize: none` (il grandit au lieu de défiler) et son défilement
  est recopié sur le miroir en repli. Les `<mark>` n'ajoutent aucune métrique et ont `color: transparent`. Un `t`
  seul n'est jamais une unité (c'est aussi une inconnue) : `2t` n'est pas coloré, seul `2 t` (avec espace) =
  tonnes. Le texte des cellules de tableau, les formules MathLive et les cours ne sont pas colorés (le fond d'un tableau suit son en-tête : voir Tableaux). Réglage : bouton
  `view.toggleUnitColors` de la barre du haut, clé `localStorage` `zachart-maths:unit-colors`, activé par défaut.
- **Termes semblables** (`likeTerms.ts`, `termColors.ts`, `termHighlight.ts`) : `colorTerms(latex)` découpe un
  membre aux `+`/`−` de premier niveau en segments `{ text, group }` (`group` = partie littérale `x`, `xy`, `x^2` ;
  `''` constante ; `null` non coloré — parenthèses, fractions, racines, `/`, commande inconnue ; les segments
  recollés redonnent l'entrée) ; `assignTermColors(groups, theme)` donne une couleur HEXADÉCIMALE par groupe
  (le fond MathLive/KaTeX n'accepte pas `var(--…)`), attribuée sur TOUT le bloc, la constante étant un gris neutre ;
  `termHighlighter(steps, theme)` renvoie la fonction `(latex, { step, side }) => LatexHighlight[]` que `EquationEditor`
  passe à `EquationStepsField` (`highlight`) puis à `MathFieldEditor` (`highlight`) : la coloration est peinte DANS les
  champs MathLive, en continu (sans focus), un membre n'étant coloré que si un groupe a au moins deux termes dans son
  étape. Côté shared, `paintHighlights` convertit les indices de LaTeX en décalages MathLive et appelle `applyStyle`
  avec `silenceNotifications` (aucun `input`) ; comme `value` contient alors des `\colorbox`, TOUTE lecture d'un champ
  coloré passe par `plainValue` (`getValue('latex-unstyled')`) : la valeur enregistrée reste celle de l'élève, et
  `onChange` ne reçoit jamais de couleur. Même bouton que les unités (`view.toggleUnitColors`, « Colorer unités et termes »).
- **Tableaux** (`tableUnits.ts`, `parseUnit` de `quantities.ts`, `TableEditor` dans `BlockStack.tsx`) : `headerUnit(cell)`
  lit l'unité d'une cellule d'en-tête (toute la cellule est une unité, ou finit par `(km)` / `[€]`, ou par « en km/h » ;
  `16 km` n'en est pas un ; `t` seul refusé, `t (s)` donne `s`) ; `tableLayout(cells)` cherche d'abord sur la première
  ligne (coin exclu), à défaut sur la première colonne, la première ligne l'emporte. Le coin ne décide pas de l'axe,
  mais une fois l'axe retenu il en fait partie et porte son unité s'il en a une (`units[0] = headerUnit(coin)` ; un
  titre comme `Grandeur` reste `null`). **Garde contre les faux en-têtes** : une unité d'un seul caractère lue seule (via
  `parseUnit`, pas entre parenthèses ou après « en ») ne compte que si TOUTES les autres cellules d'en-tête NON VIDES du
  même axe (hors coin) sont aussi des unités ; sinon elle vaut `null`. Cela évite de colorer `S | M | L | XL` (L serait
  litres) et `Jour | L | M | M | J | V` (L lundi, M mardi, mais J et V ne sont pas des unités). Les unités multi-caractères
  (`km`, `min`) et celles en parenthèses (`Temps (h)`) n'en sont pas concernées. `TableEditor` pose un fond inline
  (`toneOf`, `headerToneOf` pour l'en-tête) sur les `<input>` de la colonne ou ligne concernée, avec la teinte de
  `UnitHuesContext` ; `assignExerciseHues` donne une teinte aux unités d'en-tête (même d'une lettre si la garde passe).
  Même bouton que les unités et les termes ; rien dans `packages/shared`, `TableGrid` ne change.
- **Notes et calculatrice** (moitié basse de la sidebar droite, `cours/CoursePanel.tsx` `BottomSection`, `calc/`) : deux onglets
  (`useCoursesStore.bottomTab`, clé `zachart-maths:bottom-tab`) qui se partagent la zone ; `notesVisible` veut dire « la moitié basse est
  là ». `toggleBottom(tab)` : ouvre l'onglet, ou referme si c'est déjà lui. Commandes `notes.toggle` (Mod+Shift+N) et `calculatrice.toggle`
  (Mod+Shift+M) ; `cours.toggle` montre/cache la moitié haute (`coursesVisible`). `PanelToggles` réunit les trois pastilles (barre du haut, pied du panneau déplié, rail replié `railActions`) : allumée = `.toggle-on` (fond + bordure bleus) ; l'allumer déplie le panneau (`setPanelCollapsed`, `RIGHT_COLLAPSED_KEY`) ; l'éteindre ne le replie pas, sauf si plus rien n'est allumé (cours ET notes/calculatrice éteints : `foldWhenEmpty` dans `useCoursesStore` range le panneau). Calculatrice seule (cours masqués) : hauteur plafonnée (`CALCULATOR_MAX_HEIGHT`, 480 px) et centrée verticalement. Le moteur est mathjs (`mathjs/number`, fonctions d'Ã©valuation dÃ©sactivÃ©es) dans `calc/calculate.ts` (`calculate`,
  `normalize` : × ÷ − , % √ π Rép) ; `Calculator.tsx` n'est que le champ + le clavier ; calcul et historique dans `useCalculatorStore`.
- **`math/`** — `isMathField` (the toolbar's target check); MathLive itself and `renderMathToHtml` come from `@suite/shared`.
- **`cours/`** — courses are Markdown files in `cours/contenu/` (front matter `titre`,
  `chapitre`, `mots-cles`), compiled in with `import.meta.glob`; adding a course is adding a
  file. `suggest.ts` ranks them from the exercise's chapter folder name (generic names like
  « Chapitre 3 » are ignored — fuzzy search would match everything) and its content. Notes
  are the `notes` field of the exercise file.

The app imports nothing from another app and only `@suite/shared` public entry points
(`src/boundary.test.ts`).

## Chantier « Harmonie » (mutualisation de la suite)

`chantier/` holds the analysis and the plan that bring `apps/base` to ~95 % shared code and migrate Maths and
Mentale onto it, **lot by lot**. Start at `chantier/README.md`; the next lot to do is in `chantier/suivi.md`; the
generic prompts are in `chantier/prompts/`. Until a lot is `terminé`, the sections of this file describing the
current (duplicated) state remain true. Never rename a command id, a storage key or a file format without an alias.

A second chantier, **« Synchro »** (`chantier/sync/`, start at its `README.md`; progress in `chantier/sync/suivi.md`), plans one
sync shared by the whole suite (one PocketBase, whole-file sync, conflict = marked duplicate, teacher → per-student copies,
AI-assisted file creation). It is analysis only so far: until its lots are `terminé`, sync stays Mentale's own.

## Explore via the knowledge graph first

A graphify knowledge graph exists at `graphify-out/graph.json` (4084 nodes, 206 communities, rebuilt from `git rev-parse HEAD`). For any question about architecture, "what calls X", data flow, or "where does Y live" — run `/graphify query "<question>"` before grepping or reading files raw. This applies to subagents too: if you spawn an Explore/general-purpose agent for a codebase question, tell it to check for `graphify-out/graph.json` and query it first instead of walking the tree cold.

Only fall back to raw Read/Grep when the graph doesn't cover it (e.g. reading exact current line numbers to edit, or files added since the last commit).

If files under `apps/`, `packages/` or `crates/` changed materially, the graph may be stale — run `graphify update .` (no LLM cost) rather than re-reading everything by hand.

## Course source material is local-only, never committed

`.cours/**` (raw course PDFs, 10-40MB each) and `.cartes-mentales/**` (the
generated `.zmap` mind maps — JSON inside — feeding/produced by the
`transformer-cours-en-carte-mentale` skill; older ones are `.json`, which the
app still opens) are both entirely gitignored and stay at the **repository
root** — this is the user's real personal course content, not example/demo data,
and the repo is open source. Don't Read the PDFs directly unless the task is
specifically converting that course; the mind map files are the thing to
inspect for content. Never `git add -f` anything under either directory. Never
`git add -A` either: add explicit paths (`apps/*/infra/.env` holds credentials).

## RTK is already active

Bash and PowerShell tool calls are auto-rewritten through `rtk` via a PreToolUse hook — you don't need to type `rtk` prefixes yourself. Don't route around it with `rtk proxy`/`rtk run` unless you specifically need unfiltered output for debugging.
