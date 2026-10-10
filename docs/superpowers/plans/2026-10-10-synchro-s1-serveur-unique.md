# Synchro S1 — serveur unique — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** add the `files` collection (schema, access rules, server-side `rev` hook) and a `cartes_mentales → files` migration script, without touching the existing collections or any client.

**Architecture:** `infra/pocketbase-schema.mjs` stays the single data definition (`FILE_FIELDS`, `FILE_INDEXES`, `FILE_RULES`, one more entry in `desiredCollections()`). `rev` is incremented by a PocketBase JS hook (`infra/pb_hooks/files.pb.js`) because only the server may count. The migration is a standalone script reading `cartes_mentales`, writing `files`, idempotent, dry-run by default.

**Tech Stack:** PocketBase (JS hooks, rules), Node ESM `.mjs`, vitest (`bun run test:infra`), `bun run infra/integration.mjs` against a real PocketBase.

**Spec:** `chantier/sync/01-principes-et-modele.md` (model), `chantier/sync/03-prof-et-eleves.md` (rights table), `chantier/sync/06-lots.md` (S1).

## Global Constraints

- `content` field: `max: TEXT_MAX` (never 0, which caps at 5000 chars).
- `rev` is an integer **incremented by the server on every accepted write**; a client can never set it.
- Existing collections (`cartes_mentales`, `dossiers`, `sync_events`, `sync_conflicts`) are NOT removed in S1 (that is S9).
- Rights table (03): student reads/edits/renames/deletes own copy; **only a prof restores** (`deleted_at` back to empty); a prof sees only own students' copies (`teacher`); a student never sees another student's copies.
- No `git add -A`; explicit paths. `infra/.env` is never read or committed.

## Review Focus

- Student tries to clear `deleted_at` on their own deleted file → must be refused (test in rules).
- Student sets `rev`, `owner`, `origin_id` on create/update → ignored or refused.
- Prof B reads/updates a file owned by a student of prof A → refused.
- Two writes to the same `file_id`+`app` → unique index refuses the second.
- Migration run twice → no duplicate, no `rev` bump on the second run.

---

### Task 1: `files` schema

**Files:**
- Modify: `infra/pocketbase-schema.mjs` (new `FILES_COLLECTION`, `FILE_FIELDS`, `FILE_INDEXES`, `FILE_RULES`; entry in `desiredCollections()` after `INVITE_CODES`/`users`, since `owner` relates to users)
- Test: `infra/pocketbase-schema.files.test.mjs` (new, style of `pocketbase-schema.accounts.test.mjs`)

**Interfaces:**
- Produces: `FILES_COLLECTION = 'files'`, `FILE_FIELDS`, `FILE_INDEXES`, `FILE_RULES`.
- Fields: `file_id` (text, 1–255), `app`, `kind`, `path` (1–1024), `content` (max `TEXT_MAX`), `hash`, `rev` (number, int, min 0), `owner` (relation users, required), `origin_id`, `conflict_of`, `deleted_at` (date), `deleted_by` (relation users), `updated_by` (relation users), `created`/`updated` autodate.
- Index: `CREATE UNIQUE INDEX idx_files_owner_app_file_id ON files (owner, app, file_id)`.

- [ ] **Step 1: failing test** — assert `desiredCollections()` contains `files`, every field above exists with the right type, `content.max === TEXT_MAX`, the unique index is present, and `planCollection(undefined, files)` lists it as created.
- [ ] **Step 2:** `bun run test:infra` → FAIL (collection absent).
- [ ] **Step 3:** implement the constants and the entry (comments explain why `rev` is server-only, like the existing `CREATED_FIELD` comment).
- [ ] **Step 4:** `bun run test:infra` → PASS; `bun run infra:plan` shows only `files` as new.
- [ ] **Step 5:** commit `feat(infra): S1 collection files (schéma)`.

### Task 2: access rules

**Files:**
- Modify: `infra/pocketbase-schema.mjs` (`FILE_RULES`)
- Test: `infra/pocketbase-schema.files.test.mjs`

