# Blocs et sous-blocs, éditeur partagé, accueil de Zach'Math — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zach'Math saisit équations et calculs avec le même éditeur et le même clavier que Mentale (Entrée = sous-bloc, Ctrl/Cmd+Entrée = bloc), sans boutons à droite, et son accueil propose les derniers fichiers ouverts.

**Architecture:** Le champ MathLive, le vocabulaire d'intentions clavier et l'éditeur d'étapes d'équation remontent de Mentale vers `@suite/shared/equation` (Mentale garde de minces façades, ses tests existants sont le filet). Un nouveau `LinesBlockField` applique la même logique aux lignes d'un Calcul. Maths adapte ses données (ids) au moteur et câble Ctrl+Entrée / sorties de bloc dans `BlockStack`. La liste des récents devient un composant partagé avec deux slots (`adornment`, `wrap`) pour que Mentale garde son badge et son menu.

**Tech Stack:** React 19, TypeScript, Bun workspaces, Vitest + Testing Library (jsdom), MathLive 0.110, KaTeX, zustand, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-03-blocs-et-sous-blocs-design.md`

## Global Constraints

- `packages/shared` n'importe jamais une app : pas de `@/…`, `@app`, ni chemin sortant de `packages/shared/src` (`src/boundary.test.ts`). Imports **relatifs** à l'intérieur de `shared`.
- Les apps n'importent que des points d'entrée publics : `@suite/shared/equation`, `@suite/shared/shell`, etc. Jamais un fichier dans un sous-chemin.
- Rien sous `apps/zachart-mentale/admin/` n'importe `@suite/shared/equation` ni `@suite/shared/shell`.
- Lancer tout depuis la racine : `bun run test`, `bun run test:admin`, `bunx tsc --noEmit -p apps/<app>` / `-p packages/shared`.
- Ne jamais `git add -A` : ajouter des chemins explicites. `apps/zachart-maths/src-tauri/Cargo.toml` est modifié localement et **n'est pas à nous** : ne pas l'ajouter.
- Commits : message en anglais ou français comme le dépôt, terminé par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Textes d'interface en français, tutoiement (« Choisis un exercice… »).

## Review Focus

- Un fichier Calcul **ancien** (`expression`/`resultat`) doit se relire sans perte, y compris `resultat` vide, et ne pas être réécrit à la simple ouverture. → Task 6.
- Retour arrière **maintenu** dans une ligne ou étape vide ne doit pas effacer le contenu du champ du dessus. → Task 4 (garde `latchEdgeKey` + test).
- Entrée dans une équation/un calcul ne doit **jamais** ajouter de bloc ; Ctrl/Cmd+Entrée en ajoute exactement un. → Task 7.
- Dernier sous-bloc vide d'un bloc **vide** : Retour arrière supprime le bloc ; d'un bloc **non vide** : ne le supprime pas. → Task 4 et 7.
- Fichier récent **supprimé/déplacé**, stockage `localStorage` illisible ou corrompu : l'accueil ne plante pas et ne propose pas le fichier. → Task 2.
- Un bloc de type **inconnu** reste conservé tel quel après la migration du Calcul. → Task 6.

---

### Task 1: Liste de fichiers récents partagée

**Files:**
- Create: `packages/shared/src/shell/RecentFilesList.tsx`, `packages/shared/src/shell/RecentFilesList.test.tsx`, `packages/shared/src/lib/relativeTime.ts`, `packages/shared/src/lib/relativeTime.test.ts`
- Modify: `packages/shared/src/shell/index.ts`, `packages/shared/src/theme/theme.css`, `apps/zachart-mentale/src/components/RecentFilesList.tsx`, `apps/zachart-mentale/src/index.css` (retirer les règles `.recent-files*`), `apps/zachart-mentale/src/utils/relativeTime.ts`
- Test: les nouveaux tests ci-dessus + `apps/zachart-mentale/src/components/RecentFilesList.test.tsx` (inchangé, doit rester vert)

**Interfaces:**
- Produces (`@suite/shared/shell`):
  ```ts
  export interface RecentItem { path: string; name: string; folder: string; openedAt: string }
  export function RecentFilesList(props: {
    title: string
    items: readonly RecentItem[]
    onOpen: (path: string) => void
    /** Contenu en plus dans la rangée (badge…), entre le nom et l'heure. */
    adornment?: (item: RecentItem) => React.ReactNode
    /** Enveloppe le bouton de la rangée (menu clic droit…). Reçoit le bouton déjà construit. */
    wrap?: (item: RecentItem, row: React.ReactElement) => React.ReactNode
  }): JSX.Element | null   // null si items est vide
  export function formatRelativeTime(iso: string | null, now?: Date): string | null
  ```
- `formatRelativeTime` est exporté aussi par `@suite/shared/shell` (même fichier `lib/relativeTime.ts`, ré-exporté depuis `shell/index.ts`).

- [ ] **Step 1: Déplacer `formatRelativeTime` et son test**

```bash
git mv apps/zachart-mentale/src/utils/relativeTime.ts packages/shared/src/lib/relativeTime.ts
git mv apps/zachart-mentale/src/utils/relativeTime.test.ts packages/shared/src/lib/relativeTime.test.ts
```
Créer ensuite une façade `apps/zachart-mentale/src/utils/relativeTime.ts` :
```ts
export { formatRelativeTime } from '@suite/shared/shell'
```
(Si le test n'existe pas à cet endroit, `git mv` échoue : alors n'écrire que le fichier source et créer `relativeTime.test.ts` dans shared avec le cas « il y a 12 min » : `expect(formatRelativeTime(new Date(Date.now()-12*60000).toISOString())).toBe('il y a 12 min')`.)

- [ ] **Step 2: Écrire le test échouant du composant**

`packages/shared/src/shell/RecentFilesList.test.tsx` :
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RecentFilesList } from './RecentFilesList'

const items = [
  { path: 'Fractions/exo-1.json', name: 'Exo 1', folder: 'Fractions', openedAt: new Date().toISOString() },
  { path: 'Calcul/exo-2.json', name: 'Exo 2', folder: 'Calcul', openedAt: new Date().toISOString() },
]

describe('RecentFilesList', () => {
  it('ne rend rien sans fichier', () => {
    const { container } = render(<RecentFilesList title="Récents" items={[]} onOpen={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('montre le titre, le nom, le dossier, et ouvre au clic', async () => {
    const onOpen = vi.fn()
    render(<RecentFilesList title="Récents" items={items} onOpen={onOpen} />)
    expect(screen.getByText('Récents')).toBeInTheDocument()
    expect(screen.getByText('Fractions')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Exo 2/ }))
    expect(onOpen).toHaveBeenCalledWith('Calcul/exo-2.json')
  })

  it('laisse l\'app ajouter un badge et envelopper la rangée', () => {
    render(
      <RecentFilesList
        title="Récents"
        items={items.slice(0, 1)}
        onOpen={vi.fn()}
        adornment={item => <span>badge-{item.name}</span>}
        wrap={(item, row) => <div data-testid={`wrap-${item.name}`}>{row}</div>}
      />
    )
    expect(screen.getByText('badge-Exo 1')).toBeInTheDocument()
    expect(screen.getByTestId('wrap-Exo 1')).toContainElement(screen.getByRole('button', { name: /Exo 1/ }))
  })
})
```

- [ ] **Step 3: Lancer le test, vérifier l'échec**

Run: `bun run --filter @suite/shared test -- RecentFilesList`
Expected: FAIL (`Cannot find module './RecentFilesList'`).

- [ ] **Step 4: Implémenter le composant**

`packages/shared/src/shell/RecentFilesList.tsx` :
```tsx
import { FileJson } from 'lucide-react'
import { formatRelativeTime } from '../lib/relativeTime'

export interface RecentItem { path: string; name: string; folder: string; openedAt: string }

/**
 * Les raccourcis de réouverture de l'écran vide. Le dossier parent accompagne chaque titre : deux
 * fichiers du même nom dans deux dossiers restent discernables sans afficher le chemin entier.
 * Purement présentationnel : l'app dit quoi afficher, et peut greffer un badge (`adornment`) ou un
 * menu (`wrap`) sans que ce composant connaisse son stockage.
 */
export function RecentFilesList({ title, items, onOpen, adornment, wrap }: {
  title: string
  items: readonly RecentItem[]
  onOpen: (path: string) => void
  adornment?: (item: RecentItem) => React.ReactNode
  wrap?: (item: RecentItem, row: React.ReactElement) => React.ReactNode
}) {
  if (items.length === 0) return null
  return (
    <div className="recent-files">
      <div className="recent-files__title">{title}</div>
      <ul className="recent-files__list">
        {items.map(item => {
          const row = (
            <button type="button" className="recent-files__row" onClick={() => onOpen(item.path)}>
              <FileJson size={16} className="recent-files__icon" aria-hidden="true" />
              <span className="recent-files__text">
                <span className="recent-files__name">{item.name}</span>
                <span className="recent-files__folder">{item.folder}</span>
              </span>
              {adornment?.(item)}
              <span className="recent-files__time">{formatRelativeTime(item.openedAt)}</span>
            </button>
          )
          return <li key={item.path}>{wrap === undefined ? row : wrap(item, row)}</li>
        })}
      </ul>
    </div>
  )
}
```
`packages/shared/src/shell/index.ts` : ajouter
```ts
export { RecentFilesList, type RecentItem } from './RecentFilesList'
export { formatRelativeTime } from '../lib/relativeTime'
```

- [ ] **Step 5: Déplacer les règles CSS `.recent-files*`**

