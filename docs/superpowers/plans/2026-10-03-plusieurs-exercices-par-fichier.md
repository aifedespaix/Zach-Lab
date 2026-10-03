# Plusieurs exercices par fichier — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un fichier de Zach'Math devient une fiche qui contient plusieurs exercices, avec navigation précédent/suivant (création au bord), suppression d'un exercice, liste en bas de la sidebar gauche, et un code partagé avec Zachar't Mentale là où c'est utile.

**Architecture:** Le format passe en v2 (`Sheet` = titre + `exercices[]`), les fichiers v1 sont lus comme une fiche à un exercice sans être réécrits à l'ouverture. La logique de fiche est pure (`sheet.ts`), `useOpenExercise` charge la fiche entière et expose l'exercice courant (`exercise`) pour que les lecteurs existants ne changent presque pas. Deux modules rejoignent `@suite/shared` : `ConfirmDialog` (ui) et `renderMathToHtml` (math).

**Tech Stack:** React 19, TypeScript, Zustand, Vitest + Testing Library (jsdom), Bun workspaces, KaTeX.

**Spec:** `docs/superpowers/specs/2026-10-03-plusieurs-exercices-par-fichier-design.md`

## Global Constraints

- Format v2 : `{ version: 2, id, titre, exercices: [{ id, numero, page, enonce, blocs, reponse, notes }] }` ; `EXERCISE_VERSION` devient `SHEET_VERSION = 2`.
- Une version supérieure à 2 est refusée (fichier `corrompu`) ; une fiche a toujours au moins un exercice.
- Un fichier v1 ouvert sans modification n'est jamais réécrit sur le disque.
- `packages/shared` n'importe jamais d'une app ; les apps n'importent que les points d'entrée publics (`@suite/shared/ui`, `@suite/shared/math`…), jamais un fichier dans un sous-chemin.
- Dans `shared`, les imports sont relatifs, jamais `@suite/shared/…`.
- `shared/math` ne touche pas à Tauri (l'admin web de Mentale reste autorisé à l'importer).
- Textes de l'interface en français, tutoiement (« Choisis un exercice… »).
- Commandes depuis la racine du dépôt. Jamais `git add -A` ni `git add -f` : chemins explicites.
- Chaque commit se termine par la ligne `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Pas de barre de défilement de page : seuls les panneaux et la pile de blocs défilent (lot A).

## Review Focus

Les cas que le spec implique sans qu'une tâche les teste d'office, du plus probable au moins probable. Chacun a son test dans la tâche indiquée.

1. **Ouvrir un fichier v1 sans rien changer ne le réécrit pas** (sinon un simple coup d'œil migre les fichiers de l'élève) → Task 3, test `n'écrit rien en ouvrant un fichier v1`.
2. **Une modification juste avant de changer de fichier n'est pas perdue** avec plusieurs exercices (l'édition est sur l'exercice 2, pas le 1) → Task 4, test `écrit l'exercice courant en changeant de fichier`.
3. **Un fichier v2 à `exercices: []` ou sans `exercices`, ou avec des `id` en double, s'ouvre quand même** → Task 3, tests `validateSheet`.
4. **Supprimer le dernier exercice de la liste ramène sur le précédent ; l'exercice unique ne se supprime pas** → Task 3 (`dropExercise`) et Task 4 (bouton désactivé).
5. **Un champ inconnu d'un exercice survit à une modification** (fichier écrit par une version plus récente) → Task 3, tests `validateSheet` et `patchExercise`.

---

### Task 1: `ConfirmDialog` dans `@suite/shared/ui`

**Files:**
- Create: `packages/shared/src/ui/confirm-dialog.tsx`
- Create: `packages/shared/src/ui/confirm-dialog.test.tsx`
- Modify: `packages/shared/src/ui/index.ts`

**Interfaces:**
- Produces: `ConfirmDialog({ open, title, description, confirmLabel?, onConfirm, onCancel })` — `confirmLabel` vaut `'Supprimer'` par défaut ; `onCancel` est aussi appelé par Échap et le clic hors du dialogue. Utilisé par les tâches 4 et 6.

- [ ] **Step 1: Écrire le test qui échoue**

```tsx
// packages/shared/src/ui/confirm-dialog.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'