**Interfaces:**
- Consumes: `OWN_STUDENT` fragment already used by `USERS_RULES` (owner's `teacher = @request.auth.id`).
- Rules: list/view: `owner = @request.auth.id || owner.teacher = @request.auth.id`. create: authenticated, `@request.body.owner = @request.auth.id` (or prof creating for own student), `@request.body.rev:isset = false`. update: same visibility, `@request.body.rev:isset = false && @request.body.owner:isset = false`, and `@request.body.deleted_at:isset = false || @request.auth.role = "prof"` (only a prof may touch `deleted_at`, hence restore; a student deleting goes through a dedicated hook route in Task 3 or sets it with `deleted_by = self` — decide in step 3 and document it). delete (hard): `null` (superuser/server purge only; the 30-day purge is a cron in Task 3).

- [ ] **Step 1:** rule-string tests per Review Focus lines 1–3 (assert the expressions contain the required clauses; real behaviour is checked in Task 5).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat(infra): S1 règles d’accès de files`.

### Task 3: `rev` hook and trash purge

**Files:**
- Create: `infra/pb_hooks/files.pb.js`
- Modify: `infra/Dockerfile` only if hooks are not already copied wholesale (they are: `/pb_hooks`) — verify, don't edit blindly.

- Behaviour: `onRecordCreateRequest('files')` sets `rev = 1`; `onRecordUpdateRequest('files')` sets `rev = original.rev + 1` **only if** `content`, `hash`, `path` or `deleted_at` changed (a no-op write does not bump). `onRecordUpdateRequest` also refuses a write where `@request.body.base_rev` is present and `!= original.rev` with HTTP 409 (the client then makes a duplicate, S4). Daily cron `purge_files_trash` hard-deletes rows with `deleted_at` older than 30 days.

- [ ] **Step 1:** write the hook; **Step 2:** covered by the integration scenarios of Task 5 (hooks run only in a real PocketBase); **Step 3:** commit `feat(infra): S1 hook rev de files`.

### Task 4: `cartes_mentales → files` migration script

**Files:**
- Create: `infra/migrate-to-files.mjs`, `infra/migrate-to-files.test.mjs`

**Interfaces:**
- Produces: `planMigration(cartes, existingFiles) → { create: FileRecord[], skip: string[] }` (pure) and a CLI `bun infra/migrate-to-files.mjs [--apply]` (dry-run default), using the same auth/env loading as `setup-pocketbase.mjs`.
- Mapping: `file_id → file_id`, `author` (username) → `owner` via users lookup (unknown author → reported, skipped), `type → kind`, `app = 'zachart-mentale'`, `hash = contentHash(content)`, `rev = 1`.

- [ ] **Step 1:** failing tests on `planMigration`: maps fields; skips already-migrated (same `owner`+`file_id`); reports unknown author; idempotent (plan of plan = empty).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement pure function, then CLI wrapper. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(infra): S1 script de migration cartes_mentales → files`.

### Task 5: integration scenarios + docs

**Files:**
- Modify: `infra/integration.mjs` (scenarios: rev 1 → 2 on edit, no bump on no-op, 409 on stale `base_rev`, student cannot restore, prof can, prof B isolated, unique index), `infra/README_INFRA.md` (collection `files`, hook, migration), `chantier/sync/suivi.md` (S1 → `terminé` if every check below passes).

- [ ] **Step 1:** add scenarios; **Step 2:** `bun run infra/integration.mjs` against a local PocketBase → all green; **Step 3:** `bun run test:infra && bun run infra:check` green; **Step 4:** commit `test(infra): S1 scénarios files sur un vrai PocketBase` + `docs: S1 terminé`.

## Self-review

- Spec coverage: schema (T1), rules table 03 (T2), `rev` hook + trash 30 days (T3), migration (T4), tests/docs/suivi (T5). `infra/` move already done.
- Open point resolved at implementation (T2 step 3): how a student soft-deletes without being able to write `deleted_at` freely — preferred: allow `deleted_at` set to non-empty by owner, forbid clearing unless prof.
