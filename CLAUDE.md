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

- Public entry points only: `@suite/shared/{ui,theme,update,shell,commands,settings,search,math,tree,equation}`
  and `@suite/shared/theme.css`. Never import a file inside a sub-path.
- Sources are consumed as TypeScript, with no build step. Inside `shared`, imports
  are **relative**, never `@suite/shared/…`.
- Every app's CSS entry needs `@source "…/packages/shared/src"` (Tailwind 4 does not
  scan a package outside the app), next to `@import "@suite/shared/theme.css"`.
- New shared UI: the shadcn config in `components.json` still writes to the app.
  Generate there, then `git mv` the files into `packages/shared/src/ui` and run
  `bun scripts/move-module.mjs <app> <old path> @suite/shared/ui`.
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
- **Toolbar** (`toolbarCatalog.ts`): symbols are data, one hue per family. A symbol has a
  `glyph` (plain fields), a `latex` (MathLive; `#0`/`#?` placeholders) and an optional `plain`.
  Text fields are filled with `insertAtCursor` (`setRangeText`, not `value =`: React and
  user-event both track `value`).
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
  tonnes. Les formules MathLive, les tableaux et les cours ne sont pas colorés. Réglage : bouton
  `view.toggleUnitColors` de la barre du haut, clé `localStorage` `zachart-maths:unit-colors`, activé par défaut.
- **Termes semblables** (`likeTerms.ts`, `termColors.ts`, `LikeTermsHelp.tsx`) : `colorTerms(latex)` découpe un
  membre aux `+`/`−` de premier niveau en segments `{ text, group }` (`group` = partie littérale `x`, `xy`, `x^2` ;
  `''` constante ; `null` non coloré — parenthèses, fractions, racines, `/`, commande inconnue ; les segments
  recollés redonnent l'entrée) ; `assignTermColors(groups, theme)` donne une couleur HEXADÉCIMALE par groupe
  (`\colorbox` de KaTeX n'accepte pas `var(--…)`), attribuée sur TOUT le bloc, la constante étant un gris neutre ; `LikeTermsHelp` recompose les
  étapes en lecture seule (`\colorbox`, `renderMathToHtml`), une case de 28 px par étape (vide sauf si un groupe a au moins deux termes dans l'étape), sous le bloc équation tant qu'il a le focus et que le
  réglage est actif. Le champ MathLive n'est jamais modifié et l'aide n'appelle jamais `onChange`. Même bouton que
  les unités (`view.toggleUnitColors`, « Colorer unités et termes »).
- **Tableaux** (`tableUnits.ts`, `parseUnit` de `quantities.ts`, `TableEditor` dans `BlockStack.tsx`) : `headerUnit(cell)`
  lit l'unité d'une cellule d'en-tête (toute la cellule est une unité, ou finit par `(km)` / `[€]`, ou par « en km/h » ;
  `16 km` n'en est pas un ; `t` seul refusé, `t (s)` donne `s`) ; `tableLayout(cells)` cherche d'abord sur la première
  ligne (coin exclu), à défaut sur la première colonne, la première ligne l'emporte. Le coin ne décide pas de l'axe,
  mais une fois l'axe retenu il en fait partie et porte son unité s'il en a une (`units[0] = headerUnit(coin)` ; un
  titre comme `Grandeur` reste `null`). `TableEditor` pose un fond inline (`toneOf`, `headerToneOf` pour l'en-tête) sur
  les `<input>` de la colonne ou ligne concernée, avec la teinte de `UnitHuesContext` ; `assignExerciseHues` donne une
  teinte aux unités d'en-tête (même d'une lettre). Même bouton que les unités et les termes ; rien dans
  `packages/shared`, `TableGrid` ne change.
- **`math/`** — `isMathField` (the toolbar's target check); MathLive itself and `renderMathToHtml` come from `@suite/shared`.
- **`cours/`** — courses are Markdown files in `cours/contenu/` (front matter `titre`,
  `chapitre`, `mots-cles`), compiled in with `import.meta.glob`; adding a course is adding a
  file. `suggest.ts` ranks them from the exercise's chapter folder name (generic names like
  « Chapitre 3 » are ignored — fuzzy search would match everything) and its content. Notes
  are the `notes` field of the exercise file.

The app imports nothing from another app and only `@suite/shared` public entry points
(`src/boundary.test.ts`).

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
