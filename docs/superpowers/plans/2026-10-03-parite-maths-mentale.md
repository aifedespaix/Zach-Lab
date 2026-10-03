# Parité Zach'Math / Mentale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zach'Math reprend les confort de Mentale (recherche, pied de panneau avec repli, tableau à poignées) via des composants `@suite/shared`, corrige le focus des lignes de calcul et compacte la toolbar.

**Architecture:** Trois briques partagées (`PanelSearch`, `PanelFooter`, `TableGrid`) dans `packages/shared`, purement présentationnelles. Chaque app garde ses données et injecte ce qui lui est propre par props. Mentale adopte les briques pour supprimer son code dupliqué.

**Tech Stack:** React 19, TypeScript, Bun workspaces, Vitest + Testing Library, Orama (`@suite/shared/search`), lucide-react, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-03-parite-maths-mentale-design.md`

## Global Constraints

- `shared` n'importe JAMAIS depuis une app (`@/…`, `@app`, chemin relatif sortant de `packages/shared/src`) ; imports **relatifs** à l'intérieur de `shared`, jamais `@suite/shared/…` (`packages/shared/src/boundary.test.ts`).
- Les apps n'importent que les points d'entrée publics `@suite/shared/{ui,theme,update,shell,commands,settings,search,math,tree,equation}`.
- Rien sous `apps/zachart-mentale/admin/` n'importe `@tauri-apps/*`, ni `@suite/shared/{commands,settings,shell,update}`.
- Commandes depuis la racine : `bun run test`, `bunx tsc --noEmit -p apps/<app>` ou `-p packages/shared`, `bun run test:admin`.
- Jamais `git add -A` : toujours des chemins explicites. Ne pas committer `apps/zachart-maths/src-tauri/Cargo.toml` (modification préexistante de l'utilisateur).
- Fin de chaque message de commit : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Textes d'interface en français.

## Review Focus

- Recherche : requête vide, requête sans résultat, accents (`ete` trouve `Été`) — tâche 5.
- Recherche : un chapitre dont seul un exercice correspond reste visible et déplié, sans modifier l'état replié réel — tâche 5.
- Tableau : une seule ligne ou colonne restante → pas de corbeille — tâche 6.
- Tableau : cliquer sur la corbeille (qui fait perdre le focus à la cellule) ne la fait pas disparaître avant le clic — tâche 6.
- Panneau replié : le raccourci doit toujours pouvoir le déplier — tâche 2 (déjà couvert par `CollapsiblePanel.test.tsx`, ne pas régresser).
- Calcul : Entrée sur la dernière ligne ET sur une ligne suivie d'une ligne vide donnent le focus à la bonne ligne — tâche 8.

---

## File Structure

Créés :
- `packages/shared/src/shell/PanelSearch.tsx` (+ `.test.tsx`) — champ de recherche pleine largeur.
- `packages/shared/src/shell/PanelFooter.tsx` (+ `.test.tsx`) — barre d'actions en bas de panneau.
- `packages/shared/src/equation/TableGrid.tsx` (+ `.test.tsx`) — grille de tableau à poignées.
- `apps/zachart-maths/src/exercises/treeSearch.ts` (+ `.test.ts`) — index Orama et filtre de l'arbre.

Modifiés :
- `packages/shared/src/theme/theme.css` — styles `.panel-search`, `.table-handle`.
- `packages/shared/src/shell/CollapsiblePanel.tsx`, `shell/index.ts`, `equation/index.ts`.
- `apps/zachart-mentale/src/components/sidebar/FileSidebar.tsx`, `src/content/BlockEditor.tsx`, `src/index.css`.
- `apps/zachart-maths/src/App.tsx`, `commands.ts`, `exercises/ExerciseTree.tsx`, `exercises/BlockStack.tsx`, `cours/CoursePanel.tsx`, `exercises/Toolbar.tsx`.
- `packages/shared/src/equation/LinesBlockField.tsx` (focus).
- `CLAUDE.md` (section `shared`).

---

### Task 1: `PanelSearch`

**Files:**
- Create: `packages/shared/src/shell/PanelSearch.tsx`, `packages/shared/src/shell/PanelSearch.test.tsx`
- Modify: `packages/shared/src/shell/index.ts`, `packages/shared/src/theme/theme.css`

**Interfaces:**
- Produces: `PanelSearch({ value, onChange, placeholder?, ariaLabel, focusRequest?, trailing? })` exportée par `@suite/shared/shell`.
  - `focusRequest?: number` : à chaque changement (> 0) le champ prend le focus et sélectionne son texte.
  - `trailing?: ReactNode` : un contrôle posé à droite du champ (le filtre de type de Mentale).

- [ ] **Step 1: Écrire le test qui échoue**

```tsx
// packages/shared/src/shell/PanelSearch.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { PanelSearch } from './PanelSearch'

function Harness({ focusRequest = 0 }: { focusRequest?: number }) {
  const [value, setValue] = useState('')
  return <PanelSearch value={value} onChange={setValue} ariaLabel="Rechercher un fichier" focusRequest={focusRequest} />
}

describe('PanelSearch', () => {
  it('remonte la saisie', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Rechercher un fichier' }), 'frac')
    expect(screen.getByRole('textbox')).toHaveValue('frac')
  })

  it("n'affiche le bouton d'effacement que lorsque le champ n'est pas vide, et il vide", async () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Effacer la recherche' })).toBeNull()
    await userEvent.type(screen.getByRole('textbox'), 'a')
    await userEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }))
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('Échap vide le champ et le quitte', async () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'abc{Escape}')
    expect(input).toHaveValue('')
    expect(input).not.toHaveFocus()
  })

  it('prend le focus quand focusRequest change', () => {
    const { rerender } = render(<Harness focusRequest={0} />)
    expect(screen.getByRole('textbox')).not.toHaveFocus()
    rerender(<Harness focusRequest={1} />)
    expect(screen.getByRole('textbox')).toHaveFocus()
  })
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `bun run --filter @suite/shared test -- PanelSearch`
Expected: FAIL (`Cannot find module './PanelSearch'`).

- [ ] **Step 3: Implémenter**

```tsx
// packages/shared/src/shell/PanelSearch.tsx
import { useEffect, useRef, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '../ui'

interface PanelSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** The field's accessible name, e.g. « Rechercher un exercice ». */
  ariaLabel: string
  /** Bump it (> 0) to put the caret in the field and select its text — a shortcut's job. */
  focusRequest?: number
  /** A control sitting to the right of the field, e.g. a type filter. */
  trailing?: ReactNode
}

