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

- Public entry points only: `@suite/shared/{ui,theme,update,shell,commands,settings,search}`
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

- **`exercises/`** — the student's files and the centre area. An exercise is one `.json` file
  (`types.ts`, versioned) in a chapter folder under `Documents/Zach'Math/`; the order
  of a folder lives in its `_ordre.json`. Everything touching the disk goes through the
  `ExerciseFs` port (`fsPort.ts`): `tauriFs.ts` in the app, `memoryFs.ts` in tests — write
  new file logic in `library.ts` against the port, never against `@tauri-apps/plugin-fs`.
  `useOpenExercise` loads the selected exercise and autosaves it (600 ms, and on switch).
- **Blocks** (`blocks.ts`): `texte`, `calcul`, `tableau`, `equation`. A new block type = a
  type in `blocks.ts` (`newBlock`, `parseBlocks`), an editor in `BlockStack.tsx`, a button in
  `toolbarCatalog.ts`. A block of an unknown type is kept verbatim in the file, never dropped.
- **Toolbar** (`toolbarCatalog.ts`): symbols are data, one hue per family. A symbol has a
  `glyph` (plain fields), a `latex` (MathLive; `#0`/`#?` placeholders) and an optional `plain`.
  Text fields are filled with `insertAtCursor` (`setRangeText`, not `value =`: React and
  user-event both track `value`).
- **`math/`** — `MathField` (MathLive, loaded on demand, raw-LaTeX textarea as the fallback
  that is also a complete editor) and `renderMathToHtml` (KaTeX, bounded, `trust: false`).
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