Couper le bloc `.recent-files … .recent-files__time` (autour de `apps/zachart-mentale/src/index.css:1091` jusqu'à la dernière règle `.recent-files__*`) et le coller à la fin de `packages/shared/src/theme/theme.css`. Même contenu, rien d'autre ne change.

- [ ] **Step 6: Mentale utilise le composant partagé**

Dans `apps/zachart-mentale/src/components/RecentFilesList.tsx` : garder la signature `RecentFilesList({ files, onOpen })`, remplacer le markup de la liste par le composant partagé, et transformer `RecentFileRow` en `RecentFileMenu({ file, children })` qui garde TOUT son état (renommer, exporter, menu) et rend `<ContextMenu><ContextMenuTrigger asChild>{children}</ContextMenuTrigger>…</ContextMenu>` + les deux dialogues. Le badge devient un petit composant `RecentBadge({ path })` qui appelle `useMindMapAuthor(path)`.
```tsx
import { RecentFilesList as SharedRecentFilesList, TooltipProvider… } 
// TooltipProvider vient de '@suite/shared/ui', RecentFilesList de '@suite/shared/shell'
export function RecentFilesList({ files, onOpen }: RecentFilesListProps) {
  if (files.length === 0) return null
  const items = files.map(f => ({ path: f.path, name: mindMapBaseName(f.path), folder: fileNameOf(parentDirOf(f.path)), openedAt: f.openedAt }))
  return (
    <TooltipProvider>
      <SharedRecentFilesList
        title="Cartes ouvertes récemment"
        items={items}
        onOpen={onOpen}
        adornment={item => <RecentBadge path={item.path} />}
        wrap={(item, row) => <RecentFileMenu file={files.find(f => f.path === item.path)!}>{row}</RecentFileMenu>}
      />
    </TooltipProvider>
  )
}
```
Retirer l'import `FileJson` et `formatRelativeTime` devenus inutiles.

- [ ] **Step 7: Vérifier**

Run: `bun run --filter @suite/shared test` puis `bun run --filter zachart-mentale test -- RecentFilesList App` puis `bunx tsc --noEmit -p packages/shared` et `bunx tsc --noEmit -p apps/zachart-mentale`
Expected: tout PASS, aucune erreur de type. (Si `RecentFilesList.test.tsx` de Mentale échoue sur un texte, c'est que le markup a dérivé : le corriger dans le composant partagé, pas le test.)

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/shell packages/shared/src/lib packages/shared/src/theme/theme.css apps/zachart-mentale/src/components/RecentFilesList.tsx apps/zachart-mentale/src/index.css apps/zachart-mentale/src/utils
git commit -m "refactor(shared): recent files list and relative time move to the shared shell"
```

---

### Task 2: Fichiers récents de Zach'Math (stockage + accueil)

**Files:**
- Create: `apps/zachart-maths/src/exercises/recentFiles.ts`, `apps/zachart-maths/src/exercises/recentFiles.test.ts`
- Modify: `apps/zachart-maths/src/exercises/useExerciseStore.ts`, `apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx:91-96`, `apps/zachart-maths/src/exercises/ExerciseWorkspace.test.tsx`

**Interfaces:**
- Produces (`recentFiles.ts`):
  ```ts
  export interface RecentFile { path: string; openedAt: string }
  export const RECENT_LIMIT = 10
  export function loadRecent(): RecentFile[]
  export function saveRecent(files: readonly RecentFile[]): void
  export function pushRecent(files: readonly RecentFile[], path: string, now?: Date): RecentFile[]   // le plus récent d'abord, sans doublon, ≤ 10
  export function renameRecent(files: readonly RecentFile[], from: string, to: string): RecentFile[]
  ```
- `useExerciseStore` gagne `recent: RecentFile[]` ; `select(path)` non nul appelle `pushRecent` + `saveRecent`.

- [ ] **Step 1: Test échouant**

`recentFiles.test.ts` :
```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { RECENT_LIMIT, loadRecent, pushRecent, renameRecent, saveRecent } from './recentFiles'

const at = (s: string) => new Date(s)

describe('recentFiles', () => {
  beforeEach(() => localStorage.clear())

  it('met le plus récent en premier et ne garde pas de doublon', () => {
    let files = pushRecent([], 'A/a.json', at('2026-01-01T10:00:00Z'))
    files = pushRecent(files, 'B/b.json', at('2026-01-01T11:00:00Z'))
    files = pushRecent(files, 'A/a.json', at('2026-01-01T12:00:00Z'))
    expect(files.map(f => f.path)).toEqual(['A/a.json', 'B/b.json'])
    expect(files[0].openedAt).toBe('2026-01-01T12:00:00.000Z')
  })

  it('plafonne à 10', () => {
    let files: ReturnType<typeof pushRecent> = []
    for (let i = 0; i < 14; i++) files = pushRecent(files, `C/${i}.json`)
    expect(files).toHaveLength(RECENT_LIMIT)
    expect(files[0].path).toBe('C/13.json')
  })

  it('relit ce qu\'il a écrit', () => {
    saveRecent([{ path: 'A/a.json', openedAt: '2026-01-01T10:00:00.000Z' }])
    expect(loadRecent()).toEqual([{ path: 'A/a.json', openedAt: '2026-01-01T10:00:00.000Z' }])
  })

  it('ignore un stockage corrompu ou mal formé', () => {
    localStorage.setItem('zachart-maths:session', '{pas du json')
    expect(loadRecent()).toEqual([])
    localStorage.setItem('zachart-maths:session', JSON.stringify({ recentFiles: [1, null, { path: 3 }, { path: 'ok.json', openedAt: 'x' }] }))
    expect(loadRecent()).toEqual([{ path: 'ok.json', openedAt: 'x' }])
  })

  it('suit un renommage', () => {
    expect(renameRecent([{ path: 'A/a.json', openedAt: 'x' }], 'A/a.json', 'B/a.json')).toEqual([{ path: 'B/a.json', openedAt: 'x' }])
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `bun run --filter zachart-maths test -- recentFiles`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

`recentFiles.ts` :
```ts
const STORAGE_KEY = 'zachart-maths:session'
export const RECENT_LIMIT = 10

export interface RecentFile { path: string; /** ISO — le format que `formatRelativeTime` lit. */ openedAt: string }

/** Les derniers fichiers ouverts, lus dans `localStorage` ; un stockage absent, bloqué ou corrompu donne une liste vide. */
export function loadRecent(): RecentFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed = JSON.parse(raw) as { recentFiles?: unknown }
    if (!Array.isArray(parsed.recentFiles)) return []
    return parsed.recentFiles
      .filter((f): f is RecentFile => typeof f === 'object' && f !== null && typeof (f as RecentFile).path === 'string' && typeof (f as RecentFile).openedAt === 'string')
      .slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

export function saveRecent(files: readonly RecentFile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ recentFiles: files }))
  } catch {
    // Au mieux : un stockage bloqué veut juste dire que la prochaine session repart sans récents.
  }
}

export function pushRecent(files: readonly RecentFile[], path: string, now: Date = new Date()): RecentFile[] {
  return [{ path, openedAt: now.toISOString() }, ...files.filter(f => f.path !== path)].slice(0, RECENT_LIMIT)
}

export const renameRecent = (files: readonly RecentFile[], from: string, to: string): RecentFile[] =>
  files.map(f => (f.path === from ? { ...f, path: to } : f))
```

- [ ] **Step 4: Vérifier le passage**

Run: `bun run --filter zachart-maths test -- recentFiles`
Expected: PASS (5 tests).

- [ ] **Step 5: Test échouant de l'accueil**

Dans `ExerciseWorkspace.test.tsx`, ajouter (dans le `describe`, la fonction `setup`/`open` existent) et ajouter `recent: []` au `setState` du `beforeEach` :
```tsx
it('sans fichier ouvert, propose les derniers ouverts (ceux qui existent encore)', async () => {
  localStorage.clear()
  await setup({ 'Fractions/exo-1.json': exo('Premier') })
  await act(async () => useExerciseStore.setState({ recent: [
    { path: 'Fractions/exo-1.json', openedAt: new Date().toISOString() },
    { path: 'Fractions/disparu.json', openedAt: new Date().toISOString() },
  ] }))
  expect(screen.getByRole('button', { name: /Premier/ })).toBeInTheDocument()
  expect(screen.queryByText(/disparu/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Premier/ }))
  expect(useExerciseStore.getState().selected).toBe('Fractions/exo-1.json')
})

it('sans fichier ouvert et sans récent, garde l\'invitation', async () => {
  await setup({})
  expect(screen.getByText(/Choisis un exercice/)).toBeInTheDocument()
})
```

- [ ] **Step 6: Vérifier l'échec**

Run: `bun run --filter zachart-maths test -- ExerciseWorkspace`
Expected: FAIL (pas de bouton « Premier »).

- [ ] **Step 7: Brancher le store et l'accueil**

`useExerciseStore.ts` : importer `loadRecent, pushRecent, renameRecent, saveRecent, type RecentFile` ; ajouter `recent: RecentFile[]` à l'interface et `recent: loadRecent()` à l'état initial ; remplacer
`select: path => set({ selected: path }),` par
```ts
select: path => {
  if (path === null) return set({ selected: null })
  const recent = pushRecent(get().recent, path)
  saveRecent(recent)
  set({ selected: path, recent })
},
```
Dans `addExercise` et `duplicateExercise`, remplacer `set({ selected: path })` / `set({ selected: copy })` par `get().select(path)` / `get().select(copy)`. Dans `moveExercise` et `renameChapter`, là où `selected` change de chemin, mettre aussi `recent` à jour : `const recent = renameRecent(get().recent, path, moved); saveRecent(recent); set({ selected: moved, recent })` (idem pour `renameChapter` avec l'ancien et le nouveau `selected`).

`ExerciseWorkspace.tsx` : importer `RecentFilesList` de `@suite/shared/shell` et `splitPath` de `./names` ; remplacer le bloc `if (selected === null) {…}` par
```tsx
if (selected === null) {
  const recent = useExerciseStore.getState().recent
  // Un fichier supprimé ou déplacé n'est pas proposé : on croise avec l'arbre actuel.
  const entries = new Map(tree.flatMap(c => c.exercises.map(e => [e.path, e] as const)))
  const items = recent.flatMap(r => {
    const entry = entries.get(r.path)
    return entry === undefined || entry.unreadable === true ? [] : [{ path: r.path, name: entry.titre, folder: splitPath(r.path)[0], openedAt: r.openedAt }]
  })
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <AnimatedLogo mode="draw-pulse" size={140} />
      {items.length === 0
        ? <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Choisis un exercice dans la liste de gauche.</p>
        : <RecentFilesList title="Exercices ouverts récemment" items={items} onOpen={path => useExerciseStore.getState().select(path)} />}
    </div>
  )
}
```
et ajouter en haut du composant `const tree = useExerciseStore(s => s.tree)` et `const recent = useExerciseStore(s => s.recent)` (abonnements, pour que la liste se mette à jour), en utilisant `recent` plutôt que `getState().recent`. Vérifier le nom réel du champ « illisible » de `ExerciseEntry` (`types.ts:113-122`) et l'utiliser à la place de `unreadable` si différent.

- [ ] **Step 8: Vérifier**

Run: `bun run --filter zachart-maths test` et `bunx tsc --noEmit -p apps/zachart-maths`
Expected: PASS, pas d'erreur de type.

- [ ] **Step 9: Commit**

```bash
git add apps/zachart-maths/src/exercises/recentFiles.ts apps/zachart-maths/src/exercises/recentFiles.test.ts apps/zachart-maths/src/exercises/useExerciseStore.ts apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx apps/zachart-maths/src/exercises/ExerciseWorkspace.test.tsx
git commit -m "feat(zachart-maths): the empty screen offers the recently opened exercises"
```

---

### Task 3: Vocabulaire d'intentions et champ MathLive dans `@suite/shared/equation`

**Files:**
- Create: `packages/shared/src/equation/index.ts`
- Move: `apps/zachart-mentale/src/content/fieldIntents.ts` → `packages/shared/src/equation/fieldIntents.ts` (+ `fieldIntents.test.tsx`), `apps/zachart-mentale/src/content/MathFieldEditor.tsx` → `packages/shared/src/equation/MathFieldEditor.tsx` (+ `MathFieldEditor.test.tsx`)
- Modify: `packages/shared/package.json` (export `./equation`, dépendance `mathlive`), `apps/zachart-mentale/src/content/fieldIntents.ts` et `MathFieldEditor.tsx` (façades), `packages/shared/src/theme/theme.css`, `apps/zachart-mentale/src/index.css`

**Interfaces:**
- Produces (`@suite/shared/equation`): tout ce que `fieldIntents.ts` exporte (`ExitDirection`, `ExitVia`, `BlockPlace`, `BlockEdgeHandle`, `RawFieldIntents`, `EdgeKey`, `latchEdgeKey`, `rawFieldKeyDown`) et tout ce que `MathFieldEditor.tsx` exporte (`MathFieldEditor`, `MathFieldEditorProps`, `MathFieldHandle`, `MathfieldElement`, et le reste de ses exports).

- [ ] **Step 1: Déplacer les fichiers (l'historique git suit)**

```bash
mkdir -p packages/shared/src/equation
git mv apps/zachart-mentale/src/content/fieldIntents.ts packages/shared/src/equation/fieldIntents.ts
git mv apps/zachart-mentale/src/content/fieldIntents.test.tsx packages/shared/src/equation/fieldIntents.test.tsx
git mv apps/zachart-mentale/src/content/MathFieldEditor.tsx packages/shared/src/equation/MathFieldEditor.tsx
git mv apps/zachart-mentale/src/content/MathFieldEditor.test.tsx packages/shared/src/equation/MathFieldEditor.test.tsx
```
Les imports des deux fichiers déplacés sont déjà relatifs (`./fieldIntents`) : rien à changer dedans. Si un des tests déplacés importe autre chose qu'un fichier voisin ou un paquet npm (`@/…`), le remettre dans `apps/zachart-mentale/src/content/` et l'y garder.

- [ ] **Step 2: Le point d'entrée et le paquet**

`packages/shared/src/equation/index.ts` :
```ts
export * from './fieldIntents'
export * from './MathFieldEditor'
```
Dans `packages/shared/package.json` : ajouter `"./equation": "./src/equation/index.ts"` aux `exports`, et `"mathlive": "^0.110.0"` aux `dependencies`. Puis `bun install` à la racine.

- [ ] **Step 3: Façades dans Mentale**

`apps/zachart-mentale/src/content/fieldIntents.ts` :
```ts
export * from '@suite/shared/equation'
```
`apps/zachart-mentale/src/content/MathFieldEditor.tsx` :
```ts
export * from '@suite/shared/equation'
```
(Les importeurs existants — `EquationEditor`, `BlockEditor`, `FieldContextMenu`, tests — continuent de marcher sans modification.)

- [ ] **Step 4: Déplacer le CSS `[data-equation-side]`**

Couper les règles `[data-equation-side='left'] …` à `[data-equation-side] math-field::part(menu-toggle)` ET leur commentaire d'en-tête (`apps/zachart-mentale/src/index.css`, autour des lignes 185-225) et les coller à la fin de `packages/shared/src/theme/theme.css`.

- [ ] **Step 5: Vérifier (le filet de Mentale)**

Run: `bun run --filter @suite/shared test`, puis `bun run --filter zachart-mentale test`, puis `bunx tsc --noEmit -p packages/shared` et `-p apps/zachart-mentale`, puis `bun run test:admin`.
Expected: tout PASS. `boundary.test.ts` de shared PASS. Si `vi.mock('mathlive')` d'un test de Mentale cesse d'avoir effet (le vrai MathLive se charge), c'est un problème de résolution du paquet : vérifier qu'un seul `node_modules/mathlive` existe (`ls node_modules/mathlive`) et sinon `bun install` à la racine.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/package.json packages/shared/src/equation packages/shared/src/theme/theme.css apps/zachart-mentale/src/content/fieldIntents.ts apps/zachart-mentale/src/content/MathFieldEditor.tsx apps/zachart-mentale/src/index.css bun.lock
git commit -m "refactor(shared): keyboard intents and the MathLive field move to @suite/shared/equation"
```
(Adapter `bun.lock` / `bun.lockb` au nom réel du fichier de verrou modifié par `bun install`.)

---

### Task 4: `EquationStepsField` partagé (étapes sans id)

**Files:**
- Move: `apps/zachart-mentale/src/content/EquationEditor.tsx` → `packages/shared/src/equation/EquationStepsField.tsx`
- Create: `apps/zachart-mentale/src/content/EquationEditor.tsx` (façade qui garde l'API `block`), `packages/shared/src/equation/EquationStepsField.test.tsx`
- Modify: `packages/shared/src/equation/index.ts`

**Interfaces:**
- Consumes: `fieldIntents`, `MathFieldEditor` (Task 3) ; `equationStepIsSolved`, `navigate`, `operationVisible`, `readingOrder`, `renderMathToHtml` de `../math`.
- Produces:
  ```ts
  export interface PlainEquationStep { left: string; right: string; operation?: string }
  export interface EquationStepsFieldProps {
    steps: readonly PlainEquationStep[]
    onChange: (steps: PlainEquationStep[]) => void
    /** Numéro du bloc, pour les aria-label (« … du bloc 2 »). */
    index: number
    onEnterBlock: (place: BlockPlace) => void
    onDeleteEmpty: () => void
    onDeleteForward: () => void
    onExitBlock: (side: 'before' | 'after') => void
    onFieldChange: (handle: MathFieldHandle | null) => void
    ref?: React.Ref<BlockEdgeHandle>
  }
  export function EquationStepsField(props: EquationStepsFieldProps): JSX.Element
  ```
- La façade Mentale garde `EquationBlockField` et `EquationBlockFieldProps` (avec `block`) exactement comme aujourd'hui.

- [ ] **Step 1: Déplacer**

```bash
git mv apps/zachart-mentale/src/content/EquationEditor.tsx packages/shared/src/equation/EquationStepsField.tsx
```

- [ ] **Step 2: Rendre le composant générique**

Dans `EquationStepsField.tsx` :
1. Remplacer les imports : `import type { CardBlock, EquationStep } from '../types/cardBlock'` → supprimé ; ajouter `export interface PlainEquationStep` (ci-dessus) et utiliser `PlainEquationStep` à la place de `EquationStep`. `'@suite/shared/math'` → `'../math'`. `'./MathFieldEditor'` et `'./fieldIntents'` restent.
2. Renommer `EquationBlockFieldProps` → `EquationStepsFieldProps` : remplacer `block: Extract<CardBlock, …>` par `steps: readonly PlainEquationStep[]`, et `onChange: (block: CardBlock) => void` par `onChange: (steps: PlainEquationStep[]) => void`. Renommer `EquationBlockField` → `EquationStepsField`.
3. Dans le corps : `const steps = block.steps.length > 0 ? block.steps : [{ left: '', right: '' }]` devient `const steps: readonly PlainEquationStep[] = props.steps.length > 0 ? props.steps : [{ left: '', right: '' }]` (déstructurer `steps: stepsProp`). Remplacer `write(next)` par `onChange(next)` (supprimer la fabrication d'un `CardBlock` et le `standalone`).
4. Sur les trois `<input>` de repli (`EquationTermField` ×1, `EquationOperationField` ×1) et le champ opération : ajouter `data-math-raw=""` aux `<input>` de repli LaTeX **des membres** (celui de `EquationTermField`), et à l'`<input>` de l'opération. (Maths s'en sert pour insérer du LaTeX brut plutôt qu'un glyphe depuis la barre de symboles.)
5. Le texte « Opération » du bouton vide reste ; la couleur et les styles ne changent pas.
6. `packages/shared/src/equation/index.ts` : ajouter `export * from './EquationStepsField'`.

- [ ] **Step 3: La façade de Mentale**

`apps/zachart-mentale/src/content/EquationEditor.tsx` :
```tsx
import type { CardBlock } from '../types/cardBlock'
import { EquationStepsField, type BlockEdgeHandle, type BlockPlace, type MathFieldHandle } from '@suite/shared/equation'

export interface EquationBlockFieldProps {
  block: Extract<CardBlock, { kind: 'equation' }>
  index: number
  onChange: (block: CardBlock) => void
  onEnterBlock: (place: BlockPlace) => void
  onDeleteEmpty: () => void
  onDeleteForward: () => void
  onExitBlock: (side: 'before' | 'after') => void
  onFieldChange: (handle: MathFieldHandle | null) => void
  ref?: React.Ref<BlockEdgeHandle>
}

/** L'éditeur d'un bloc équation de Mentale : l'éditeur partagé, branché sur le `CardBlock`. */
export function EquationBlockField({ block, onChange, ...rest }: EquationBlockFieldProps) {
  return (
    <EquationStepsField
      steps={block.steps}
      onChange={steps => onChange({ kind: 'equation', steps, ...(block.standalone === true ? { standalone: true } : {}) })}
      {...rest}
    />
  )
}
```
(`ref` passe dans `rest` : en React 19 c'est une simple prop.)

- [ ] **Step 4: Test échouant des raccourcis partagés**

`EquationStepsField.test.tsx` (le `vi.mock('mathlive')` est copié de `MathFieldEditor.test.tsx` — ne pas l'inventer) :
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EquationStepsField, type PlainEquationStep } from './EquationStepsField'

// MathLive est chargé à la demande : on garde le repli LaTeX brut, qui est un éditeur complet.
vi.mock('mathlive', () => { throw new Error('indisponible') })

function Harness({ initial, onEnterBlock = vi.fn(), onDeleteEmpty = vi.fn() }: { initial: PlainEquationStep[]; onEnterBlock?: (p: string) => void; onDeleteEmpty?: () => void }) {
  const [steps, setSteps] = useState(initial)
  return (
    <EquationStepsField
      steps={steps} onChange={setSteps} index={0}
      onEnterBlock={onEnterBlock} onDeleteEmpty={onDeleteEmpty}
      onDeleteForward={vi.fn()} onExitBlock={vi.fn()} onFieldChange={vi.fn()}
    />
  )
}
const left = (n: number) => screen.getByLabelText(`Membre gauche de l'étape ${n} du bloc 1 (LaTeX)`)

describe('EquationStepsField (repli brut)', () => {
  it('Entrée crée une étape et jamais un bloc', async () => {
    const onEnterBlock = vi.fn()
    render(<Harness initial={[{ left: '2x', right: '8' }]} onEnterBlock={onEnterBlock} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('{Enter}')
    expect(left(2)).toHaveFocus()
    expect(onEnterBlock).not.toHaveBeenCalled()
  })

  it('Entrée saute à l\'étape suivante si elle est vide', async () => {
    render(<Harness initial={[{ left: 'a', right: 'b' }, { left: '', right: '' }]} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('{Enter}')
    expect(screen.getAllByLabelText(/Membre gauche/)).toHaveLength(2)
    expect(left(2)).toHaveFocus()
  })

  it('Ctrl+Entrée demande un bloc après (outside), Ctrl+Maj+Entrée dedans (inside)', async () => {
    const onEnterBlock = vi.fn()
    render(<Harness initial={[{ left: 'a', right: 'b' }]} onEnterBlock={onEnterBlock} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(onEnterBlock).toHaveBeenLastCalledWith('outside')
    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}')
    expect(onEnterBlock).toHaveBeenLastCalledWith('inside')
  })

  it('Retour arrière dans une étape vide la supprime et remonte', async () => {
    render(<Harness initial={[{ left: 'a', right: 'b' }, { left: '', right: '' }]} />)
    await userEvent.click(left(2))
    await userEvent.keyboard('{Backspace}')
    expect(screen.getAllByLabelText(/Membre gauche/)).toHaveLength(1)
  })

  it('Retour arrière sur l\'unique étape vide demande la suppression du bloc ; pas si elle a du contenu', async () => {
    const onDeleteEmpty = vi.fn()
    const { unmount } = render(<Harness initial={[{ left: '', right: '' }]} onDeleteEmpty={onDeleteEmpty} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('{Backspace}')
    expect(onDeleteEmpty).toHaveBeenCalledTimes(1)
    unmount()
    const again = vi.fn()
    render(<Harness initial={[{ left: '', right: '3' }]} onDeleteEmpty={again} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('{Backspace}')
    expect(again).not.toHaveBeenCalled()
  })

  it('un Retour arrière MAINTENU ne traverse pas dans le champ du dessus', async () => {
    render(<Harness initial={[{ left: 'abc', right: 'def' }, { left: '', right: '' }]} />)
    await userEvent.click(left(2))
    // Premier appui : supprime l'étape vide ; les répétitions qui suivent sont avalées.
    await userEvent.keyboard('{Backspace>3/}')
    expect(screen.getByLabelText("Membre droit de l'étape 1 du bloc 1 (LaTeX)")).toHaveValue('def')
    expect(left(1)).toHaveValue('abc')
  })
})
```
(Si un test échoue parce que le `vi.mock` ne force pas le repli, reprendre la mécanique de `MathFieldEditor.test.tsx`/`equationKeys.test.tsx` de Mentale ; leur `aria-label` de repli est la référence.)

- [ ] **Step 5: Lancer**

Run: `bun run --filter @suite/shared test -- EquationStepsField`
Expected: PASS une fois le Step 2 fait (ce sont des tests de caractérisation du comportement déplacé : s'ils échouent, c'est que la généralisation a cassé quelque chose, à corriger dans le composant).

- [ ] **Step 6: Le filet complet de Mentale**

Run: `bun run --filter zachart-mentale test`, `bunx tsc --noEmit -p packages/shared`, `bunx tsc --noEmit -p apps/zachart-mentale`, `bun run test:admin`
Expected: tout PASS (`equationKeys.test.tsx`, `BlockEditor.test.tsx`, `blockKeys.test.tsx`, `formulaZoneKeys.test.tsx` en particulier).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/equation apps/zachart-mentale/src/content/EquationEditor.tsx
git commit -m "refactor(shared): the equation steps editor moves to @suite/shared/equation, Mentale keeps a thin facade"
```

---

### Task 5: `LinesBlockField` — le Calcul comme liste de sous-blocs

**Files:**
- Create: `packages/shared/src/equation/lines.ts`, `packages/shared/src/equation/lines.test.ts`, `packages/shared/src/equation/LinesBlockField.tsx`, `packages/shared/src/equation/LinesBlockField.test.tsx`
- Modify: `packages/shared/src/equation/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SubLine { id: string; latex: string }
  export const newLine: () => SubLine
  export function insertLineAfter(lines: readonly SubLine[], index: number): { lines: SubLine[]; added: SubLine }
  export function removeLineAt(lines: readonly SubLine[], index: number): SubLine[]     // jamais en dessous d'une ligne
  export const isLineEmpty: (line: SubLine) => boolean

  export interface LinesBlockFieldProps {
    lines: readonly SubLine[]
    onChange: (lines: SubLine[]) => void
    ariaLabel: string                       // « Calcul » : « Ligne 2 du calcul » = `${ariaLabel}` + n
    onEnterBlock: (place: BlockPlace) => void
    onDeleteEmpty: () => void
    onDeleteForward: () => void
    onExitBlock: (side: 'before' | 'after') => void
    onFieldChange: (handle: MathFieldHandle | null) => void
    ref?: React.Ref<BlockEdgeHandle>
  }
  export function LinesBlockField(props: LinesBlockFieldProps): JSX.Element
  ```
- Libellés : `Ligne ${n} du calcul` (repli brut : `Ligne ${n} du calcul (LaTeX)`). `ariaLabel` sert de préfixe de groupe (`role="group"`).

- [ ] **Step 1: Test échouant de la logique pure**

`lines.test.ts` :
```ts
import { describe, expect, it } from 'vitest'
import { insertLineAfter, isLineEmpty, newLine, removeLineAt } from './lines'

const L = (id: string, latex = '') => ({ id, latex })

describe('lines', () => {
  it('insère une ligne vide juste après l\'index', () => {
    const { lines, added } = insertLineAfter([L('a', '1'), L('b', '2')], 0)
    expect(lines.map(l => l.id)).toEqual(['a', added.id, 'b'])
    expect(added.latex).toBe('')
  })
  it('retire une ligne mais jamais la dernière', () => {
    expect(removeLineAt([L('a'), L('b')], 0).map(l => l.id)).toEqual(['b'])
    expect(removeLineAt([L('a')], 0).map(l => l.id)).toEqual(['a'])
  })
  it('sait si une ligne est vide (espaces compris)', () => {
    expect(isLineEmpty(L('a', '  '))).toBe(true)
    expect(isLineEmpty(L('a', 'x'))).toBe(false)
    expect(newLine().latex).toBe('')
  })
})
```

- [ ] **Step 2: Échec attendu**

Run: `bun run --filter @suite/shared test -- lines`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `lines.ts`**

```ts
/** Une ligne d'un bloc Calcul : un sous-bloc, un champ de formule. */
export interface SubLine { id: string; latex: string }

export const newLine = (): SubLine => ({ id: crypto.randomUUID(), latex: '' })

export const isLineEmpty = (line: SubLine): boolean => line.latex.trim() === ''

export function insertLineAfter(lines: readonly SubLine[], index: number): { lines: SubLine[]; added: SubLine } {
  const added = newLine()
  const next = [...lines]
  next.splice(index + 1, 0, added)
  return { lines: next, added }
}

/** Un bloc Calcul garde toujours au moins une ligne. */
export function removeLineAt(lines: readonly SubLine[], index: number): SubLine[] {
  return lines.length <= 1 || index < 0 || index >= lines.length ? [...lines] : lines.filter((_, i) => i !== index)
}
```
Run: `bun run --filter @suite/shared test -- lines` → PASS.

- [ ] **Step 4: Test échouant du composant**

`LinesBlockField.test.tsx` (même `vi.mock('mathlive', …)` que Task 4) :
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LinesBlockField } from './LinesBlockField'
import type { SubLine } from './lines'

vi.mock('mathlive', () => { throw new Error('indisponible') })

const L = (id: string, latex = ''): SubLine => ({ id, latex })
const line = (n: number) => screen.getByLabelText(`Ligne ${n} du calcul (LaTeX)`)

function Harness({ initial, onEnterBlock = vi.fn(), onDeleteEmpty = vi.fn(), onExitBlock = vi.fn() }: {
  initial: SubLine[]; onEnterBlock?: (p: string) => void; onDeleteEmpty?: () => void; onExitBlock?: (s: string) => void
}) {
  const [lines, setLines] = useState(initial)
  return (
    <LinesBlockField
      lines={lines} onChange={setLines} ariaLabel="Calcul"
      onEnterBlock={onEnterBlock} onDeleteEmpty={onDeleteEmpty} onDeleteForward={vi.fn()}
      onExitBlock={onExitBlock} onFieldChange={vi.fn()}
    />
  )
}

describe('LinesBlockField', () => {
  it('Entrée crée une ligne juste en dessous, avec le curseur, sans créer de bloc', async () => {
    const onEnterBlock = vi.fn()
    render(<Harness initial={[L('a', '1+1'), L('b', '3')]} onEnterBlock={onEnterBlock} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{Enter}')
    expect(screen.getAllByLabelText(/Ligne \d du calcul/)).toHaveLength(3)
    expect(line(2)).toHaveValue('')
    expect(line(2)).toHaveFocus()
    expect(line(3)).toHaveValue('3')
    expect(onEnterBlock).not.toHaveBeenCalled()
  })

  it('Entrée saute à la ligne suivante si elle est déjà vide', async () => {
    render(<Harness initial={[L('a', 'x'), L('b')]} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{Enter}')
    expect(screen.getAllByLabelText(/Ligne \d du calcul/)).toHaveLength(2)
    expect(line(2)).toHaveFocus()
  })

  it('↑ ↓ passent d\'une ligne à l\'autre ; ↑ sur la première sort du bloc par le haut, ↓ sur la dernière par le bas', async () => {
    const onExitBlock = vi.fn()
    render(<Harness initial={[L('a', 'x'), L('b', 'y')]} onExitBlock={onExitBlock} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{ArrowDown}')
    expect(line(2)).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onExitBlock).toHaveBeenLastCalledWith('after')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(onExitBlock).toHaveBeenLastCalledWith('before')
  })

  it('← au tout début d\'une ligne va à la fin de la précédente', async () => {
    render(<Harness initial={[L('a', 'xy'), L('b', 'z')]} />)
    await userEvent.click(line(2))
    ;(line(2) as HTMLInputElement).setSelectionRange(0, 0)
    await userEvent.keyboard('{ArrowLeft}')
    expect(line(1)).toHaveFocus()
  })

  it('Retour arrière sur une ligne vide la supprime ; sur l\'unique ligne vide, demande la suppression du bloc', async () => {
    render(<Harness initial={[L('a', 'x'), L('b')]} />)
    await userEvent.click(line(2))
    await userEvent.keyboard('{Backspace}')
    expect(screen.getAllByLabelText(/Ligne \d du calcul/)).toHaveLength(1)
    expect(line(1)).toHaveFocus()
  })

  it('l\'unique ligne vide d\'un bloc vide demande la suppression du bloc, pas celle d\'un bloc non vide', async () => {
    const onDeleteEmpty = vi.fn()
    const { unmount } = render(<Harness initial={[L('a')]} onDeleteEmpty={onDeleteEmpty} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{Backspace}')
    expect(onDeleteEmpty).toHaveBeenCalledTimes(1)
    unmount()
    const other = vi.fn()
    render(<Harness initial={[L('a', 'x'), L('b')]} onDeleteEmpty={other} />)
    await userEvent.click(line(2))
    await userEvent.keyboard('{Backspace}')
    expect(other).not.toHaveBeenCalled()
  })

  it('un Retour arrière maintenu ne traverse pas dans la ligne du dessus', async () => {
    render(<Harness initial={[L('a', 'abc'), L('b')]} />)
    await userEvent.click(line(2))
    await userEvent.keyboard('{Backspace>3/}')
    expect(line(1)).toHaveValue('abc')
  })

  it('Ctrl+Entrée demande un bloc après', async () => {
    const onEnterBlock = vi.fn()
    render(<Harness initial={[L('a', 'x')]} onEnterBlock={onEnterBlock} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(onEnterBlock).toHaveBeenCalledWith('outside')
  })

  it('n\'a aucun bouton : le clavier suffit', () => {
    render(<Harness initial={[L('a', 'x')]} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
```

- [ ] **Step 5: Échec attendu**

Run: `bun run --filter @suite/shared test -- LinesBlockField`
Expected: FAIL (module introuvable).

- [ ] **Step 6: Implémenter `LinesBlockField.tsx`**

Même plomberie que `EquationStepsField`, pour un seul champ par sous-bloc. Écrire :
```tsx
import { useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react'
import { renderMathToHtml } from '../math'
import { MathFieldEditor, type MathFieldHandle } from './MathFieldEditor'
import { rawFieldKeyDown, type BlockEdgeHandle, type BlockPlace, type ExitDirection, type ExitVia } from './fieldIntents'
import { insertLineAfter, isLineEmpty, removeLineAt, type SubLine } from './lines'

export interface LinesBlockFieldProps {
  lines: readonly SubLine[]
  onChange: (lines: SubLine[]) => void
  ariaLabel: string
  onEnterBlock: (place: BlockPlace) => void
  onDeleteEmpty: () => void
  onDeleteForward: () => void
  onExitBlock: (side: 'before' | 'after') => void
  onFieldChange: (handle: MathFieldHandle | null) => void
  ref?: React.Ref<BlockEdgeHandle>
}

const ROW: CSSProperties = {
  boxSizing: 'border-box', padding: 'var(--eq-term-pad, 8px 14px)', borderRadius: 10,
  border: '1.5px solid var(--border)', background: 'transparent',
}
const RAW: CSSProperties = {
  width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 14, padding: '4px 6px',
  borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'inherit',
}

/**
 * Un bloc de lignes (le Calcul) : chaque ligne est un SOUS-BLOC, un champ de formule. Même contrat
 * clavier que l'équation (voir `EquationStepsField`) : Entrée ajoute un sous-bloc, Ctrl/Cmd+Entrée
 * un bloc, les flèches passent d'un sous-bloc à l'autre puis sortent du bloc, Retour arrière/Suppr
 * ne retirent qu'une ligne vide — ou, sur l'unique ligne vide, le bloc lui-même.
 */
export function LinesBlockField({ lines, onChange, ariaLabel, onEnterBlock, onDeleteEmpty, onDeleteForward, onExitBlock, onFieldChange, ref }: LinesBlockFieldProps) {
  const handles = useRef(new Map<string, MathFieldHandle | null>())
  const pending = useRef<{ id: string; at: 'start' | 'end' } | null>(null)
  const linesRef = useRef(lines)
  linesRef.current = lines

  // Le focus est posé APRÈS le rendu qui a ajouté ou retiré une ligne : c'est là que son handle existe.
  useEffect(() => {
    const target = pending.current
    if (target === null) return
    pending.current = null
    const handle = handles.current.get(target.id)
    if (target.at === 'end') handle?.focusEnd()
    else handle?.focusStart()
  })

  useImperativeHandle(ref, () => ({
    focusEdge(at) {
      const list = linesRef.current
      const target = at === 'start' ? list[0] : list[list.length - 1]
      const handle = target === undefined ? null : handles.current.get(target.id) ?? null
      if (at === 'start') handle?.focusStart()
      else handle?.focusEnd()
    },
  }), [])

  const focusLine = (index: number, at: 'start' | 'end') => {
    const target = lines[index]
    const handle = target === undefined ? null : handles.current.get(target.id) ?? null
    if (at === 'end') handle?.focusEnd()
    else handle?.focusStart()
  }

  const setLatex = (index: number, latex: string) =>
    onChange(lines.map((l, i) => (i === index ? { ...l, latex } : l)))

  const enter = (index: number) => {
    const next = lines[index + 1]
    if (next !== undefined && isLineEmpty(next)) return focusLine(index + 1, 'start')
    const { lines: inserted, added } = insertLineAfter(lines, index)
    pending.current = { id: added.id, at: 'start' }
    onChange(inserted)
  }

  const remove = (index: number, focus: number, at: 'start' | 'end') => {
    pending.current = { id: lines[focus].id, at }
    onChange(removeLineAt(lines, index))
  }

  const blockEmpty = lines.length === 1 && isLineEmpty(lines[0])

  const intentsFor = (index: number) => ({
    onEnter: () => enter(index),
    onEnterBlock,
    onExit: (direction: ExitDirection, via: ExitVia) => {
      const backward = direction === 'left' || direction === 'up'
      const target = backward ? index - 1 : index + 1
      if (target < 0 || target >= lines.length) {
        if (via === 'tab') return false
        onExitBlock(backward ? 'before' : 'after')
        return true
      }
      focusLine(target, backward ? 'end' : 'start')
      return true
    },
    onBackspaceAtStart: () => {
      if (index === 0) {
        if (blockEmpty) onDeleteEmpty()
        return
      }
      if (isLineEmpty(lines[index])) remove(index, index - 1, 'end')
      else focusLine(index - 1, 'end')
    },
    onDeleteAtEnd: () => {
      const next = lines[index + 1]
      if (next === undefined) {
        if (blockEmpty) onDeleteForward()
        return
      }
      if (isLineEmpty(next)) remove(index + 1, index, 'end')
      else focusLine(index + 1, 'start')
    },
  })

  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((line, index) => {
        const label = `Ligne ${index + 1} du calcul`
        const intents = intentsFor(index)
        return (
          <div key={line.id} style={ROW} onFocus={() => onFieldChange(handles.current.get(line.id) ?? null)}>
            <MathFieldEditor
              latex={line.latex}
              onChange={latex => setLatex(index, latex)}
              ariaLabel={label}
              ref={handle => { handles.current.set(line.id, handle) }}
              onEnter={intents.onEnter}
              onEnterBlock={intents.onEnterBlock}
              onBackspaceAtStart={intents.onBackspaceAtStart}
              onDeleteAtEnd={intents.onDeleteAtEnd}
              onExit={intents.onExit}
              tabExits
              fallback={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <input
                    aria-label={`${label} (LaTeX)`}
                    data-math-raw=""
                    value={line.latex}
                    spellCheck={false}
                    onChange={event => setLatex(index, event.target.value)}
                    onKeyDown={rawFieldKeyDown({ ...intents, onEnter: () => intents.onEnter(), tabExits: true })}
                    style={RAW}
                  />
                  <div
                    style={{ minHeight: 18, overflowX: 'auto' }}
                    // Sûr : `renderMathToHtml` échappe ce qu'il émet et `trust: false` interdit liens et ressources.
                    dangerouslySetInnerHTML={{ __html: renderMathToHtml(line.latex, false) }}
                  />
                </div>
              }
            />
          </div>
        )
      })}
    </div>
  )
}
```
`index.ts` : ajouter `export * from './lines'` et `export * from './LinesBlockField'`.

- [ ] **Step 7: Vérifier**

Run: `bun run --filter @suite/shared test` et `bunx tsc --noEmit -p packages/shared`
Expected: PASS. Si le test « ← au tout début » échoue parce que `userEvent.click` place le curseur à la fin, c'est le `setSelectionRange(0,0)` du test qui compte : vérifier qu'il est bien avant la frappe.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/equation
git commit -m "feat(shared): LinesBlockField, a block of formula lines with the same keyboard as equations"
```

---

### Task 6: Données de Zach'Math — Calcul en `lignes`, adaptateur d'étapes

**Files:**
- Modify: `apps/zachart-maths/src/exercises/blocks.ts`, `apps/zachart-maths/src/exercises/blocks.test.ts`, `apps/zachart-maths/src/cours/exerciseContext.ts`
- Create: `apps/zachart-maths/src/exercises/stepIds.ts`, `apps/zachart-maths/src/exercises/stepIds.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // blocks.ts
  export interface CalcLine { id: string; latex: string }
  export interface CalcBlock { id: string; type: 'calcul'; lignes: CalcLine[] }
  // stepIds.ts
  import type { PlainEquationStep } from '@suite/shared/equation'
  export function toPlain(steps: readonly EquationStep[]): PlainEquationStep[]
  export function withIds(prev: readonly EquationStep[], next: readonly PlainEquationStep[]): EquationStep[]
  ```

- [ ] **Step 1: Tests échouants — migration et conversions**

Dans `blocks.test.ts`, remplacer l'attente `toMatchObject({ type: 'calcul', expression: '', resultat: '' })` (ligne ~14) par `toMatchObject({ type: 'calcul', lignes: [{ latex: '' }] })`, et le `calc` de la ligne ~140 par `{ id: 'c', type: 'calcul', lignes: [{ id: 'l1', latex: '3×4' }, { id: 'l2', latex: '12' }] }`, la conversion Texte → Calcul (ligne ~143) par `lignes` d'une ligne par ligne de texte non vide (`'2x = 8'` → `lignes: [{ id: expect.any(String), latex: '2x = 8' }]`). Ajouter :
```ts
describe('migration du Calcul', () => {
  it('relit un ancien { expression, resultat } comme deux lignes', () => {
    const [b] = parseBlocks([{ id: 'c', type: 'calcul', expression: '3×4', resultat: '12' }])
    expect(b).toMatchObject({ type: 'calcul', lignes: [{ latex: '3×4' }, { latex: '12' }] })
  })
  it('ignore un resultat vide', () => {
    const [b] = parseBlocks([{ id: 'c', type: 'calcul', expression: '3×4', resultat: '' }])
    expect((b as { lignes: unknown[] }).lignes).toHaveLength(1)
  })
  it('garde toujours une ligne', () => {
    const [b] = parseBlocks([{ id: 'c', type: 'calcul', lignes: [] }])
    expect((b as { lignes: unknown[] }).lignes).toHaveLength(1)
  })
  it('relit des lignes, leur donne un id, ignore ce qui n\'est pas une chaîne', () => {
    const [b] = parseBlocks([{ type: 'calcul', lignes: [{ latex: 'a' }, { id: 'x', latex: 5 }, 'oups'] }])
    const lignes = (b as { lignes: { id: string; latex: string }[] }).lignes
    expect(lignes.map(l => l.latex)).toEqual(['a', '', ''])
    expect(lignes.every(l => l.id !== '')).toBe(true)
  })
  it('conserve un bloc de type inconnu tel quel', () => {
    const raw = { id: 'z', type: 'futur', x: 1 }
    expect(parseBlocks([raw])[0]).toMatchObject(raw)
  })
})
```
`stepIds.test.ts` :
```ts
import { describe, expect, it } from 'vitest'
import { toPlain, withIds } from './stepIds'

const S = (id: string, left = '', right = '', operation = '') => ({ id, left, right, operation })

describe('stepIds', () => {
  it('toPlain retire les ids et garde les champs', () => {
    expect(toPlain([S('a', '1', '2', '+3')])).toEqual([{ left: '1', right: '2', operation: '+3' }])
  })
  it('garde les ids quand seul un champ change', () => {
    const prev = [S('a', '1'), S('b', '2')]
    expect(withIds(prev, [{ left: '1x', right: '', operation: '' }, { left: '2', right: '', operation: '' }]).map(s => s.id)).toEqual(['a', 'b'])
  })
  it('donne un id neuf à l\'étape insérée au milieu et garde les autres', () => {
    const prev = [S('a', '1'), S('b', '2')]
    const out = withIds(prev, [{ left: '1', right: '', operation: '' }, { left: '', right: '', operation: '' }, { left: '2', right: '', operation: '' }])
    expect(out[0].id).toBe('a')
    expect(out[2].id).toBe('b')
    expect(out[1].id).not.toBe('a')
    expect(out[1].id).not.toBe('b')
  })
  it('garde les ids restants quand une étape disparaît', () => {
    const prev = [S('a', '1'), S('b', ''), S('c', '3')]
    expect(withIds(prev, [{ left: '1', right: '', operation: '' }, { left: '3', right: '', operation: '' }]).map(s => s.id)).toEqual(['a', 'c'])
  })
})
```

- [ ] **Step 2: Échec attendu**

Run: `bun run --filter zachart-maths test -- blocks stepIds`
Expected: FAIL.

- [ ] **Step 3: Implémenter `blocks.ts`**

- Interface : `export interface CalcLine { id: string; latex: string }` et `export interface CalcBlock { id: string; type: 'calcul'; lignes: CalcLine[] }`.
- `newLine` n'existe pas ici : ajouter `export const newCalcLine = (): CalcLine => ({ id: crypto.randomUUID(), latex: '' })`.
- `newBlock` : `case 'calcul': return { id, type, lignes: [newCalcLine()] }`.
- `parseBlocks` : `case 'calcul': blocks.push({ id, type: 'calcul', lignes: normalizeCalcLines(b) }); break` avec
```ts
/** `lignes` quand il existe ; sinon un ancien `{ expression, resultat }` devient deux lignes (le résultat vide est ignoré). Jamais vide. */
function normalizeCalcLines(b: Record<string, unknown>): CalcLine[] {
  if (Array.isArray(b.lignes)) {
    const lines = b.lignes.map(l => {
      const o = typeof l === 'object' && l !== null ? (l as Record<string, unknown>) : {}
      return { id: typeof o.id === 'string' && o.id !== '' ? o.id : crypto.randomUUID(), latex: str(o.latex) }
    })
    return lines.length > 0 ? lines : [newCalcLine()]
  }
  const legacy = [str(b.expression), str(b.resultat)].filter((latex, i) => i === 0 || latex !== '')
  return legacy.map(latex => ({ id: crypto.randomUUID(), latex }))
}
```
- `blockToPlain` : `case 'calcul': return block.lignes.map(l => l.latex).join('\n')`.
- `convertBlock` vers `'calcul'` : `{ id: block.id, type: 'calcul', lignes: (lines.length > 0 ? lines : ['']).map(latex => ({ id: crypto.randomUUID(), latex })) }`.
- `cours/exerciseContext.ts:14` : `case 'calcul': formules.push(block.lignes.map(l => l.latex).join(' ')); break`.

`stepIds.ts` :
```ts
import type { PlainEquationStep } from '@suite/shared/equation'
import type { EquationStep } from './blocks'

export const toPlain = (steps: readonly EquationStep[]): PlainEquationStep[] =>
  steps.map(({ left, right, operation }) => ({ left, right, operation }))

const same = (a: EquationStep, b: PlainEquationStep) => a.left === b.left && a.right === b.right && a.operation === (b.operation ?? '')

/**
 * Rend ses ids à une liste d'étapes que le moteur partagé (sans ids) vient de modifier : un champ
 * changé garde l'id ; une étape insérée ou retirée se repère par le préfixe et le suffixe qui
 * n'ont pas bougé. Deux étapes au contenu identique sont interchangeables, donc l'ambiguïté est sans effet.
 */
export function withIds(prev: readonly EquationStep[], next: readonly PlainEquationStep[]): EquationStep[] {
  const fresh = (s: PlainEquationStep): EquationStep => ({ id: crypto.randomUUID(), left: s.left, right: s.right, operation: s.operation ?? '' })
  const keep = (p: EquationStep, s: PlainEquationStep): EquationStep => ({ id: p.id, left: s.left, right: s.right, operation: s.operation ?? '' })
  if (next.length === prev.length) return next.map((s, i) => keep(prev[i], s))
  let head = 0
  while (head < prev.length && head < next.length && same(prev[head], next[head])) head++
  let tail = 0
  while (tail < prev.length - head && tail < next.length - head && same(prev[prev.length - 1 - tail], next[next.length - 1 - tail])) tail++
  return next.map((s, i) => {
    if (i < head) return keep(prev[i], s)
    if (i >= next.length - tail) return keep(prev[prev.length - (next.length - i)], s)
    return fresh(s)
  })
}
```

- [ ] **Step 4: Vérifier**

Run: `bun run --filter zachart-maths test -- blocks stepIds exerciseContext suggest` puis `bunx tsc --noEmit -p apps/zachart-maths`
Expected: les tests de `blocks`, `stepIds`, `cours` PASS ; `tsc` signale encore `CalcEditor.tsx` (réécrit au Task 7) — c'est attendu à ce stade, ne corriger que `blocks.ts`/`exerciseContext.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/zachart-maths/src/exercises/blocks.ts apps/zachart-maths/src/exercises/blocks.test.ts apps/zachart-maths/src/exercises/stepIds.ts apps/zachart-maths/src/exercises/stepIds.test.ts apps/zachart-maths/src/cours/exerciseContext.ts
git commit -m "feat(zachart-maths): the Calcul block is a list of lines, old files are read without loss"
```

---

### Task 7: Câbler Zach'Math — éditeurs partagés, Ctrl+Entrée, sorties de bloc

**Files:**
- Modify: `apps/zachart-maths/src/exercises/EquationEditor.tsx` (réécrit en adaptateur), `apps/zachart-maths/src/exercises/CalcEditor.tsx` (réécrit en adaptateur), `apps/zachart-maths/src/exercises/BlockStack.tsx`, `apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx` (mémo du champ pour la barre de symboles)
- Delete: `apps/zachart-maths/src/math/MathField.tsx` **seulement si** plus rien ne l'importe (Step 8) ; `apps/zachart-maths/src/exercises/eqTones.ts` s'il n'est plus importé
- Test: `apps/zachart-maths/src/exercises/EquationEditor.test.tsx`, `EquationEditor.raw.test.tsx`, `BlockStack.test.tsx` (mis à jour), `apps/zachart-maths/src/exercises/BlockKeys.test.tsx` (nouveau)

**Interfaces:**
- Consumes: `EquationStepsField`, `LinesBlockField`, `BlockEdgeHandle`, `BlockPlace`, `MathFieldHandle`, `SubLine` de `@suite/shared/equation` ; `toPlain`, `withIds` (Task 6).
- Produces: `editorFor(block, onChange, ctx)` où `ctx = { index: number; onEnterBlock: () => void; onDeleteEmpty: () => void; onDeleteForward: () => void; onExitBlock: (side: 'before' | 'after') => void; edge: React.Ref<BlockEdgeHandle> }`.

- [ ] **Step 1: Tests échouants au niveau de la pile**

`BlockKeys.test.tsx` (reprendre le `Harness` et le `vi.mock('mathlive')` de `BlockStack.test.tsx` ; pour forcer le repli brut utiliser le même mock qui échoue que `EquationEditor.raw.test.tsx`) :
```tsx
it('Entrée dans une équation n\'ajoute pas de bloc, Ctrl+Entrée en ajoute un juste après', async () => {
  render(<Harness initial={[{ id: 'e', type: 'equation', etapes: [{ id: 's', left: '2x', right: '8', operation: '' }] }, { id: 't', type: 'texte', contenu: 'fin' }]} />)
  await userEvent.click(screen.getByLabelText("Membre gauche de l'étape 1 du bloc 1 (LaTeX)"))
  await userEvent.keyboard('{Enter}')
  expect(blockNames()).toHaveLength(2)                         // toujours 2 blocs
  expect(screen.getAllByLabelText(/Membre gauche/)).toHaveLength(2) // mais 2 étapes
  await userEvent.keyboard('{Control>}{Enter}{/Control}')
  expect(blockNames()).toHaveLength(3)
  expect(blockNames()[1]).toMatch(/Calcul|Texte|Équation/)     // inséré entre l'équation et le texte
})

it('Entrée dans un Calcul ajoute une ligne et pas un bloc', async () => {
  render(<Harness initial={[{ id: 'c', type: 'calcul', lignes: [{ id: 'l', latex: '1+1' }] }]} />)
  await userEvent.click(screen.getByLabelText('Ligne 1 du calcul (LaTeX)'))
  await userEvent.keyboard('{Enter}')
  expect(blockNames()).toHaveLength(1)
  expect(screen.getAllByLabelText(/Ligne \d du calcul/)).toHaveLength(2)
})

it('Ctrl+Entrée crée un bloc de même type que le courant (équation → équation) et lui donne le curseur', async () => {
  render(<Harness initial={[{ id: 'e', type: 'equation', etapes: [{ id: 's', left: 'a', right: 'b', operation: '' }] }]} />)
  await userEvent.click(screen.getByLabelText("Membre gauche de l'étape 1 du bloc 1 (LaTeX)"))
  await userEvent.keyboard('{Control>}{Enter}{/Control}')
  expect(screen.getByLabelText("Membre gauche de l'étape 1 du bloc 2 (LaTeX)")).toHaveFocus()
})

it('↓ depuis la dernière ligne du bloc 1 entre dans le bloc 2 ; ↑ revient', async () => {
  render(<Harness initial={[
    { id: 'c', type: 'calcul', lignes: [{ id: 'l', latex: '1' }] },
    { id: 'd', type: 'calcul', lignes: [{ id: 'm', latex: '2' }] },
  ]} />)
  await userEvent.click(screen.getByLabelText('Ligne 1 du calcul (LaTeX)'))
  await userEvent.keyboard('{ArrowDown}')
  expect(screen.getAllByLabelText(/Ligne 1 du calcul/)[1]).toHaveFocus()
  await userEvent.keyboard('{ArrowUp}')
  expect(screen.getAllByLabelText(/Ligne 1 du calcul/)[0]).toHaveFocus()
})

it('Retour arrière dans l\'unique ligne vide du bloc supprime le bloc et remonte au précédent ; pas si le bloc a du contenu', async () => {
  render(<Harness initial={[
    { id: 't', type: 'texte', contenu: 'avant' },
    { id: 'c', type: 'calcul', lignes: [{ id: 'l', latex: '' }] },
  ]} />)
  await userEvent.click(screen.getByLabelText('Ligne 1 du calcul (LaTeX)'))
  await userEvent.keyboard('{Backspace}')
  expect(blockNames()).toHaveLength(1)
})

it('pas de bouton ✕ ni « + Étape » ni menu sur les champs', () => {
  render(<Harness initial={[{ id: 'e', type: 'equation', etapes: [{ id: 's', left: 'a', right: 'b', operation: '' }] }]} />)
  expect(screen.queryByRole('button', { name: /Supprimer l'étape/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Étape/ })).toBeNull()
})
```
`blockNames()` : la liste des `aria-label` « Bloc … » de `BlockCard` (voir `BlockStack.test.tsx:names`). Réutiliser son helper plutôt que d'en écrire un second.

- [ ] **Step 2: Échec attendu**

Run: `bun run --filter zachart-maths test -- BlockKeys`
Expected: FAIL.

- [ ] **Step 3: `EquationEditor.tsx` devient un adaptateur**

Remplacer tout le fichier par :
```tsx
import { EquationStepsField, type BlockEdgeHandle, type BlockPlace, type MathFieldHandle } from '@suite/shared/equation'
import type { EquationBlock } from './blocks'
import { toPlain, withIds } from './stepIds'

/**
 * Le bloc Équation : l'éditeur partagé avec Mentale (`@suite/shared/equation`), branché sur les
 * étapes de Maths. Le moteur ne connaît pas les ids ; `withIds` les rend après chaque changement.
 */
export function EquationEditor({ block, index, onChange, onEnterBlock, onDeleteEmpty, onDeleteForward, onExitBlock, onFieldChange, edge }: {
  block: EquationBlock
  index: number
  onChange: (patch: Partial<EquationBlock>) => void
  onEnterBlock: (place: BlockPlace) => void
  onDeleteEmpty: () => void
  onDeleteForward: () => void
  onExitBlock: (side: 'before' | 'after') => void
  onFieldChange: (handle: MathFieldHandle | null) => void
  edge: React.Ref<BlockEdgeHandle>
}) {
  return (
    <EquationStepsField
      steps={toPlain(block.etapes)}
      onChange={next => onChange({ etapes: withIds(block.etapes, next) })}
      index={index}
      onEnterBlock={onEnterBlock}
      onDeleteEmpty={onDeleteEmpty}
      onDeleteForward={onDeleteForward}
      onExitBlock={onExitBlock}
      onFieldChange={onFieldChange}
      ref={edge}
    />
  )
}
```
`CalcEditor.tsx` :
```tsx
import { LinesBlockField, type BlockEdgeHandle, type BlockPlace, type MathFieldHandle } from '@suite/shared/equation'
import type { CalcBlock } from './blocks'

/** Le bloc Calcul : une liste de lignes (sous-blocs), chacune un champ de formule. */
export function CalcEditor({ block, onChange, onEnterBlock, onDeleteEmpty, onDeleteForward, onExitBlock, onFieldChange, edge }: {
  block: CalcBlock
  onChange: (patch: Partial<CalcBlock>) => void
  onEnterBlock: (place: BlockPlace) => void
  onDeleteEmpty: () => void
  onDeleteForward: () => void
  onExitBlock: (side: 'before' | 'after') => void
  onFieldChange: (handle: MathFieldHandle | null) => void
  edge: React.Ref<BlockEdgeHandle>
}) {
  return (
    <LinesBlockField
      lines={block.lignes}
      onChange={lignes => onChange({ lignes })}
      ariaLabel="Calcul"
      onEnterBlock={onEnterBlock}
      onDeleteEmpty={onDeleteEmpty}
      onDeleteForward={onDeleteForward}
      onExitBlock={onExitBlock}
      onFieldChange={onFieldChange}
      ref={edge}
    />
  )
}
```

- [ ] **Step 4: `BlockStack.tsx` — handles de bord, Ctrl+Entrée, sorties, suppression**

1. `editorFor(block, onChange, ctx)` : `ctx` comme dans Interfaces ; `'calcul'` et `'equation'` reçoivent `{ block, index, onChange, ...ctx }` (CalcEditor n'a pas `index`). Texte et Tableau inchangés.
2. Dans `BlockStack`, une table de handles `const edges = useRef(new Map<string, BlockEdgeHandle | null>())`. Pour chaque bloc `i` :
```tsx
const ctx = {
  index: i,
  edge: (h: BlockEdgeHandle | null) => { edges.current.set(block.id, h) },
  // Ctrl/Cmd(+Maj)+Entrée : un bloc juste après, du même type quand il est connu — c'est ce qu'on écrit ensuite.
  onEnterBlock: () => insertAfter(block.id, isKnown(block) ? block.type : 'texte'),
  onExitBlock: (side: 'before' | 'after') => {
    const target = blocks[side === 'before' ? i - 1 : i + 1]
    if (target !== undefined) enterBlock(target.id, side === 'before' ? 'end' : 'start')
  },
  onDeleteEmpty: () => removeAndFocus(i, 'before'),
  onDeleteForward: () => removeAndFocus(i, 'after'),
  onFieldChange: () => {},
}
```
avec
```ts
/** Donne le curseur au bord d'un bloc : son handle s'il en a un (équation, calcul), sinon son premier/dernier champ. */
const enterBlock = (id: string, at: 'start' | 'end') => {
  const edge = edges.current.get(id)
  if (edge) return edge.focusEdge(at)
  const fields = document.querySelectorAll<HTMLElement>(`[data-block-id="${id}"] textarea, [data-block-id="${id}"] input, [data-block-id="${id}"] math-field`)
  fields[at === 'start' ? 0 : fields.length - 1]?.focus()
}
const removeAndFocus = (i: number, side: 'before' | 'after') => {
  const neighbour = blocks[side === 'before' ? i - 1 : i + 1]
  onChange(removeBlock(blocks, blocks[i].id))
  if (neighbour !== undefined) queueMicrotask(() => enterBlock(neighbour.id, side === 'before' ? 'end' : 'start'))
}
```
(`removeBlock` ne retire pas le dernier bloc restant ? vérifier `blocks.ts` : si elle peut vider la pile c'est le comportement actuel du bouton corbeille, ne rien changer.)
3. `onFieldChange` est un no-op ici : la barre de symboles de Maths suit déjà le champ par `onFocus` de `<section>` (`rememberField`). Le garder explicite pour que l'interface partagée soit satisfaite.
4. Supprimer le `onDone` de `editorFor` et le 3e argument de l'appel (`() => insertAfter(block.id, 'calcul')`).

- [ ] **Step 5: Mettre à jour les anciens tests de Maths**

- `EquationEditor.test.tsx`, `EquationEditor.raw.test.tsx` : ils testent l'ancien composant (placeholder « Ce que je fais », bouton `Supprimer l'étape`, `+ Étape`). Réécrire chaque test dont l'intention subsiste (Entrée ajoute une étape, flèches, Retour arrière) sur les libellés partagés `Membre gauche de l'étape N du bloc 1` ; **supprimer** ceux qui testent des boutons/menus retirés (✕, « + Étape », menu clic droit des champs). Ne rien laisser en `it.skip`.
- `ContextMenus.test.tsx` : retirer les cas « clic droit sur un champ d'équation/de calcul » ; garder ceux de carte de bloc et de zone vide.
- `BlockStack.test.tsx` : les blocs `calcul` de test deviennent `{ id, type: 'calcul' }` (le parse crée une ligne) ; adapter toute attente sur `Résultat du calcul`.
- `ExerciseWorkspace.test.tsx` : le test de la barre de symboles qui vise un champ de calcul/équation vise maintenant `Ligne 1 du calcul`/`Membre gauche…`.

- [ ] **Step 6: Lancer le ciblé**

Run: `bun run --filter zachart-maths test -- BlockKeys BlockStack EquationEditor ContextMenus ExerciseWorkspace`
Expected: PASS.

- [ ] **Step 7: Tout vérifier**

Run: `bun run test`, `bun run test:admin`, `bunx tsc --noEmit -p apps/zachart-maths`, `bunx tsc --noEmit -p apps/zachart-mentale`, `bunx tsc --noEmit -p packages/shared`, `cargo test --workspace`
Expected: tout PASS, aucune erreur de type. `apps/zachart-maths/src/boundary.test.ts` PASS (Maths n'importe que des points d'entrée publics).

- [ ] **Step 8: Nettoyer le code mort**

Run: `grep -rn "math/MathField'\|from './eqTones'\|CalcEditor\|FieldContextMenu" apps/zachart-maths/src --include=*.ts --include=*.tsx | grep -v test`
Supprimer `src/math/MathField.tsx` et `edgeMove.ts` seulement si leur dernier importeur (hors tests) a disparu — `FieldContextMenu.tsx` et `ExerciseWorkspace.tsx` importent encore `isMathField`/`MathfieldElement` : si c'est le cas, **garder** `MathField.tsx` et ne supprimer rien. Supprimer `eqTones.ts` s'il n'est plus importé. Relancer `bun run test` après.

- [ ] **Step 9: Vérification manuelle dans l'app**

Run: `bun run --filter zachart-maths dev` puis ouvrir `http://localhost:1450` (MathLive réel, hors jsdom).
Vérifier à la main : (1) un bloc Équation : Entrée ajoute une étape, Ctrl+Entrée un bloc, Retour arrière maintenu dans une étape vide ne mange pas la ligne du dessus ; (2) un bloc Calcul : Entrée = nouvelle ligne, ↑ ↓ entre les lignes et entre les blocs ; (3) aucune option à droite d'un champ ; (4) sans fichier ouvert, la liste des récents apparaît, et un fichier supprimé n'y est plus. Noter ce qui diverge de la spec avant de conclure.

- [ ] **Step 10: Commit**

```bash
git add apps/zachart-maths/src
git commit -m "feat(zachart-maths): equations and calculs on the shared sub-block editor, Ctrl+Enter makes a block"
```
(Avant : `git status` — ne pas ajouter `apps/zachart-maths/src-tauri/Cargo.toml`.)

---

### Task 8: Documentation et graphe

**Files:**
- Modify: `CLAUDE.md` (section `packages/shared` et Zach'Math)

- [ ] **Step 1: Documenter**

Dans `CLAUDE.md`, ajouter au bloc des points d'entrée `@suite/shared/{…,equation}` et une puce après « Tree drag-and-drop » :
« Blocs et sous-blocs (`@suite/shared/equation`) : `MathFieldEditor` (MathLive + repli LaTeX brut), les intentions clavier (`rawFieldKeyDown`, `latchEdgeKey`, `BlockPlace`…), `EquationStepsField` (étapes `{ left, right, operation? }` sans id) et `LinesBlockField` (lignes `{ id, latex }`). Entrée = nouveau sous-bloc, Ctrl/Cmd+Entrée = nouveau bloc (Maj = « dans le groupe », identique dans Maths qui n'a pas de groupes). Mentale garde `content/EquationEditor.tsx`, `fieldIntents.ts` et `MathFieldEditor.tsx` comme façades. »
Dans la section Zach'Math : remplacer « Blocks » pour dire que `calcul` = `{ lignes: { id, latex }[] }` (l'ancien `{ expression, resultat }` est relu comme deux lignes) et que `equation`/`calcul` utilisent l'éditeur partagé via `stepIds.ts`. Ajouter : l'accueil montre les récents (`recentFiles.ts`, clé `zachart-maths:session`).

- [ ] **Step 2: Graphe**

Run: `graphify update .`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: shared sub-block editor and Zach'Math recent files in CLAUDE.md"
```
(Ne committer `graphify-out/` que s'il est déjà suivi par git ; sinon laisser.)