/**
 * The search field at the top of a side panel, full width.
 *
 * Controlled: what the field holds is a VIEW over the panel's content and the app decides what
 * that means. Escape clears and hands the keyboard back without a second gesture.
 */
export function PanelSearch({ value, onChange, placeholder = 'Rechercher…', ariaLabel, focusRequest = 0, trailing }: PanelSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusRequest === 0) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusRequest])

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <Search size={13} style={{ position: 'absolute', left: 7, color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
        <input
          ref={inputRef}
          className="panel-search"
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Escape') return
            onChange('')
            event.currentTarget.blur()
          }}
          style={{ paddingLeft: 24, paddingRight: value === '' ? 8 : 26 }}
        />
        {value !== '' && (
          <Button variant="ghost" size="icon-sm" aria-label="Effacer la recherche" onClick={() => onChange('')} style={{ position: 'absolute', right: 2 }}>
            <X size={13} />
          </Button>
        )}
      </div>
      {trailing}
    </div>
  )
}
```

Ajouter à `packages/shared/src/theme/theme.css` (à la fin) — copie du `.sidebar-search` de Mentale :

```css
/* The search field of a side panel (`PanelSearch`). */
.panel-search {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--input);
  border-radius: 6px;
  background: var(--background);
  color: var(--foreground);
  font-size: 12px;
  font-family: inherit;
  outline: none;
}
.panel-search::placeholder {
  color: var(--muted-foreground);
}
.panel-search:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--ring), transparent 75%);
}
```

Ajouter à `packages/shared/src/shell/index.ts` : `export * from './PanelSearch'`.

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `bun run --filter @suite/shared test -- PanelSearch`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/shell/PanelSearch.tsx packages/shared/src/shell/PanelSearch.test.tsx packages/shared/src/shell/index.ts packages/shared/src/theme/theme.css
git commit -m "feat(shared): PanelSearch, the full-width search field of a side panel

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `PanelFooter` et pied de `CollapsiblePanel`

**Files:**
- Create: `packages/shared/src/shell/PanelFooter.tsx`, `packages/shared/src/shell/PanelFooter.test.tsx`
- Modify: `packages/shared/src/shell/CollapsiblePanel.tsx`, `packages/shared/src/shell/CollapsiblePanel.test.tsx`, `packages/shared/src/shell/index.ts`

**Interfaces:**
- Produces:
  - `PanelFooter({ children })` : barre `role="toolbar"` en bas, bordure haute, items qui passent à la ligne.
  - `PanelFooterSeparator()` : filet vertical entre deux groupes.
  - `CollapsiblePanel` gagne `footer?: ReactNode` : les actions de l'app, affichées AVANT le bouton de repli que le composant ajoute lui-même, à droite (`PanelLeftClose` / `PanelRightClose` selon `side`, libellé `foldLabel`).

- [ ] **Step 1: Tests qui échouent**

```tsx
// packages/shared/src/shell/PanelFooter.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PanelFooter, PanelFooterSeparator } from './PanelFooter'