const setup = (open = true) => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(<ConfirmDialog open={open} title="Supprimer ?" description="C'est définitif." onConfirm={onConfirm} onCancel={onCancel} />)
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('montre le titre et la description, et rien quand il est fermé', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Supprimer ?' })).toHaveTextContent("C'est définitif.")
  })
  it('ne rend rien tant qu\'il est fermé', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('confirme avec le bouton destructif, annule avec « Annuler » et avec Échap', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = setup()
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd packages/shared && bunx vitest run src/ui/confirm-dialog.test.tsx; cd ../..`
Expected: FAIL (`Failed to resolve import "./confirm-dialog"`).

- [ ] **Step 3: Implémenter**

```tsx
// packages/shared/src/ui/confirm-dialog.tsx
import type { ReactNode } from 'react'
import { Button } from './button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  /** Le texte du bouton destructif. */
  confirmLabel?: string
  onConfirm: () => void
  /** « Annuler », Échap et un clic hors du dialogue. */
  onCancel: () => void
}

/** Demande confirmation avant une action qu'on ne peut pas défaire (suppression). */
export function ConfirmDialog({ open, title, description, confirmLabel = 'Supprimer', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Ajouter dans `packages/shared/src/ui/index.ts`, après la ligne `export * from './button'` :

```ts
export * from './confirm-dialog'
```

- [ ] **Step 4: Vérifier le succès**

Run: `cd packages/shared && bunx vitest run src/ui/confirm-dialog.test.tsx; cd ../..`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/ui/confirm-dialog.tsx packages/shared/src/ui/confirm-dialog.test.tsx packages/shared/src/ui/index.ts
git commit -m "feat(shared): ConfirmDialog for destructive confirmations"
```

---

### Task 2: `renderMathToHtml` dans `@suite/shared/math`

La version de Mentale (`apps/zachart-mentale/src/content/renderMath.ts`) n'importe rien de l'app et ajoute `mhchem` ; celle de Zach'Math (`apps/zachart-maths/src/math/renderMath.ts`) en est une copie réduite. On garde celle de Mentale et ses tests.

**Files:**
- Move: `apps/zachart-mentale/src/content/renderMath.ts` → `packages/shared/src/math/renderMath.ts`
- Move: `apps/zachart-mentale/src/content/renderMath.test.ts` → `packages/shared/src/math/renderMath.test.ts`
- Create: `packages/shared/src/math/index.ts`
- Modify: `packages/shared/package.json` (export `./math`, dépendance `katex`)
- Modify (imports réécrits par script) : `apps/zachart-mentale/src/content/{BlockEditor,BlockView,EquationEditor}.tsx`, `apps/zachart-maths/src/cours/markdown.tsx`, `apps/zachart-maths/src/math/MathField.tsx`, `apps/zachart-maths/src/cours/courses.test.ts`
- Delete: `apps/zachart-maths/src/math/renderMath.ts`, `apps/zachart-maths/src/math/renderMath.test.ts`

**Interfaces:**
- Produces: `import { renderMathToHtml } from '@suite/shared/math'` — `(latex: string, display?: boolean) => string`, même contrat qu'aujourd'hui (borné, jamais d'exception, `trust: false`).

- [ ] **Step 1: Déplacer les fichiers de Mentale**

```bash
mkdir -p packages/shared/src/math
git mv apps/zachart-mentale/src/content/renderMath.ts packages/shared/src/math/renderMath.ts
git mv apps/zachart-mentale/src/content/renderMath.test.ts packages/shared/src/math/renderMath.test.ts
```

- [ ] **Step 2: Créer le point d'entrée et déclarer l'export et la dépendance**

```ts
// packages/shared/src/math/index.ts
export { renderMathToHtml } from './renderMath'
```

Dans `packages/shared/package.json`, ajouter à `exports` (après `"./search"`) `"./math": "./src/math/index.ts"` (sans oublier la virgule de la ligne précédente), et à `dependencies` : `"katex": "^0.18.7"`.

Run: `bun install`
Expected: se termine sans erreur ; le fichier de verrouillage est mis à jour.

- [ ] **Step 3: Compléter les tests avec ce que couvrait la version de Zach'Math**

Ajouter à la fin du `describe` principal de `packages/shared/src/math/renderMath.test.ts` :

```ts
  it('replie une formule démesurée sur un texte lisible, sans la composer', () => {
    expect(() => renderMathToHtml('\\sqrt{'.repeat(2000))).not.toThrow()
    expect(renderMathToHtml('x'.repeat(6000))).toContain('katex-fallback')
  })

  it('refuse ce qui sortirait du texte (trust: false)', () => {
    expect(renderMathToHtml('\\href{javascript:alert(1)}{x}')).not.toContain('<a ')
  })

  it('ignore une formule vide', () => {
    expect(renderMathToHtml('  ')).toBe('')
  })
```

- [ ] **Step 4: Réécrire les imports des deux apps**

```bash
bun scripts/move-module.mjs apps/zachart-mentale content/renderMath @suite/shared/math
git rm -q apps/zachart-maths/src/math/renderMath.ts apps/zachart-maths/src/math/renderMath.test.ts
bun scripts/move-module.mjs apps/zachart-maths math/renderMath @suite/shared/math
grep -rn "renderMath'" apps --include=*.ts --include=*.tsx | grep -v node_modules
```
Expected : le `grep` ne montre plus aucun import relatif de `renderMath`. Si un import n'a pas été réécrit, le remplacer à la main par `import { renderMathToHtml } from '@suite/shared/math'`.

- [ ] **Step 5: Vérifier**

Run: `bunx tsc --noEmit -p apps/zachart-maths && bunx tsc --noEmit -p apps/zachart-mentale && bunx tsc --noEmit -p packages/shared && bun run test`
Expected: tsc sans erreur ; tous les tests passent (shared compte les tests de rendu déplacés, `boundary.test.ts` passe).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/math packages/shared/package.json bun.lock apps/zachart-mentale/src/content apps/zachart-maths/src/math apps/zachart-maths/src/cours
git commit -m "refactor(shared): one renderMathToHtml in @suite/shared/math, used by both apps"
```
(Si le fichier de verrouillage n'est pas `bun.lock`, `git status --short` indique le bon nom ; l'ajouter au lieu de `bun.lock`.)

---

### Task 3: Modèle de fiche, bibliothèque et exercice ouvert (v2)

C'est la tâche la plus large : changer le type `Exercise` casse tout ce qui le lit, donc le format, la bibliothèque, le store de l'exercice ouvert et leurs lecteurs bougent dans un même commit pour que le dépôt reste vert.

**Files:**
- Modify: `apps/zachart-maths/src/exercises/types.ts`
- Create: `apps/zachart-maths/src/exercises/types.test.ts`
- Create: `apps/zachart-maths/src/exercises/sheet.ts`
- Create: `apps/zachart-maths/src/exercises/sheet.test.ts`
- Modify: `apps/zachart-maths/src/exercises/library.ts`, `library.test.ts`
- Modify: `apps/zachart-maths/src/exercises/useOpenExercise.ts`
- Modify: `apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx` (adaptation minimale), `ExerciseWorkspace.test.tsx`
- Modify: `apps/zachart-maths/src/cours/exerciseContext.ts`, `CoursePanel.tsx`, `CoursePanel.test.tsx`

**Interfaces:**
- Produces (`types.ts`):
  - `SHEET_VERSION = 2`
  - `interface Exercise { id; numero; enonce; page; blocs: unknown[]; reponse; notes }` (tous `string` sauf `blocs`)
  - `interface Sheet { version: number; id: string; titre: string; exercices: Exercise[] }`
  - `newExercise(): Exercise`, `newSheet(titre: string): Sheet`, `validateSheet(raw: unknown): Sheet | null`
  - `ExerciseEntry` gagne `exercices: number`
- Produces (`sheet.ts`): `type Position = 'start' | 'end'`; `insertExercise(sheet, position): { sheet: Sheet; added: Exercise }`; `neighbour(sheet, id, delta: -1 | 1): string | null`; `isBlank(exercise): boolean`; `dropExercise(sheet, id): { sheet: Sheet; focus: string }`; `patchExercise(sheet, id, patch: Partial<Exercise>): Sheet`.
- Produces (`library.ts`): `readSheet(fs, path): Promise<Sheet | null>`, `saveSheet(fs, path, sheet): Promise<void>` (remplacent `readExercise`/`saveExercise`).
- Produces (`useOpenExercise.ts`): état `{ path, sheet, currentId, exercise, status }` ; `type ExerciseEdit = Partial<Pick<Exercise, 'numero'|'enonce'|'page'|'blocs'|'reponse'|'notes'>>` ; actions `edit(patch)`, `editTitle(titre)`, `goTo(id)`, `step(delta: -1 | 1)`, `addExercise()`, `removeCurrent()`, `flush()`.
- Produces (`exerciseContext.ts`): `contextOf(path: string, titre: string, exercise: Exercise)`.

#### 3a. Le format (`types.ts`)

- [ ] **Step 1: Écrire les tests du format (échec attendu)**

```ts
// apps/zachart-maths/src/exercises/types.test.ts
import { describe, expect, it } from 'vitest'
import { SHEET_VERSION, newSheet, validateSheet } from './types'

const v1 = {
  version: 1, id: 'f', titre: 'Fractions', question: '3.b', enonce: 'Calcule', page: '45',
  blocs: [{ id: 'b', type: 'texte', contenu: 'x' }], reponse: '7', notes: 'n',
}

describe('validateSheet', () => {
  it('refuse ce qui n\'est pas une fiche, et un format plus récent', () => {
    expect(validateSheet(null)).toBeNull()
    expect(validateSheet({ titre: 'x' })).toBeNull()
    expect(validateSheet({ version: 3, id: 'a', titre: 'x', exercices: [] })).toBeNull()
  })

  it('lit un fichier v1 comme une fiche à un exercice (question → numero)', () => {
    const sheet = validateSheet(v1)!
    expect(sheet).toMatchObject({ version: SHEET_VERSION, id: 'f', titre: 'Fractions' })
    expect(sheet.exercices).toHaveLength(1)
    expect(sheet.exercices[0]).toMatchObject({ numero: '3.b', enonce: 'Calcule', page: '45', reponse: '7', notes: 'n', blocs: v1.blocs })
    expect(sheet.exercices[0]).not.toHaveProperty('question')
  })

  it('complète les champs manquants d\'un fichier v1', () => {
    expect(validateSheet({ version: 1, id: 'a', titre: 'x' })!.exercices[0]).toMatchObject({ numero: '', enonce: '', blocs: [], reponse: '', notes: '' })
  })

  it('lit un fichier v2, exercices dans l\'ordre', () => {
    const sheet = validateSheet({ version: 2, id: 'f', titre: 'T', exercices: [{ id: 'a', numero: '1' }, { id: 'b', numero: '2', page: '9' }] })!
    expect(sheet.exercices.map(e => [e.id, e.numero, e.page])).toEqual([['a', '1', ''], ['b', '2', '9']])
  })

  it('ouvre avec un exercice vierge une fiche sans exercice', () => {
    expect(validateSheet({ version: 2, id: 'f', titre: 'T', exercices: [] })!.exercices).toHaveLength(1)
    expect(validateSheet({ version: 2, id: 'f', titre: 'T' })!.exercices).toHaveLength(1)
    expect(validateSheet({ version: 2, id: 'f', titre: 'T', exercices: ['x', 3, null] })!.exercices).toHaveLength(1)
  })

  it('refait les id manquants ou en double', () => {
    const ids = validateSheet({ version: 2, id: 'f', titre: 'T', exercices: [{ id: 'a' }, { id: 'a' }, {}] })!.exercices.map(e => e.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe('a')
  })

  it('conserve les champs qu\'il ne connaît pas', () => {
    const sheet = validateSheet({ version: 2, id: 'f', titre: 'T', exercices: [{ id: 'a', futur: { x: 1 } }] })!
    expect(sheet.exercices[0]).toMatchObject({ futur: { x: 1 } })
  })
})

describe('newSheet', () => {
  it('crée une fiche v2 avec un exercice vierge', () => {
    const sheet = newSheet('Fractions p.45')
    expect(sheet).toMatchObject({ version: SHEET_VERSION, titre: 'Fractions p.45' })
    expect(sheet.exercices).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/types.test.ts; cd ../..`
Expected: FAIL (`validateSheet` n'existe pas).

- [ ] **Step 3: Réécrire `types.ts`**

```ts
// apps/zachart-maths/src/exercises/types.ts
/** Version du format d'un fichier ; à incrémenter si le format casse. */
export const SHEET_VERSION = 2

/**
 * Un exercice d'une fiche.
 *
 * Les blocs de travail sont de simples valeurs JSON ici : leur forme précise est celle de
 * `blocks.ts`. Les champs qu'on ne connaît pas (écrits par une version plus récente) sont
 * conservés tels quels à la lecture, pour ne rien perdre en passant d'une version à l'autre.
 */
export interface Exercise {
  id: string
  /** Texte libre (« 3.b ») ; vide, l'exercice s'affiche par sa position dans la fiche. */
  numero: string
  /** La question posée, en toutes lettres. */
  enonce: string
  page: string
  blocs: unknown[]
  reponse: string
  /** Les notes libres prises à côté de l'exercice (sidebar droite). */
  notes: string
}

/** Un fichier : une fiche (une feuille de manuel) et ses exercices. */
export interface Sheet {
  version: number
  id: string
  titre: string
  /** Jamais vide : une fiche a toujours au moins un exercice. */
  exercices: Exercise[]
}

export function newExercise(): Exercise {
  return { id: crypto.randomUUID(), numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '' }
}

export function newSheet(titre: string): Sheet {
  return { version: SHEET_VERSION, id: crypto.randomUUID(), titre, exercices: [newExercise()] }
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

function normalizeExercise(raw: unknown, seen: Set<string>): Exercise | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  let id = typeof r.id === 'string' && r.id !== '' ? r.id : crypto.randomUUID()
  if (seen.has(id)) id = crypto.randomUUID()
  seen.add(id)
  // `...r` d'abord : les champs inconnus passent, les champs connus sont ensuite normalisés.
  return {
    ...r,
    id,
    numero: text(r.numero),
    enonce: text(r.enonce),
    page: text(r.page),
    blocs: Array.isArray(r.blocs) ? r.blocs : [],
    reponse: text(r.reponse),
    notes: text(r.notes),
  }
}

/**
 * Relit un fichier ; `null` si ce n'est pas une fiche exploitable.
 *
 * Un fichier v1 (un exercice à plat, `question` pour le numéro) est lu comme une fiche à un
 * exercice. Rien n'est écrit ici : le fichier ne passe en v2 qu'à la première modification.
 */
export function validateSheet(raw: unknown): Sheet | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.titre !== 'string' || typeof r.id !== 'string') return null
  if (typeof r.version !== 'number' || r.version > SHEET_VERSION) return null

  if (r.version < 2) {
    const exercice: Exercise = {
      id: crypto.randomUUID(),
      numero: text(r.question),
      enonce: text(r.enonce),
      page: text(r.page),
      blocs: Array.isArray(r.blocs) ? r.blocs : [],
      reponse: text(r.reponse),
      notes: text(r.notes),
    }
    return { version: SHEET_VERSION, id: r.id, titre: r.titre, exercices: [exercice] }
  }

  const seen = new Set<string>()
  const exercices = (Array.isArray(r.exercices) ? r.exercices : []).flatMap(item => {
    const exercise = normalizeExercise(item, seen)
    return exercise === null ? [] : [exercise]
  })
  return { version: SHEET_VERSION, id: r.id, titre: r.titre, exercices: exercices.length > 0 ? exercices : [newExercise()] }
}

/** Un nœud de l'arborescence affichée : un chapitre (dossier) et ses fichiers. */
export interface ExerciseEntry {
  /** Chemin relatif à la racine, ex. `Fractions/exo-1.json`. */
  path: string
  titre: string
  /** Nombre d'exercices de la fiche (0 pour un fichier illisible). */
  exercices: number
  /** `true` quand le fichier est illisible : il reste visible, mais ne s'ouvre pas. */
  corrompu: boolean
}

export interface ChapterNode {
  /** Nom du dossier, aussi son identifiant. */
  name: string
  exercises: ExerciseEntry[]
}
```

- [ ] **Step 4: Vérifier le succès de `types.test.ts`**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/types.test.ts; cd ../..`
Expected: PASS (8 tests). Le reste du dépôt ne compile plus : normal, la suite de la tâche le répare.

#### 3b. Les opérations pures (`sheet.ts`)

- [ ] **Step 5: Écrire les tests (échec attendu)**

```ts
// apps/zachart-maths/src/exercises/sheet.test.ts
import { describe, expect, it } from 'vitest'
import { dropExercise, insertExercise, isBlank, neighbour, patchExercise } from './sheet'
import { newExercise, type Sheet } from './types'

const sheet = (...ids: string[]): Sheet => ({ version: 2, id: 'f', titre: 'T', exercices: ids.map(id => ({ ...newExercise(), id })) })
const ids = (s: Sheet) => s.exercices.map(e => e.id)

describe('insertExercise', () => {
  it('ajoute un exercice vierge à la fin ou au début, sans toucher l\'original', () => {
    const base = sheet('a', 'b')
    const end = insertExercise(base, 'end')
    expect(ids(end.sheet)).toEqual(['a', 'b', end.added.id])
    const start = insertExercise(base, 'start')
    expect(ids(start.sheet)).toEqual([start.added.id, 'a', 'b'])
    expect(ids(base)).toEqual(['a', 'b'])
    expect(isBlank(end.added)).toBe(true)
  })
})

describe('neighbour', () => {
  it('donne l\'id voisin, et null au bord ou pour un id inconnu', () => {
    const s = sheet('a', 'b', 'c')
    expect(neighbour(s, 'b', 1)).toBe('c')
    expect(neighbour(s, 'b', -1)).toBe('a')
    expect(neighbour(s, 'a', -1)).toBeNull()
    expect(neighbour(s, 'c', 1)).toBeNull()
    expect(neighbour(s, 'zzz', 1)).toBeNull()
  })
})

describe('isBlank', () => {
  it('est faux dès qu\'un numéro, un énoncé, un bloc, une réponse ou une note existe', () => {
    const blank = newExercise()
    expect(isBlank(blank)).toBe(true)
    expect(isBlank({ ...blank, numero: ' ' })).toBe(true)
    expect(isBlank({ ...blank, numero: '1' })).toBe(false)
    expect(isBlank({ ...blank, enonce: 'Calcule' })).toBe(false)
    expect(isBlank({ ...blank, blocs: [{}] })).toBe(false)
    expect(isBlank({ ...blank, reponse: '7' })).toBe(false)
    expect(isBlank({ ...blank, notes: 'n' })).toBe(false)
  })
})

describe('dropExercise', () => {
  it('retire un exercice du milieu et donne la main au suivant', () => {
    const out = dropExercise(sheet('a', 'b', 'c'), 'b')
    expect(ids(out.sheet)).toEqual(['a', 'c'])
    expect(out.focus).toBe('c')
  })
  it('retire le dernier et donne la main au précédent', () => {
    const out = dropExercise(sheet('a', 'b', 'c'), 'c')
    expect(ids(out.sheet)).toEqual(['a', 'b'])
    expect(out.focus).toBe('b')
  })
  it('garde toujours un exercice', () => {
    const only = sheet('a')
    const out = dropExercise(only, 'a')
    expect(ids(out.sheet)).toEqual(['a'])
    expect(out.focus).toBe('a')
  })
})

describe('patchExercise', () => {
  it('modifie seulement l\'exercice visé, et garde ses champs inconnus', () => {
    const base = sheet('a', 'b')
    base.exercices[0] = { ...base.exercices[0], futur: 1 } as never
    const out = patchExercise(base, 'a', { reponse: '7' })
    expect(out.exercices[0]).toMatchObject({ reponse: '7', futur: 1 })
    expect(out.exercices[1]).toBe(base.exercices[1])
  })
})
```

- [ ] **Step 6: Vérifier l'échec**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/sheet.test.ts; cd ../..`
Expected: FAIL (`./sheet` introuvable).

- [ ] **Step 7: Implémenter `sheet.ts`**

```ts
// apps/zachart-maths/src/exercises/sheet.ts
import { newExercise, type Exercise, type Sheet } from './types'

/** Les opérations sur une fiche, sans React ni disque : chacune rend une nouvelle fiche. */

export type Position = 'start' | 'end'

const indexOf = (sheet: Sheet, id: string) => sheet.exercices.findIndex(e => e.id === id)

/** Un exercice vierge au début ou à la fin ; `added` est celui qu'on vient de créer. */
export function insertExercise(sheet: Sheet, position: Position): { sheet: Sheet; added: Exercise } {
  const added = newExercise()
  const exercices = position === 'start' ? [added, ...sheet.exercices] : [...sheet.exercices, added]
  return { sheet: { ...sheet, exercices }, added }
}

/** L'id de l'exercice voisin ; `null` au bord de la fiche ou si `id` n'y est pas. */
export function neighbour(sheet: Sheet, id: string, delta: -1 | 1): string | null {
  const i = indexOf(sheet, id)
  return i < 0 ? null : (sheet.exercices[i + delta]?.id ?? null)
}

/** Rien n'a encore été écrit dedans (la page seule ne compte pas). */
export const isBlank = (e: Exercise) =>
  e.numero.trim() === '' && e.enonce.trim() === '' && e.reponse.trim() === '' && e.notes.trim() === '' && e.blocs.length === 0

/**
 * Retire un exercice et dit lequel afficher ensuite : le suivant, ou le précédent si c'était le
 * dernier. Une fiche garde toujours un exercice : sur le seul restant, rien ne bouge.
 */
export function dropExercise(sheet: Sheet, id: string): { sheet: Sheet; focus: string } {
  const i = indexOf(sheet, id)
  if (i < 0 || sheet.exercices.length <= 1) return { sheet, focus: id }
  const exercices = sheet.exercices.filter(e => e.id !== id)
  return { sheet: { ...sheet, exercices }, focus: exercices[Math.min(i, exercices.length - 1)].id }
}

export const patchExercise = (sheet: Sheet, id: string, patch: Partial<Exercise>): Sheet => ({
  ...sheet,
  exercices: sheet.exercices.map(e => (e.id === id ? { ...e, ...patch } : e)),
})
```

- [ ] **Step 8: Vérifier le succès**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/sheet.test.ts; cd ../..`
Expected: PASS (9 tests).

#### 3c. La bibliothèque (`library.ts`)

- [ ] **Step 9: Adapter `library.test.ts` (échec attendu)**

Dans `apps/zachart-maths/src/exercises/library.test.ts` :
- ligne 4 : `readExercise` devient `readSheet` dans l'import ; supprimer la ligne 8 `import { validateExercise } from './types'` (remplacée par `import { SHEET_VERSION } from './types'`) ;
- supprimer tout le `describe('validateExercise', …)` (lignes 27 à 39 environ : sa couverture est maintenant dans `types.test.ts`) ;
- dans le test du fichier cassé, `readExercise(fs, 'A/cassé.json')` devient `readSheet(fs, 'A/cassé.json')` ;
- ajouter dans `describe('bibliothèque', …)` :

```ts
  it('compte les exercices de chaque fiche, et 0 pour un fichier illisible', async () => {
    const fs = createMemoryFs({
      'A/v1.json': JSON.stringify({ version: 1, id: 'a', titre: 'Ancien' }),
      'A/v2.json': JSON.stringify({ version: 2, id: 'b', titre: 'Fiche', exercices: [{ id: '1' }, { id: '2' }, { id: '3' }] }),
      'A/cassé.json': '{ pas du json',
    })
    const entries = (await loadTree(fs))[0].exercises
    expect(entries.map(e => [e.titre, e.exercices, e.corrompu])).toEqual([['cassé', 0, true], ['Ancien', 1, false], ['Fiche', 3, false]])
  })

  it('lire un fichier v1 ne le réécrit pas ; le renommer l\'écrit en v2 sans perdre l\'exercice', async () => {
    const v1 = JSON.stringify({ version: 1, id: 'a', titre: 'Ancien', question: '2', reponse: '7' })
    const fs = createMemoryFs({ 'A/a.json': v1 })
    await readSheet(fs, 'A/a.json')
    await loadTree(fs)
    expect(fs.files.get('A/a.json')).toBe(v1)
    await renameExercise(fs, 'A/a.json', 'Nouveau')
    expect(JSON.parse(fs.files.get('A/a.json')!)).toMatchObject({ version: SHEET_VERSION, titre: 'Nouveau', exercices: [{ numero: '2', reponse: '7' }] })
  })
```
(L'ordre `cassé`, `Ancien`, `Fiche` vient du tri alphabétique `localeCompare('fr')` de `sortByOrder` quand il n'y a pas de `_ordre.json` ; si l'ordre réel diffère, ajuster le tableau attendu à ce que `loadTree` renvoie, sans changer ce qui est vérifié.)

- [ ] **Step 10: Vérifier l'échec**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/library.test.ts; cd ../..`
Expected: FAIL (`readSheet` n'existe pas).

- [ ] **Step 11: Adapter `library.ts`**

Remplacements dans `apps/zachart-maths/src/exercises/library.ts` :

```ts
// ligne 3
import { newSheet, validateSheet, type ChapterNode, type ExerciseEntry, type Sheet } from './types'
```

```ts
// remplace readExercise / saveExercise (lignes 50 à 60)
export async function readSheet(fs: ExerciseFs, path: string): Promise<Sheet | null> {
  try {
    return validateSheet(JSON.parse(await fs.readText(path)))
  } catch {
    return null
  }
}

export async function saveSheet(fs: ExerciseFs, path: string, sheet: Sheet): Promise<void> {
  await fs.writeText(path, JSON.stringify(sheet, null, 2))
}
```

```ts
// dans loadTree, remplace les lignes qui lisent et poussent l'entrée
      const sheet = await readSheet(fs, path)
      exercises.push({
        path,
        titre: sheet?.titre ?? file.slice(0, -EXERCISE_EXT.length),
        exercices: sheet?.exercices.length ?? 0,
        corrompu: sheet === null,
      })
```

```ts
// dans createExercise : remplace la ligne `await saveExercise(…newExercise…)`
  await saveSheet(fs, path, newSheet(requestedTitle.trim()))
```

```ts
// renameExercise : remplace le corps après le contrôle `trimmed === ''`
  const sheet = await readSheet(fs, path)
  if (sheet === null) throw new Error("Cet exercice est illisible, il ne peut pas être renommé.")
  await saveSheet(fs, path, { ...sheet, titre: trimmed })
```

- [ ] **Step 12: Vérifier le succès**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/library.test.ts; cd ../..`
Expected: PASS.

#### 3d. L'exercice ouvert (`useOpenExercise.ts`)

- [ ] **Step 13: Écrire les tests d'`ExerciseWorkspace` qui échouent (comportement v2 sur disque)**

Dans `apps/zachart-maths/src/exercises/ExerciseWorkspace.test.tsx` :

1. Ligne `beforeEach` : `useOpenExercise.setState({ path: null, exercise: null, status: 'empty' })` devient `useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' })`. Faire pareil dans tout autre test qui appelle `useOpenExercise.setState` (`grep -rn "useOpenExercise.setState" apps/zachart-maths/src`).
2. Adapter les lectures du disque (le fichier est écrit en v2 dès la première modification) :
   - `stored(fs, 'A/a.json').page` (2 occurrences) → `stored(fs, 'A/a.json').exercices[0].page`
   - `expect(stored(fs, 'A/a.json')).toMatchObject({ reponse: 'x = 3', titre: 'Renommé' })` → `expect(stored(fs, 'A/a.json')).toMatchObject({ titre: 'Renommé', exercices: [{ reponse: 'x = 3' }] })`
   - `stored(fs, 'A/a.json').blocs.map(` → `stored(fs, 'A/a.json').exercices[0].blocs.map(`
   - `stored(fs, 'A/a.json').enonce` → `stored(fs, 'A/a.json').exercices[0].enonce`
   - `stored(fs, 'A/a.json').blocs[0].expression` → `stored(fs, 'A/a.json').exercices[0].blocs[0].expression`
   - `expect(stored(fs, 'A/a.json').blocs[0]).toMatchObject(` → `expect(stored(fs, 'A/a.json').exercices[0].blocs[0]).toMatchObject(`
3. Dans `apps/zachart-maths/src/cours/CoursePanel.test.tsx` : même `setState` à compléter, et `JSON.parse(fs.files.get('A/a.json')!).notes` → `JSON.parse(fs.files.get('A/a.json')!).exercices[0].notes`.
4. Si un test cherche le champ « Numéro de question (facultatif) », le renommer en « Numéro de l'exercice (facultatif) » (`grep -rn "Numéro de question" apps/zachart-maths/src`).
5. Ajouter dans `ExerciseWorkspace.test.tsx` :

```tsx
  it('n\'écrit rien en ouvrant un fichier v1', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier') })
    const before = fs.files.get('A/a.json')
    await open('A/a.json')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(fs.files.get('A/a.json')).toBe(before)
  })

  it('un fichier v1 est écrit en v2, avec son exercice, à la première modification', async () => {
    const fs = await setup({ 'A/a.json': JSON.stringify({ version: 1, id: 'a', titre: 'Premier', question: '4', page: '12', blocs: [], reponse: '' }) })
    await open('A/a.json')
    await userEvent.setup().type(screen.getByLabelText('Réponse'), 'x')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json')).toMatchObject({ version: 2, titre: 'Premier', exercices: [{ numero: '4', page: '12', reponse: 'x' }] })
  })
```

- [ ] **Step 14: Vérifier l'échec**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/ExerciseWorkspace.test.tsx; cd ../..`
Expected: FAIL (le store écrit encore l'ancien format, ou ne compile pas).

- [ ] **Step 15: Réécrire `useOpenExercise.ts`**

```ts
// apps/zachart-maths/src/exercises/useOpenExercise.ts
import { create } from 'zustand'
import { readSheet, saveSheet } from './library'
import { dropExercise, insertExercise, isBlank, neighbour, patchExercise } from './sheet'
import type { Exercise, Sheet } from './types'
import { useExerciseStore } from './useExerciseStore'

export const AUTOSAVE_DELAY_MS = 600

type Status = 'empty' | 'loading' | 'unreadable' | 'saved' | 'dirty' | 'saving' | 'failed'

/** Les champs que l'élève modifie dans l'éditeur ; `id` et le titre de la fiche ont leurs propres actions. */
export type ExerciseEdit = Partial<Pick<Exercise, 'numero' | 'enonce' | 'page' | 'blocs' | 'reponse' | 'notes'>>

interface OpenExerciseStore {
  path: string | null
  /** La fiche entière : c'est elle qui est lue et écrite. */
  sheet: Sheet | null
  /** L'exercice affiché dans la fiche. */
  currentId: string | null
  /** L'exercice affiché, dérivé de `sheet` et `currentId` et gardé à jour pour ses lecteurs. */
  exercise: Exercise | null
  status: Status
  edit(patch: ExerciseEdit): void
  editTitle(titre: string): void
  /** Affiche un autre exercice de la fiche ; sans effet si `id` n'y est pas. */
  goTo(id: string): void
  /** Voisin ; au bord, crée un exercice (avant ou après), sauf si l'exercice affiché est vierge. */
  step(delta: -1 | 1): void
  /** Ajoute un exercice vierge à la fin et l'affiche. */
  addExercise(): void
  /** Retire l'exercice affiché ; sans effet sur le seul exercice de la fiche. */
  removeCurrent(): void
  /** Écrit tout de suite ce qui attend (changement de fichier, fermeture). */
  flush(): Promise<void>
}

let timer: ReturnType<typeof setTimeout> | undefined
/** Chaque ouverture prend un numéro : une lecture lente d'un fichier déjà quitté est ignorée. */
let generation = 0

const show = (sheet: Sheet, currentId: string) => ({
  sheet,
  currentId,
  exercise: sheet.exercices.find(e => e.id === currentId) ?? null,
})

export const useOpenExercise = create<OpenExerciseStore>((set, get) => {
  async function write() {
    clearTimeout(timer)
    const { path, sheet, status } = get()
    const fs = useExerciseStore.getState().fs
    if (path === null || sheet === null || fs === null || status !== 'dirty') return
    set({ status: 'saving' })
    try {
      await saveSheet(fs, path, sheet)
      // Une frappe pendant l'écriture a remis l'état à « dirty » : ne pas l'écraser.
      if (get().path === path && get().status === 'saving') set({ status: 'saved' })
      if (get().path === path) void useExerciseStore.getState().refresh()
    } catch {
      if (get().path === path) set({ status: 'failed' })
    }
  }

  /** Une modification de la fiche : à l'écran tout de suite, sur le disque après le délai. */
  function change(sheet: Sheet, currentId: string) {
    set({ ...show(sheet, currentId), status: 'dirty' })
    clearTimeout(timer)
    timer = setTimeout(() => void write(), AUTOSAVE_DELAY_MS)
  }

  return {
    path: null,
    sheet: null,
    currentId: null,
    exercise: null,
    status: 'empty',

    edit(patch) {
      const { sheet, currentId } = get()
      if (sheet === null || currentId === null) return
      change(patchExercise(sheet, currentId, patch), currentId)
    },
    editTitle(titre) {
      const { sheet, currentId } = get()
      if (sheet === null || currentId === null) return
      change({ ...sheet, titre }, currentId)
    },
    goTo(id) {
      const { sheet } = get()
      if (sheet === null || !sheet.exercices.some(e => e.id === id)) return
      set(show(sheet, id))
    },
    step(delta) {
      const { sheet, currentId, exercise } = get()
      if (sheet === null || currentId === null || exercise === null) return
      const next = neighbour(sheet, currentId, delta)
      if (next !== null) return set(show(sheet, next))
      // Au bord : un nouvel exercice, mais pas par-dessus un exercice encore vierge.
      if (isBlank(exercise)) return
      const grown = insertExercise(sheet, delta < 0 ? 'start' : 'end')
      change(grown.sheet, grown.added.id)
    },
    addExercise() {
      const { sheet } = get()
      if (sheet === null) return
      const grown = insertExercise(sheet, 'end')
      change(grown.sheet, grown.added.id)
    },
    removeCurrent() {
      const { sheet, currentId } = get()
      if (sheet === null || currentId === null || sheet.exercices.length <= 1) return
      const dropped = dropExercise(sheet, currentId)
      change(dropped.sheet, dropped.focus)
    },
    flush: write,
  }
})

const closed = { path: null, sheet: null, currentId: null, exercise: null, status: 'empty' } as const

/** Ouvre `path` (ou ferme si `null`) après avoir écrit la fiche précédente. */
async function open(path: string | null) {
  const mine = ++generation
  await useOpenExercise.getState().flush()
  if (mine !== generation) return
  if (path === null) return void useOpenExercise.setState(closed)

  useOpenExercise.setState({ path, sheet: null, currentId: null, exercise: null, status: 'loading' })
  const fs = useExerciseStore.getState().fs
  const sheet = fs === null ? null : await readSheet(fs, path)
  if (mine !== generation) return
  useOpenExercise.setState(sheet === null ? { status: 'unreadable' } : { ...show(sheet, sheet.exercices[0].id), status: 'saved' })
}

// La fiche ouverte suit la sélection de l'arbre, y compris quand un renommage de chapitre ou un
// déplacement en change le chemin : dans ce cas la fiche est déjà à jour en mémoire.
useExerciseStore.subscribe((state, previous) => {
  if (state.selected === previous.selected) return
  if (state.selected !== null && state.selected === useOpenExercise.getState().path) return
  void open(state.selected)
})
```

- [ ] **Step 16: Adapter les lecteurs**

`apps/zachart-maths/src/cours/exerciseContext.ts` : changer la signature et la dernière ligne :

```ts
/** Ce que l'exercice ouvert dit de son sujet : son chapitre, le titre de sa fiche, ce qu'il contient. */
export function contextOf(path: string, titre: string, exercise: Exercise): ExerciseContext {
```
```ts
  return { chapter: splitPath(path)[0], titre, texte: texts.join(' '), formules }
```
Ajouter `exercise.enonce` au départ de `texts` : `const texts = [exercise.enonce, exercise.reponse]`.

`apps/zachart-maths/src/cours/CoursePanel.tsx`, dans `CoursesSection` :

```tsx
  const path = useOpenExercise(s => s.path)
  const sheet = useOpenExercise(s => s.sheet)
  const exercise = useOpenExercise(s => s.exercise)
```
```tsx
  const context = useDeferredValue(
    useMemo(() => (path !== null && sheet !== null && exercise !== null ? contextOf(path, sheet.titre, exercise) : null), [path, sheet, exercise]),
  )
```
Si un test appelle `contextOf(path, exercise)`, le mettre à jour (`grep -rn "contextOf(" apps/zachart-maths/src`).

`apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx` — adaptation minimale (la navigation vient à la Task 4) :

```tsx
  const { exercise, sheet, status } = useOpenExercise()
  const edit = useOpenExercise(s => s.edit)
  const editTitle = useOpenExercise(s => s.editTitle)
```
```tsx
  if (status === 'unreadable' || exercise === null || sheet === null) {
```
Le champ titre : `value={sheet.titre}` et `onChange={e => editTitle(e.target.value)}`. Le champ numéro :

```tsx
        <input
          aria-label="Numéro de l'exercice (facultatif)"
          placeholder="N°"
          value={exercise.numero}
          onChange={e => edit({ numero: e.target.value })}
          className={field}
          style={{ width: 110 }}
        />
```

- [ ] **Step 17: Vérifier tout**

Run: `bunx tsc --noEmit -p apps/zachart-maths && bun run test`
Expected: tsc sans erreur ; tous les tests passent (y compris les deux nouveaux de l'étape 13).

- [ ] **Step 18: Commit**

```bash
git add apps/zachart-maths/src/exercises/types.ts apps/zachart-maths/src/exercises/types.test.ts apps/zachart-maths/src/exercises/sheet.ts apps/zachart-maths/src/exercises/sheet.test.ts apps/zachart-maths/src/exercises/library.ts apps/zachart-maths/src/exercises/library.test.ts apps/zachart-maths/src/exercises/useOpenExercise.ts apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx apps/zachart-maths/src/exercises/ExerciseWorkspace.test.tsx apps/zachart-maths/src/cours/exerciseContext.ts apps/zachart-maths/src/cours/CoursePanel.tsx apps/zachart-maths/src/cours/CoursePanel.test.tsx
git commit -m "feat(zachart-maths): sheet format v2, several exercises per file, v1 files read as one-exercise sheets"
```
(Ajouter à la commande tout autre fichier de test que l'étape 13 ou 16 a obligé à toucher, par chemin explicite.)

---

### Task 4: Navigation, nouvel exercice et suppression d'un exercice

**Files:**
- Modify: `apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx`
- Modify: `apps/zachart-maths/src/exercises/ExerciseWorkspace.test.tsx`

**Interfaces:**
- Consumes: `useOpenExercise` (`sheet`, `currentId`, `step`, `addExercise`, `removeCurrent`), `isBlank` de `sheet.ts`, `ConfirmDialog` de `@suite/shared/ui`.
- Produces: dans l'en-tête, des boutons nommés « Exercice précédent », « Exercice suivant », « Nouvel exercice », « Supprimer l'exercice », et un compteur « 3 / 7 ».

- [ ] **Step 1: Écrire les tests (échec attendu)**

Ajouter dans `ExerciseWorkspace.test.tsx` (en haut, après `exo`) un fabriquant de fiche v2, puis les tests dans le `describe` :

```tsx
const sheetFile = (titre: string, exercices: object[]) => JSON.stringify({ version: 2, id: titre, titre, exercices })
const ex = (id: string, extra: object = {}) => ({ id, numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '', ...extra })
```

```tsx
  it('affiche la position dans la fiche et passe d\'un exercice à l\'autre', async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Premier énoncé' }), ex('2', { enonce: 'Second énoncé' })]) })
    await open('A/a.json')
    const user = userEvent.setup()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Premier énoncé')
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Second énoncé')
    await user.click(screen.getByRole('button', { name: 'Exercice précédent' }))
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Premier énoncé')
  })

  it('« suivant » au dernier exercice en crée un après, et il est écrit dans le fichier', async () => {
    const fs = await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Écrit' })]) })
    await open('A/a.json')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Exercice suivant' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices.map((e: { enonce: string }) => e.enonce)).toEqual(['Écrit', ''])
  })

  it('« précédent » au premier exercice en crée un avant', async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Écrit' })]) })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Exercice précédent' }))
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Écrit')
  })

  it('les flèches au bord sont désactivées tant que l\'exercice affiché est vierge', async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1')]) })
    await open('A/a.json')
    expect(screen.getByRole('button', { name: 'Exercice précédent' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Exercice suivant' })).toBeDisabled()
    await userEvent.setup().type(screen.getByLabelText("Énoncé de l'exercice"), 'x')
    expect(screen.getByRole('button', { name: 'Exercice suivant' })).toBeEnabled()
  })

  it('« Nouvel exercice » ajoute à la fin et s\'y place', async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1'), ex('2')]) })
    await open('A/a.json')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Nouvel exercice' }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('le numéro vide est remplacé par la position, et un numéro saisi est écrit', async () => {
    const fs = await setup({ 'A/a.json': sheetFile('Fiche', [ex('1'), ex('2')]) })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    const numero = screen.getByLabelText("Numéro de l'exercice (facultatif)")
    expect(numero).toHaveAttribute('placeholder', '2')
    await user.type(numero, '3.b')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices[1].numero).toBe('3.b')
  })

  it('supprime l\'exercice affiché après confirmation, et affiche le suivant', async () => {
    const fs = await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Un' }), ex('2', { enonce: 'Deux' }), ex('3', { enonce: 'Trois' })]) })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    await user.click(screen.getByRole('button', { name: "Supprimer l'exercice" }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Trois')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices.map((e: { id: string }) => e.id)).toEqual(['1', '3'])
  })

  it('annuler la confirmation ne supprime rien ; le dernier exercice affiché laisse le précédent', async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Un' }), ex('2', { enonce: 'Deux' })]) })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    await user.click(screen.getByRole('button', { name: "Supprimer l'exercice" }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: "Supprimer l'exercice" }))
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Un')
  })

  it('ne propose pas de supprimer l\'unique exercice d\'une fiche', async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1')]) })
    await open('A/a.json')
    expect(screen.getByRole('button', { name: "Supprimer l'exercice" })).toBeDisabled()
  })

  it('écrit l\'exercice courant en changeant de fichier', async () => {
    const fs = await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Un' }), ex('2')]), 'A/b.json': sheetFile('Autre', [ex('x')]) })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    await user.type(screen.getByLabelText('Réponse'), '42')
    await open('A/b.json')
    expect(stored(fs, 'A/a.json').exercices[1].reponse).toBe('42')
  })
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/ExerciseWorkspace.test.tsx; cd ../..`
Expected: FAIL (boutons et compteur absents).

- [ ] **Step 3: Implémenter dans `ExerciseWorkspace.tsx`**

Imports à ajouter / ajuster :

```tsx
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog } from '@suite/shared/ui'
import { isBlank } from './sheet'
```

Dans le composant, après `const [target, setTarget] = useState<InsertTarget>('none')`, ajouter :

```tsx
  const currentId = useOpenExercise(s => s.currentId)
  const [confirming, setConfirming] = useState(false)
```

L'effet qui remet à zéro le champ visé dépend maintenant aussi de l'exercice affiché :

```tsx
  // Un autre exercice, d'autres champs : l'ancien champ ne doit plus recevoir de signes.
  useEffect(() => {
    lastField.current = null
    setTarget('none')
  }, [selected, currentId])
```

Après les gardes (`if (status === 'unreadable' || exercise === null || sheet === null)`), calculer :

```tsx
  const position = sheet.exercices.findIndex(e => e.id === exercise.id) + 1
  const count = sheet.exercices.length
  const { step, addExercise, removeCurrent } = useOpenExercise.getState()
  // Au bord, la flèche crée un exercice : pas par-dessus un exercice encore vierge.
  const blank = isBlank(exercise)
```

Dans l'en-tête, remplacer l'`<input>` « Numéro » par la version avec placeholder de position :

```tsx
          placeholder={String(position)}
```

et ajouter, à la fin de la première ligne de l'en-tête (après l'input « Page »), le bloc de navigation :

```tsx
          <div role="group" aria-label="Navigation dans la fiche" style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
            <Button
              variant="ghost" size="icon-sm" aria-label="Exercice précédent"
              title={position === 1 && blank ? 'Écris dans cet exercice avant d\'en ajouter un avant' : 'Exercice précédent'}
              disabled={position === 1 && blank}
              onClick={() => step(-1)}
            ><ChevronLeft /></Button>
            <span aria-live="polite" style={{ fontSize: 13, minWidth: 44, textAlign: 'center' }}>{position} / {count}</span>
            <Button
              variant="ghost" size="icon-sm" aria-label="Exercice suivant"
              title={position === count && blank ? 'Écris dans cet exercice avant d\'en ajouter un après' : 'Exercice suivant'}
              disabled={position === count && blank}
              onClick={() => step(1)}
            ><ChevronRight /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Nouvel exercice" title="Nouvel exercice" onClick={addExercise}><Plus /></Button>
            <Button
              variant="ghost" size="icon-sm" aria-label="Supprimer l'exercice" title="Supprimer l'exercice"
              disabled={count <= 1}
              onClick={() => setConfirming(true)}
            ><Trash2 /></Button>
          </div>
```

Et juste avant la fermeture `</section>` :

```tsx
      <ConfirmDialog
        open={confirming}
        title="Supprimer cet exercice ?"
        description={`L'exercice ${exercise.numero.trim() === '' ? position : exercise.numero} sera effacé de la fiche « ${sheet.titre} ». Cette action est définitive.`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); removeCurrent() }}
      />
```
(Les imports de `Button` et de `ConfirmDialog` viennent de `@suite/shared/ui` ; vérifier qu'il n'y a pas déjà un import de ce module dans le fichier et fusionner.)

- [ ] **Step 4: Vérifier**

Run: `bunx tsc --noEmit -p apps/zachart-maths && cd apps/zachart-maths && bunx vitest run; cd ../..`
Expected: tsc sans erreur ; tous les tests de zachart-maths passent.

- [ ] **Step 5: Commit**

```bash
git add apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx apps/zachart-maths/src/exercises/ExerciseWorkspace.test.tsx
git commit -m "feat(zachart-maths): previous/next exercise with creation at the edge, new and delete exercise"
```

---

### Task 5: `SheetOutline`, la liste des exercices sous l'arbre

**Files:**
- Create: `apps/zachart-maths/src/exercises/SheetOutline.tsx`
- Create: `apps/zachart-maths/src/exercises/SheetOutline.test.tsx`
- Modify: `apps/zachart-maths/src/App.tsx`

**Interfaces:**
- Consumes: `useOpenExercise` (`sheet`, `currentId`, `goTo`).
- Produces: `SheetOutline()` : région « Exercices de la fiche », une ligne-bouton par exercice (`aria-current` sur l'exercice affiché), repliable ; rend `null` quand aucune fiche n'est ouverte.

- [ ] **Step 1: Écrire le test (échec attendu)**

```tsx
// apps/zachart-maths/src/exercises/SheetOutline.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SheetOutline } from './SheetOutline'
import { newExercise, type Sheet } from './types'
import { useOpenExercise } from './useOpenExercise'

const sheet: Sheet = {
  version: 2, id: 'f', titre: 'Fractions p.45',
  exercices: [
    { ...newExercise(), id: '1', numero: '3.b', page: '45', enonce: 'Calcule la somme\nde deux fractions', reponse: '7/12' },
    { ...newExercise(), id: '2', enonce: 'Simplifie' },
  ],
}
const openSheet = () =>
  useOpenExercise.setState({ path: 'A/a.json', sheet, currentId: '1', exercise: sheet.exercices[0], status: 'saved' })

describe('SheetOutline', () => {
  beforeEach(() => useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' }))

  it('ne montre rien tant qu\'aucune fiche n\'est ouverte', () => {
    const { container } = render(<SheetOutline />)
    expect(container).toBeEmptyDOMElement()
  })

  it('liste les exercices : numéro ou position, page, début d\'énoncé, coche si répondu', () => {
    openSheet()
    render(<SheetOutline />)
    const rows = within(screen.getByRole('region', { name: 'Exercices de la fiche' })).getAllByRole('button', { name: /^Exercice/ })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('3.b')
    expect(rows[0]).toHaveTextContent('p.45')
    expect(rows[0]).toHaveTextContent('Calcule la somme')
    expect(rows[0]).not.toHaveTextContent('de deux fractions')
    expect(within(rows[0]).getByLabelText('Réponse remplie')).toBeInTheDocument()
    expect(rows[1]).toHaveTextContent('2')
    expect(within(rows[1]).queryByLabelText('Réponse remplie')).toBeNull()
  })

  it('met en évidence l\'exercice affiché, et un clic en affiche un autre', async () => {
    openSheet()
    render(<SheetOutline />)
    const rows = screen.getAllByRole('button', { name: /^Exercice/ })
    expect(rows[0]).toHaveAttribute('aria-current', 'true')
    await userEvent.setup().click(rows[1])
    expect(useOpenExercise.getState().currentId).toBe('2')
  })

  it('se replie et se déplie', async () => {
    openSheet()
    render(<SheetOutline />)
    const toggle = screen.getByRole('button', { name: /Exercices de la fiche/ })
    await userEvent.setup().click(toggle)
    expect(screen.queryAllByRole('button', { name: /^Exercice/ })).toHaveLength(0)
    await userEvent.setup().click(toggle)
    expect(screen.getAllByRole('button', { name: /^Exercice/ })).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/SheetOutline.test.tsx; cd ../..`
Expected: FAIL (`./SheetOutline` introuvable).

- [ ] **Step 3: Implémenter**

```tsx
// apps/zachart-maths/src/exercises/SheetOutline.tsx
import { useState } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useOpenExercise } from './useOpenExercise'

/** La liste des exercices de la fiche ouverte, sous l'arbre des fichiers de la sidebar gauche. */
export function SheetOutline() {
  const sheet = useOpenExercise(s => s.sheet)
  const currentId = useOpenExercise(s => s.currentId)
  const [open, setOpen] = useState(true)
  if (sheet === null) return null

  return (
    <section
      aria-label="Exercices de la fiche"
      style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: '45%', minHeight: 0, borderTop: '1px solid var(--border)' }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', fontSize: 13, fontWeight: 600, textAlign: 'left' }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Exercices de la fiche
      </button>
      {open && (
        <ul style={{ margin: 0, padding: '0 0 8px', listStyle: 'none', overflowY: 'auto' }}>
          {sheet.exercices.map((exercise, i) => {
            const label = exercise.numero.trim() === '' ? String(i + 1) : exercise.numero
            const firstLine = exercise.enonce.split('\n')[0].trim()
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  aria-label={`Exercice ${label}`}
                  aria-current={exercise.id === currentId ? 'true' : undefined}
                  onClick={() => useOpenExercise.getState().goTo(exercise.id)}
                  className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[13px] hover:bg-accent aria-[current=true]:bg-accent"
                >
                  <strong style={{ minWidth: 20 }}>{label}</strong>
                  {exercise.page.trim() !== '' && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>p.{exercise.page}</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>
                    {firstLine}
                  </span>
                  {exercise.reponse.trim() !== '' && <Check size={14} aria-label="Réponse remplie" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```
(Note : `aria-label` du bouton remplace son contenu dans le nom accessible, donc les tests lisent le texte avec `toHaveTextContent`, pas avec le nom.)

Dans `apps/zachart-maths/src/App.tsx` : importer `import { SheetOutline } from './exercises/SheetOutline'` et remplacer, dans le panneau gauche, `<ExerciseTree />` par :

```tsx
            <ExerciseTree />
            <SheetOutline />
```

- [ ] **Step 4: Vérifier**

Run: `bunx tsc --noEmit -p apps/zachart-maths && cd apps/zachart-maths && bunx vitest run; cd ../..`
Expected: tsc sans erreur ; tests verts (`App.test.tsx` passe : le panneau gauche contient toujours sa région).

- [ ] **Step 5: Commit**

```bash
git add apps/zachart-maths/src/exercises/SheetOutline.tsx apps/zachart-maths/src/exercises/SheetOutline.test.tsx apps/zachart-maths/src/App.tsx
git commit -m "feat(zachart-maths): outline of the open sheet's exercises under the file tree"
```

---

### Task 6: Suppression d'un fichier : `ConfirmDialog` et nombre d'exercices

**Files:**
- Modify: `apps/zachart-maths/src/exercises/ExerciseTree.tsx`
- Modify: `apps/zachart-maths/src/exercises/ExerciseTree.test.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` ; `ExerciseEntry.exercices` (Task 3).

- [ ] **Step 1: Écrire le test (échec attendu)**

Dans `apps/zachart-maths/src/exercises/ExerciseTree.test.tsx`, après le test « demande confirmation avant de supprimer, et vide la sélection », ajouter :

```tsx
  it("annonce le nombre d'exercices avant de supprimer un fichier", async () => {
    const fiche = JSON.stringify({ version: 2, id: 'a', titre: 'Fiche', exercices: [{ id: '1' }, { id: '2' }, { id: '3' }] })
    const { user } = await setup({ 'Algèbre/f.json': fiche })
    await user.pointer({ keys: '[MouseRight]', target: await screen.findByRole('button', { name: 'Fiche' }) })
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer ce fichier ?' })
    expect(dialog).toHaveTextContent('« Fiche » et ses 3 exercice(s)')
  })
```

Le test existant de suppression ne cherche que le rôle `dialog` et le bouton « Supprimer » : il n'a pas à changer.

- [ ] **Step 2: Vérifier l'échec**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/ExerciseTree.test.tsx; cd ../..`
Expected: FAIL (le texte du dialogue n'annonce pas de nombre d'exercices).

- [ ] **Step 3: Implémenter**

Dans `ExerciseTree.tsx` :
- l'import `Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle` est remplacé par `ConfirmDialog` ; `Button` reste (le bouton « Nouveau chapitre » l'utilise) ;
- le type : `type Deletion = { kind: 'chapter'; chapter: string; count: number } | { kind: 'exercise'; path: string; titre: string; count: number }` ;
- à la création de la suppression d'un fichier : `setDeletion({ kind: 'exercise', path: exo.path, titre: exo.titre, count: exo.exercices })` ;
- le bloc `<Dialog …>…</Dialog>` final devient :

```tsx
      <ConfirmDialog
        open={deletion !== null}
        title={deletion?.kind === 'chapter' ? 'Supprimer ce chapitre ?' : 'Supprimer ce fichier ?'}
        description={
          deletion === null ? '' : `${
            deletion.kind === 'chapter'
              ? `« ${deletion.chapter} » et ses ${deletion.count} fichier(s) seront effacés du disque.`
              : `« ${deletion.titre} »${deletion.count > 0 ? ` et ses ${deletion.count} exercice(s)` : ''} seront effacés du disque.`
          } Cette action est définitive.`
        }
        onCancel={() => setDeletion(null)}
        onConfirm={confirmDeletion}
      />
```

- [ ] **Step 4: Vérifier**

Run: `bunx tsc --noEmit -p apps/zachart-maths && cd apps/zachart-maths && bunx vitest run; cd ../..`
Expected: tsc sans erreur ; tests verts.

- [ ] **Step 5: Commit**

```bash
git add apps/zachart-maths/src/exercises/ExerciseTree.tsx apps/zachart-maths/src/exercises/ExerciseTree.test.tsx
git commit -m "feat(zachart-maths): file deletion uses ConfirmDialog and announces its exercise count"
```

---

### Task 7: Documentation, spec à jour, vérification finale

**Files:**
- Modify: `CLAUDE.md` (racine)
- Modify: `docs/superpowers/specs/2026-10-03-plusieurs-exercices-par-fichier-design.md`

- [ ] **Step 1: `CLAUDE.md`**

- Ligne des points d'entrée publics : `@suite/shared/{ui,theme,update,shell,commands,settings,search}` devient `@suite/shared/{ui,theme,update,shell,commands,settings,search,math}` ; ajouter à la suite de la ligne sur la recherche Orama : `- Math is KaTeX (`@suite/shared/math`): `renderMathToHtml(latex, display?)`, bounded, never throws, `trust: false`, with `\ce`/`\pu` (mhchem).`
- Section Zach'Math, premier point (`exercises/`) : remplacer « An exercise is one `.json` file (`types.ts`, versioned) in a chapter folder » par « A file is a *sheet* (`Sheet` in `types.ts`, v2, `exercices[]`; v1 files are read as one-exercise sheets and only rewritten on the first edit) in a chapter folder ». Ajouter : « `sheet.ts` holds the pure operations (`insertExercise`, `neighbour`, `dropExercise`…); `useOpenExercise` loads the whole sheet and exposes the current exercise as `exercise`; `SheetOutline` lists the sheet under the tree. »

- [ ] **Step 2: Spec**

Dans le spec, section 2 : remplacer la première puce (`selected` devient `{ path, exerciseId }`) par « `useExerciseStore.selected` reste le chemin du fichier ; l'exercice affiché est `currentId` dans `useOpenExercise`, qui s'ouvre sur le premier exercice du fichier. » Section 3, dernière puce : remplacer « Changer d'exercice écrit tout de suite la fiche (comportement actuel du changement de fichier) » par « Changer d'exercice dans une fiche n'écrit rien de plus : la fiche entière est en mémoire et l'autosauvegarde l'écrit ; seul un changement de fichier l'écrit tout de suite ». Section « Erreurs » : remplacer la ligne « Supprimer l'exercice ouvert : l'écriture en attente est annulée… » par « Supprimer l'exercice ouvert : la fiche est réécrite sans lui par l'autosauvegarde habituelle. »

- [ ] **Step 3: Vérification finale**

Run: `bunx tsc --noEmit -p apps/zachart-maths && bunx tsc --noEmit -p apps/zachart-mentale && bunx tsc --noEmit -p packages/shared && bun run test:all`
Expected: tsc sans erreur ; `test`, `test:admin` et `test:scripts` passent. Un timeout isolé dans `zachart-mentale` (`SettingsDialog`) a déjà été vu une fois sans lien avec ce travail : le relancer seul avant de conclure à une régression.

Puis, une fois, à la main : `bun run --filter zachart-maths tauri dev`, ouvrir un fichier existant, vérifier le compteur « 1 / 1 », ajouter un exercice, naviguer, supprimer un exercice, supprimer un fichier. Dire ce qui a été vu, et ce qui ne l'a pas été.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-03-plusieurs-exercices-par-fichier-design.md
git commit -m "docs: sheet format v2 and @suite/shared/math in CLAUDE.md, spec aligned with the plan"
```