describe('PanelFooter', () => {
  it('est une barre d’outils nommée qui contient ses actions', () => {
    render(
      <PanelFooter label="Actions de l’arborescence">
        <button>Un</button>
        <PanelFooterSeparator />
        <button>Deux</button>
      </PanelFooter>,
    )
    const bar = screen.getByRole('toolbar', { name: 'Actions de l’arborescence' })
    expect(bar).toContainElement(screen.getByRole('button', { name: 'Un' }))
    expect(bar).toContainElement(screen.getByRole('button', { name: 'Deux' }))
  })
})
```

Ajouter dans `CollapsiblePanel.test.tsx`, dans le `describe('CollapsiblePanel', …)` (le composant `Panel` de test reçoit une prop `footer?: ReactNode` passée à `CollapsiblePanel`) :

```tsx
  it('déplié : le bouton de repli est dans le pied, après les actions de l’app', () => {
    render(<Panel footer={<button>Action</button>} />)
    const bar = screen.getByRole('toolbar')
    const buttons = within(bar).getAllByRole('button')
    expect(buttons.map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Action', 'Replier le panneau test'])
  })
```

(importer `within` depuis `@testing-library/react`, et changer la signature : `function Panel({ side = 'left', footer }: { side?: 'left' | 'right'; footer?: ReactNode })`.)

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `bun run --filter @suite/shared test -- PanelFooter CollapsiblePanel`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```tsx
// packages/shared/src/shell/PanelFooter.tsx
import type { ReactNode } from 'react'

/** A hairline between two groups of actions in a `PanelFooter`. */
export function PanelFooterSeparator() {
  return <span aria-hidden style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
}

/**
 * The action bar at the bottom of a side panel: « what the panel shows », then the panel's own
 * controls, each group separated by `PanelFooterSeparator`. Items wrap rather than clip when the
 * panel is at its minimum width.
 */
export function PanelFooter({ label = 'Actions du panneau', children }: { label?: string; children: ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap',
        padding: '6px 8px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}
```

Dans `CollapsiblePanel.tsx` : importer `PanelLeftClose, PanelRightClose` de `lucide-react`, `CommandButton` de `../commands` (déjà `useCommand`), `PanelFooter, PanelFooterSeparator` de `./PanelFooter` ; ajouter `footer?: ReactNode` à l'interface et aux paramètres ; remplacer le `return` final par :

```tsx
  return (
    <ResizablePanel side={side} label={label} resizeLabel={resizeLabel} storage={storage}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>{children}</div>
        <PanelFooter>
          {footer}
          {footer !== undefined && <PanelFooterSeparator />}
          <span style={{ marginLeft: 'auto' }} aria-hidden />
          <CommandButton
            command={toggleCommand}
            icon={side === 'left' ? PanelLeftClose : PanelRightClose}
            label={foldLabel}
            variant="ghost"
            size="icon-sm"
          />
        </PanelFooter>
      </div>
    </ResizablePanel>
  )
```

Mettre à jour le commentaire de doc : « The fold button lives in the panel's footer (after the app's `footer` actions); the folded rail carries the unfold one. » Ajouter à `shell/index.ts` : `export * from './PanelFooter'`.

- [ ] **Step 4: Lancer, vérifier que tout `shell` passe**

Run: `bun run --filter @suite/shared test -- shell`
Expected: PASS (les tests existants de `CollapsiblePanel` doivent rester verts).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/shell
git commit -m "feat(shared): PanelFooter, and CollapsiblePanel folds from its footer

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Mentale adopte `PanelSearch` et `PanelFooter`

**Files:**
- Modify: `apps/zachart-mentale/src/components/sidebar/FileSidebar.tsx` (lignes ~498-545 pour la recherche, ~707-780 pour le pied)

**Interfaces:** Consumes `PanelSearch`, `PanelFooter` (tâches 1-2). Aucun changement de comportement.

- [ ] **Step 1: Filet de sécurité** — Run: `bun run --filter zachart-mentale test -- FileSidebar` ; noter qu'il passe (référence).

- [ ] **Step 2: Remplacer la recherche.** Importer `PanelSearch, PanelFooter` depuis `@suite/shared/shell` (déjà importé pour `usePanelCollapsed`). Dans l'en-tête, remplacer le `<div style={{ display: 'flex', gap: 6, … }}>` contenant le champ et le `<select>` par :

```tsx
<PanelSearch
  value={search}
  onChange={setSearch}
  ariaLabel="Rechercher une carte ou un dossier"
  focusRequest={searchFocusRequest}
  trailing={
    <select className="sidebar-search sidebar-type-filter" aria-label="Filtrer par type" title="Filtrer par type" value={typeFilter} onChange={event => setTypeFilter(event.target.value as MapType | 'all')}>
      <option value="all">Tous types</option>
      {MAP_TYPES.map(type => (<option key={type} value={type}>{MAP_TYPE_LABELS[type]}</option>))}
      <option value="default">{MAP_TYPE_LABELS.default}</option>
    </select>
  }
/>
```

Supprimer `searchInputRef`, l'`useEffect` qui focalisait (lignes ~191-194) et les imports devenus inutiles (`Search`, `X` si plus utilisé : `X` l'est encore dans les bandeaux). Le raccourci qui faisait `setSearchFocusRequest(r => r + 1)` reste tel quel.

- [ ] **Step 3: Remplacer l'enveloppe du pied.** Le `<div style={{ display:'flex', … borderTop … }}>` de la barre d'actions devient `<PanelFooter label="Actions de la barre latérale">…mêmes enfants…</PanelFooter>` ; `<span className="toolbar-separator" aria-hidden />` est conservé tel quel.

- [ ] **Step 4: Vérifier** — Run: `bun run --filter zachart-mentale test -- FileSidebar` puis `bunx tsc --noEmit -p apps/zachart-mentale`. Expected: PASS. Si un test cherchait `.sidebar-search` par classe, le faire chercher par rôle/label.

- [ ] **Step 5: Commit**

```bash
git add apps/zachart-mentale/src/components/sidebar/FileSidebar.tsx
git commit -m "refactor(mentale): the sidebar search and action bar use the shared PanelSearch/PanelFooter

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Panneaux de Maths (gauche et droite)

**Files:**
- Modify: `apps/zachart-maths/src/commands.ts`, `exercises/ExerciseTree.tsx`, `cours/CoursePanel.tsx`, `App.tsx`
- Test: `apps/zachart-maths/src/exercises/ExerciseTree.test.tsx`, `ExerciseWorkspace.test.tsx` (adapter)

**Interfaces:**
- Produces: commandes `tree.newChapter` (« Nouveau chapitre ») et `tree.toggleAll` (« Tout replier / déplier »), enregistrées par `ExerciseTree` via `useCommand` ; le pied de gauche est rendu par `App` avec `CommandButton`.

- [ ] **Step 1: Test qui échoue** (dans `ExerciseTree.test.tsx`, avec le rendu déjà utilisé par ce fichier) :

```tsx
it('« tree.toggleAll » replie puis déplie tous les chapitres', async () => {
  // rendu habituel du fichier avec un chapitre contenant « Exo 1 »
  expect(screen.getByText('Exo 1')).toBeInTheDocument()
  await act(() => runCommand('tree.toggleAll'))
  expect(screen.queryByText('Exo 1')).toBeNull()
  await act(() => runCommand('tree.toggleAll'))
  expect(screen.getByText('Exo 1')).toBeInTheDocument()
})

it('« tree.newChapter » ouvre le champ de nom', async () => {
  await act(() => runCommand('tree.newChapter'))
  expect(screen.getByLabelText('Nom du nouveau chapitre')).toBeInTheDocument()
})
```

- [ ] **Step 2: Lancer** — `bun run --filter zachart-maths test -- ExerciseTree` → FAIL (commande inconnue).

- [ ] **Step 3: Commandes.** Dans `commands.ts`, ajouter à `COMMANDS` (catégorie `tree` ajoutée aux `categories` : `{ id: 'tree', label: 'Exercices' }`) :

```ts
  {
    id: 'tree.newChapter',
    label: 'Nouveau chapitre',
    description: 'Crée un chapitre (un dossier) dans tes exercices.',
    category: 'tree',
    defaultBinding: null,
  },
  {
    id: 'tree.toggleAll',
    label: 'Tout replier ou déplier',
    description: 'Replie tous les chapitres, ou les déplie si tout est déjà replié.',
    category: 'tree',
    defaultBinding: null,
  },
```

- [ ] **Step 4: `ExerciseTree`.**
  1. Supprimer du `<div>` d'en-tête les deux boutons (`Nouveau chapitre` et le `CommandButton view.toggleTree`) : l'en-tête ne garde que `<strong>Mes exercices</strong>` ; retirer `FolderPlus`/`PanelLeftClose` des imports s'ils ne servent plus (`PanelLeftClose` sert encore au menu contextuel ligne ~257).
  2. Importer `useCommand` depuis `@suite/shared/commands` et `PanelSearch` depuis `@suite/shared/shell`. Enregistrer, avant le `if (!loaded)` :

```tsx
  useCommand('tree.newChapter', () => setNaming({ kind: 'new-chapter' }))
  useCommand('tree.toggleAll', () =>
    setFolded(prev => (prev.size >= tree.length ? new Set() : new Set(tree.map(c => c.name)))),
  )
```

  3. Sous le `<strong>`, ajouter la recherche (état `search` + tâche 5 branche le filtre) :

```tsx
      <div style={{ padding: '0 12px 8px' }}>
        <PanelSearch value={search} onChange={setSearch} ariaLabel="Rechercher un exercice" placeholder="Rechercher un exercice…" />
      </div>
```

   avec `const [search, setSearch] = useState('')` près des autres états.

- [ ] **Step 5: `CoursePanel`.** Dans `CoursesSection` : retirer le `CommandButton view.toggleCourses` de l'en-tête (et `PanelRightClose` de l'import si inutilisé — il reste utilisé par le menu contextuel ligne ~151). Remplacer le bouton « Chercher un cours » par un `PanelSearch` pleine largeur ouvrant la recherche existante : un champ en lecture seule déclenche `setSearchOpen(true)` au focus :

```tsx
<PanelSearch value="" onChange={() => {}} ariaLabel="Chercher un cours" placeholder="Chercher un cours…" focusRequest={0} />
```

  **Décision de simplicité :** `CourseSearchDialog` existe déjà (ouvert par `cours.search`) ; on garde le bouton « Chercher un cours » tel quel en pleine largeur (`style={{ width: '100%' }}`, sur sa propre ligne sous le titre) plutôt que de dupliquer un champ qui ne ferait que rouvrir le dialogue. L'en-tête devient : ligne 1 titre + bouton Notes ; ligne 2 bouton pleine largeur.

- [ ] **Step 6: `App.tsx`.** Dans `<CollapsiblePanel side="left" …>` ajouter :

```tsx
footer={
  <>
    <CommandButton command="tree.newChapter" icon={FolderPlus} variant="ghost" size="icon-sm" />
    <CommandButton command="tree.toggleAll" icon={ChevronsDownUp} variant="ghost" size="icon-sm" />
  </>
}
```

  (importer `FolderPlus, ChevronsDownUp` de `lucide-react`.) Le panneau droit n'a pas de `footer` : son pied ne contient que le repli.

- [ ] **Step 7: Vérifier** — `bun run --filter zachart-maths test` et `bunx tsc --noEmit -p apps/zachart-maths`. Adapter dans les tests existants les requêtes sur « Replier l'arborescence » / « Replier le panneau des cours » (toujours présentes, désormais dans `role="toolbar"`). Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/zachart-maths/src/commands.ts apps/zachart-maths/src/exercises apps/zachart-maths/src/cours/CoursePanel.tsx apps/zachart-maths/src/App.tsx
git commit -m "feat(zachart-maths): panel actions and fold button move to the footer, like Mentale

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Recherche de fichiers dans Maths

**Files:**
- Create: `apps/zachart-maths/src/exercises/treeSearch.ts`, `treeSearch.test.ts`
- Modify: `apps/zachart-maths/src/exercises/ExerciseTree.tsx`

**Interfaces:**
- Consumes: `createSearchIndex(fields)` de `@suite/shared/search` (`add`, `search(term, { limit })` → `{ id, score }[]`) ; `ChapterNode { name, exercises: ExerciseEntry[] }` avec `ExerciseEntry { path, titre }`.
- Produces: `filterChapters(tree: ChapterNode[], query: string): { chapters: ChapterNode[]; forcedOpen: ReadonlySet<string> }`.
  Requête vide → l'arbre inchangé, `forcedOpen` vide. Un chapitre dont le NOM correspond garde tous ses exercices.

**Périmètre honnête :** la recherche porte sur les titres d'exercices et les noms de chapitres, pas sur le contenu des fichiers (il faudrait lire tous les fichiers de l'élève à chaque changement). Le contenu pourra venir plus tard avec un index persistant.

- [ ] **Step 1: Test qui échoue**

```ts
// treeSearch.test.ts
import { describe, expect, it } from 'vitest'
import { filterChapters } from './treeSearch'
import type { ChapterNode } from './types'

const tree: ChapterNode[] = [
  { name: 'Fractions', exercises: [{ path: 'Fractions/a.json', titre: 'Additionner' }, { path: 'Fractions/b.json', titre: 'Simplifier' }] },
  { name: 'Géométrie', exercises: [{ path: 'Géométrie/c.json', titre: 'Théorème de Pythagore' }] },
]

describe('filterChapters', () => {
  it('requête vide : l’arbre tel quel', () => {
    const r = filterChapters(tree, '  ')
    expect(r.chapters).toEqual(tree)
    expect(r.forcedOpen.size).toBe(0)
  })

  it('ne garde que les exercices qui correspondent, et ouvre leur chapitre', () => {
    const r = filterChapters(tree, 'pythagore')
    expect(r.chapters).toEqual([{ name: 'Géométrie', exercises: [tree[1].exercises[0]] }])
    expect([...r.forcedOpen]).toEqual(['Géométrie'])
  })

  it('un chapitre qui correspond par son nom garde tous ses exercices', () => {
    const r = filterChapters(tree, 'fractions')
    expect(r.chapters[0].exercises).toHaveLength(2)
  })

  it('tolère les accents', () => {
    expect(filterChapters(tree, 'geometrie').chapters.map(c => c.name)).toEqual(['Géométrie'])
  })

  it('aucun résultat : liste vide', () => {
    expect(filterChapters(tree, 'zzzzzz').chapters).toEqual([])
  })
})
```

- [ ] **Step 2: Lancer** — `bun run --filter zachart-maths test -- treeSearch` → FAIL.

- [ ] **Step 3: Implémenter**

```ts
// treeSearch.ts
import { createSearchIndex } from '@suite/shared/search'
import type { ChapterNode } from './types'

export interface FilteredTree {
  chapters: ChapterNode[]
  /** Chapters the search wants open to show a match — a view; the real folded state is untouched. */
  forcedOpen: ReadonlySet<string>
}

/**
 * The tree as a search sees it: a VIEW, never a mutation. A chapter whose NAME matches keeps all
 * its exercises; otherwise only the exercises whose title matches stay, and a chapter with none
 * disappears. The index is rebuilt per call — a student's library is a few hundred titles.
 */
export function filterChapters(tree: ChapterNode[], query: string): FilteredTree {
  const term = query.trim()
  if (term === '') return { chapters: tree, forcedOpen: new Set() }

  const index = createSearchIndex(['titre', 'chapitre'])
  for (const chapter of tree) {
    index.add({ id: `c:${chapter.name}`, chapitre: chapter.name })
    for (const exo of chapter.exercises) index.add({ id: `e:${exo.path}`, titre: exo.titre, chapitre: '' })
  }
  const hits = new Set(index.search(term, { limit: 200 }).map(hit => hit.id))

  const chapters: ChapterNode[] = []
  const forcedOpen = new Set<string>()
  for (const chapter of tree) {
    if (hits.has(`c:${chapter.name}`)) {
      chapters.push(chapter)
      forcedOpen.add(chapter.name)
      continue
    }
    const exercises = chapter.exercises.filter(exo => hits.has(`e:${exo.path}`))
    if (exercises.length === 0) continue
    chapters.push({ ...chapter, exercises })
    forcedOpen.add(chapter.name)
  }
  return { chapters, forcedOpen }
}
```

- [ ] **Step 4: Lancer** → PASS.

- [ ] **Step 5: Brancher dans `ExerciseTree`.** Importer `filterChapters`. Après les `useCommand` : `const view = useMemo(() => filterChapters(tree, search), [tree, search])`. Dans le rendu : `tree.map(` → `view.chapters.map(` ; `const open = !folded.has(chapter.name)` → `const open = view.forcedOpen.has(chapter.name) || !folded.has(chapter.name)` ; le message « Aucun chapitre… » ne s'affiche que si `tree.length === 0` ; ajouter, quand `search.trim() !== '' && view.chapters.length === 0` : `<p role="status" style={{ padding: '4px 12px', fontSize: 13, color: 'var(--muted-foreground)' }}>Aucun résultat pour « {search.trim()} ».</p>`. Importer `useMemo`.

- [ ] **Step 6: Test d'intégration** (dans `ExerciseTree.test.tsx`) : taper `pyth` dans « Rechercher un exercice » montre « Théorème de Pythagore » et masque les autres ; l'effacer rétablit l'arbre.

- [ ] **Step 7: Vérifier + commit**

Run: `bun run --filter zachart-maths test` et `bunx tsc --noEmit -p apps/zachart-maths` → PASS.

```bash
git add apps/zachart-maths/src/exercises/treeSearch.ts apps/zachart-maths/src/exercises/treeSearch.test.ts apps/zachart-maths/src/exercises/ExerciseTree.tsx apps/zachart-maths/src/exercises/ExerciseTree.test.tsx
git commit -m "feat(zachart-maths): search the exercise tree by chapter and title

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `TableGrid` partagé

**Files:**
- Create: `packages/shared/src/equation/TableGrid.tsx`, `TableGrid.test.tsx`
- Modify: `packages/shared/src/equation/index.ts`, `packages/shared/src/theme/theme.css`

**Interfaces:**
- Produces:

```ts
interface TableGridProps {
  /** Identifies the table in accessible names (« …du tableau 2 »). */
  tableLabel: string
  rowCount: number
  columnCount: number
  /** An optional header row, drawn above the body: `renderHeader(c)` returns the cell's content. */
  renderHeader?: (column: number) => ReactNode
  /** Every cell's content; the grid wraps it in a `data-cell="r,c"` element. */
  renderCell: (row: number, column: number) => ReactNode
  /** `after` is the index the new line goes after; `-1` = before the first. */
  onAddRow: (after: number) => void
  onAddColumn: (after: number) => void
  onRemoveRow: (row: number) => void
  onRemoveColumn: (column: number) => void
}
```

  Le header utilise `data-cell="-1,c"`. Libellés accessibles identiques à Mentale : « Insérer une colonne après la colonne N du tableau T », « Insérer une colonne avant la colonne 1 du tableau T », « Supprimer la colonne N du tableau T », idem lignes. (`tableLabel` = « du tableau 2 » est construit par l'appelant en passant `tableLabel="2"`.)

- [ ] **Step 1: Tests qui échouent**

```tsx
// TableGrid.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TableGrid } from './TableGrid'

function setup(over: Partial<React.ComponentProps<typeof TableGrid>> = {}) {
  const handlers = { onAddRow: vi.fn(), onAddColumn: vi.fn(), onRemoveRow: vi.fn(), onRemoveColumn: vi.fn() }
  render(
    <TableGrid
      tableLabel="1"
      rowCount={2}
      columnCount={2}
      renderCell={(r, c) => <input aria-label={`cellule ${r},${c}`} />}
      {...handlers}
      {...over}
    />,
  )
  return handlers
}

describe('TableGrid', () => {
  it('rend toutes les cellules', () => {
    setup()
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
  })

  it('« + » après la colonne 1 insère après l’index 0 ; « avant la colonne 1 » insère après -1', async () => {
    const h = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Insérer une colonne après la colonne 1 du tableau 1' }))
    expect(h.onAddColumn).toHaveBeenLastCalledWith(0)
    await userEvent.click(screen.getByRole('button', { name: 'Insérer une colonne avant la colonne 1 du tableau 1' }))
    expect(h.onAddColumn).toHaveBeenLastCalledWith(-1)
  })

  it('« + » de ligne', async () => {
    const h = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Insérer une ligne après la ligne 2 du tableau 1' }))
    expect(h.onAddRow).toHaveBeenLastCalledWith(1)
  })

  it('la corbeille de colonne supprime la colonne, même après un clic qui retire le focus de la cellule', async () => {
    const h = setup()
    await userEvent.click(screen.getByLabelText('cellule 0,1'))
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la colonne 2 du tableau 1' }))
    expect(h.onRemoveColumn).toHaveBeenCalledWith(1)
  })

  it('une seule colonne / ligne : pas de corbeille', () => {
    setup({ rowCount: 1, columnCount: 1 })
    expect(screen.queryByRole('button', { name: /Supprimer/ })).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer** → FAIL.

- [ ] **Step 3: Implémenter.** Créer `TableGrid.tsx` en **déplaçant** la logique de `TableField`/`TableHandle`/`revealedTrash`/constantes (`HANDLE_ROW`, `TABLE_GRID_GAP`, `HANDLE_SIZE`, `HANDLE_STRADDLE`, `HANDLE_BUTTON`, `BARE_HANDLE`) depuis `apps/zachart-mentale/src/content/BlockEditor.tsx` (lignes 2736-3065 environ), avec ces seuls changements :
  - plus aucune référence à `block`/`TableBlock`/`CardBlock`/`withColumns`/`FIELD_STYLE` ; les nombres viennent des props ; `index + 1` devient `tableLabel` ;
  - `onChange(addTableColumn(block, i))` → `onAddColumn(i)` ; `removeTableColumn` → `onRemoveColumn(i)` ; `addTableRow` → `onAddRow(i)` ; `removeTableRow` → `onRemoveRow(i)` ;
  - l'en-tête est rendu si `renderHeader` est fourni : chaque cellule dans `<div data-cell={`-1,${c}`}>` ; les cellules du corps dans `<div data-cell={`${r},${c}`}>` ;
  - la ligne de corps reprend l'agencement de `TableRow` (gouttière de 52 px : « + » avant/après la ligne, corbeille de ligne révélée si `active?.row === r` et `rowCount > 1`) — lire `TableRow` (BlockEditor.tsx ~3066-3160) et le recopier à l'identique avec les mêmes changements ;
  - `Hint` (tooltip) → `Tooltip` de `../ui` si `Hint` est propre à Mentale (sinon `title={label}`) ;
  - conserver les deux états `hovered` et `focused` séparés et le commentaire qui explique pourquoi.

  Déplacer le bloc CSS `.table-handle` (+ media query) de `apps/zachart-mentale/src/index.css` (lignes ~1043-1070) vers la fin de `theme.css`. Ajouter `export * from './TableGrid'` à `equation/index.ts`.

- [ ] **Step 4: Lancer** — `bun run --filter @suite/shared test -- TableGrid` → PASS. Puis `bun run --filter @suite/shared test` (boundary inclus) → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/equation/TableGrid.tsx packages/shared/src/equation/TableGrid.test.tsx packages/shared/src/equation/index.ts packages/shared/src/theme/theme.css apps/zachart-mentale/src/index.css
git commit -m "feat(shared): TableGrid, the table with + handles on every boundary

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Mentale et Maths utilisent `TableGrid`

**Files:**
- Modify: `apps/zachart-mentale/src/content/BlockEditor.tsx`, `apps/zachart-maths/src/exercises/BlockStack.tsx`
- Test: `apps/zachart-maths/src/exercises/BlockStack.test.tsx`

- [ ] **Step 1 (Maths): test qui échoue** dans `BlockStack.test.tsx` — un bloc `tableau` 2×2 : cliquer « Insérer une colonne après la colonne 1 du tableau 1 » donne 3 colonnes ; plus de bouton « Ajouter une ligne » ; « Supprimer la colonne 2 du tableau 1 » ramène à 1 colonne. (Reprendre le helper de rendu du fichier.)

- [ ] **Step 2: Lancer** → FAIL.

- [ ] **Step 3: Étendre `blocks.ts` (Maths)** : `addRow`/`addColumn` prennent un `after?: number` (défaut : à la fin, comportement actuel) et insèrent à `after + 1`. Compléter `blocks.test.ts` : `addColumn([['a','b']], 0)` → `[['a','','b']]` ; `addRow([['a'],['b']], -1)` → `[[''],['a'],['b']]`. Respecter `canGrow` (déjà dans ces fonctions).

- [ ] **Step 4: `TableEditor` (Maths)** devient :

```tsx
function TableEditor({ block, onChange, index }: { block: TableBlock; onChange: (patch: Partial<TableBlock>) => void; index: number }) {
  const cells = block.cellules
  const set = (next: string[][]) => onChange({ cellules: next })
  return (
    <div style={{ overflowX: 'auto' }}>
      <TableGrid
        tableLabel={String(index + 1)}
        rowCount={cells.length}
        columnCount={cells[0].length}
        renderCell={(r, c) => (
          <FieldContextMenu kind="text">
            <input
              aria-label={`Ligne ${r + 1}, colonne ${c + 1}`}
              value={cells[r][c]}
              onChange={e => set(setCell(cells, r, c, e.target.value))}
              className="w-full bg-background px-2 py-1 text-sm"
              style={{ border: '1px solid var(--border)' }}
            />
          </FieldContextMenu>
        )}
        onAddRow={after => set(addRow(cells, after))}
        onAddColumn={after => set(addColumn(cells, after))}
        onRemoveRow={row => set(removeRow(cells, row))}
        onRemoveColumn={column => set(removeColumn(cells, column))}
      />
    </div>
  )
}
```

  Importer `TableGrid` de `@suite/shared/equation` ; retirer `Minus, Plus`, `Button` s'ils ne servent plus ; passer `index` depuis `editorFor` (ajouter le paramètre et propager l'indice du bloc dans la pile — le numéro du tableau est son rang parmi les blocs `tableau` de la zone, ou simplement le rang du bloc : utiliser le rang du bloc).

- [ ] **Step 5: Mentale.** Dans `BlockEditor.tsx`, `TableField` devient un adaptateur : `TableGrid` avec `rowCount={block.rows.length}`, `columnCount`, `renderHeader` (l'`<input>` d'en-tête existant), `renderCell` (le contenu actuel de `TableCellField`), et `onAddRow={after => onChange(addTableRow(block, after))}` etc. Supprimer de `BlockEditor.tsx` les constantes et fonctions déplacées (`TableHandle`, `revealedTrash`, `HANDLE_*`, `TABLE_GRID_GAP`, `CELL_BUTTON` si orphelin, `TableRow` si entièrement absorbé). Garder `addTableRow`… (données).

- [ ] **Step 6: Vérifier**

Run: `bun run test` (tout), `bunx tsc --noEmit -p apps/zachart-mentale`, `-p apps/zachart-maths`, `-p packages/shared`, `bun run test:admin`.
Expected: PASS. Les tests Mentale sur les poignées (`Insérer une colonne après…`) gardent les mêmes libellés.

- [ ] **Step 7: Commit**

```bash
git add apps/zachart-mentale/src/content/BlockEditor.tsx apps/zachart-maths/src/exercises/BlockStack.tsx apps/zachart-maths/src/exercises/BlockStack.test.tsx apps/zachart-maths/src/exercises/blocks.ts apps/zachart-maths/src/exercises/blocks.test.ts
git commit -m "feat: both apps edit tables on the shared TableGrid (+ on every boundary)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Focus de la nouvelle ligne de calcul

**Files:**
- Modify: `packages/shared/src/equation/LinesBlockField.tsx`
- Test: `packages/shared/src/equation/LinesBlockField.test.tsx`, `apps/zachart-maths/src/exercises/BlockStack.test.tsx`

- [ ] **Step 1: Test qui échoue** (`LinesBlockField.test.tsx`, avec le harnais du fichier) : une ligne remplie, focus dedans, Entrée → `onChange` reçoit 2 lignes ; après re-rendu avec ces lignes, le champ de la 2ᵉ ligne a le focus (`document.activeElement` est dans le 2ᵉ `math-field` / textarea brut du mode repli de test). Second cas : Entrée sur une ligne suivie d'une ligne vide → focus sur la ligne vide (comportement existant, à ne pas casser).

- [ ] **Step 2: Lancer** — si le test passe dans jsdom, la cause est propre au vrai MathLive (handle monté de façon asynchrone) : **ne pas deviner**, continuer au Step 3 en reproduisant dans l'app (`bun run --filter zachart-maths dev`, tester Entrée dans un calcul) et lire `MathFieldEditor.tsx` (méthodes `focusStart`/`focusEnd`, moment où le handle est enregistré).

- [ ] **Step 3: Diagnostiquer** avec `superpowers:systematic-debugging` : poser un `console.log` dans l'`useEffect` de `LinesBlockField` (valeur de `pending.current` et de `handles.current.get(id)`) pour vérifier l'hypothèse « le handle n'existe pas encore à l'exécution de l'effet ». Résultat attendu à noter dans le commit : cause confirmée.

- [ ] **Step 4: Corriger à la cause.** Si le handle est absent à l'effet : ne plus vider `pending.current` tant que le handle n'est pas là, et réessayer à la prochaine frame (`requestAnimationFrame`) quelques fois (borne : 10 essais), ou faire enregistrer `MathFieldEditor` un callback `onReady` qui exécute le focus en attente. Garder la correction minimale et dans `shared`. Supprimer le `console.log`.

- [ ] **Step 5: Lancer** les tests du Step 1 → PASS ; `bun run test` → PASS ; vérification manuelle dans l'app (Entrée dans un calcul, dans une équation) → le curseur est dans la nouvelle ligne.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/equation/LinesBlockField.tsx packages/shared/src/equation/LinesBlockField.test.tsx
git commit -m "fix(shared): Enter in a calcul puts the caret in the new line

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Toolbar compacte

**Files:**
- Modify: `apps/zachart-maths/src/exercises/Toolbar.tsx`
- Test: `apps/zachart-maths/src/exercises/Toolbar.test.tsx` (existant, doit rester vert)

- [ ] **Step 1:** Dans `Toolbar.tsx`, modifier les styles (aucune logique) :
  - conteneur : `gap: 4`, `width: 72`, `padding: 6` ;
  - groupe de famille : `gap: 2`, `padding: 3`, `borderRadius: 6` ;
  - bouton : ajouter `style={{ borderColor: borderOf(family.hue), width: 26, height: 26, fontSize: 13 }}` (remplace le `style` actuel) ; garder `size="icon-sm"`.

- [ ] **Step 2: Vérifier visuellement** — `bun run --filter zachart-maths dev`, ouvrir `http://localhost:1450`, capturer la barre (outil navigateur ou œil) : deux colonnes, boutons lisibles, glyphes non tronqués, largeur nettement réduite. Si un glyphe est tronqué, passer les boutons à 28 px.

- [ ] **Step 3:** `bun run --filter zachart-maths test -- Toolbar` → PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/zachart-maths/src/exercises/Toolbar.tsx
git commit -m "style(zachart-maths): a tighter toolbar

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Documentation et vérification finale

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1:** Dans la section `packages/shared` de `CLAUDE.md`, ajouter : `PanelSearch` / `PanelFooter` / `PanelFooterSeparator` dans `@suite/shared/shell` (le bouton de repli d'un `CollapsiblePanel` est dans son pied ; l'app passe ses actions par `footer`, via des commandes) ; `TableGrid` dans `@suite/shared/equation` (grille à « + » de frontière, données laissées à l'app) ; corriger la phrase « Mentale only reuses usePanelCollapsed… » pour mentionner `PanelSearch`/`PanelFooter`. Dans la section Zach'Math : `treeSearch.ts` (recherche titre + chapitre, pas le contenu) et les commandes `tree.newChapter` / `tree.toggleAll`.

- [ ] **Step 2: Vérification complète** (`superpowers:verification-before-completion`) :

Run: `bun run test:all`, `cargo test --workspace`, `bunx tsc --noEmit -p apps/zachart-mentale`, `-p apps/zachart-maths`, `-p packages/shared`.
Expected: tout vert. Rapporter toute défaillance avec sa sortie, sans la masquer.

- [ ] **Step 3:** Mettre le graphe à jour : `graphify update .`

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: PanelSearch, PanelFooter and TableGrid in CLAUDE.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
