# Zach'Math — zone de travail : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à la zone de travail de Zach'Math l'ergonomie de Zachar't Mentale (blocs condensés et animés, équation à deux membres, centre scindable en deux zones, clic droit, barre de symboles sur 2 colonnes).

**Architecture:** Le format de fichier gagne un champ facultatif `blocsB` (seconde zone) ; la logique d'équation de Mentale (`equationNav`, `equationStepIsSolved`) est déplacée dans `@suite/shared/math` et réutilisée par les deux apps ; l'UI de Maths est refaite autour d'une carte de bloc à gouttière, de `motion` pour l'animation et du `ContextMenu` partagé pour le clic droit.

**Tech Stack:** React 19, TypeScript, Bun workspaces, Vitest + Testing Library, `motion` (`motion/react`), MathLive, Radix `ContextMenu` via `@suite/shared/ui`, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-03-zachmath-zone-de-travail-design.md`

**Écart avec l'ordre de la spec :** la migration de l'équation (`latex`/`action` → `left`/`right`/`operation`) est faite dans la tâche 4, avec son éditeur, et non dans la tâche 1 : changer le type seul casserait `tsc` entre deux commits. Chaque commit reste vert.

## Global Constraints

- **React, pas Vue.** Textes d'interface et commentaires de code en **français**, commentaires `/** … */` explicatifs sur le « pourquoi », comme le code voisin.
- `packages/shared` **n'importe jamais** une app (`@/…`, `@app`, chemin qui sort de `packages/shared/src`) ; imports relatifs à l'intérieur de `shared` ; les apps n'importent que les points d'entrée publics (`@suite/shared/{ui,theme,update,shell,commands,settings,search,math}`). `src/boundary.test.ts` (shared et Maths) et `admin/src/boundary.test.ts` doivent rester verts.
- Rien sous `apps/zachart-mentale/admin/` n'importe `@tauri-apps/*` ; `@suite/shared/math` n'en touche aucun.
- Tout le disque de Maths passe par le port `ExerciseFs` ; aucune logique de fichier contre `@tauri-apps/plugin-fs`.
- Un bloc de type inconnu est **conservé tel quel**, jamais supprimé, dans l'une ou l'autre zone.
- Les anciennes fiches (v1, v2 sans `blocsB`, équations à `latex`) se lisent sans migration de disque ; le fichier n'est réécrit qu'à la première modification.
- Autosauvegarde : 600 ms (`AUTOSAVE_DELAY_MS`), inchangée.
- Commandes depuis la racine du dépôt. Tests d'un fichier : `cd apps/zachart-maths && bunx vitest run <fichier>` (idem `packages/shared`). Type-check : `bunx tsc --noEmit -p apps/zachart-maths` (ou `-p packages/shared`, `-p apps/zachart-mentale`).
- **Jamais** `git add -A` ni `git add -f` : toujours des chemins explicites. `apps/zachart-maths/src-tauri/Cargo.toml` est modifié dans l'arbre de travail, hors de ce chantier : ne pas l'ajouter.
- Message de commit : se termine par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branche : `feat/zachmath-zone-de-travail`.

## Review Focus

Entrées que la spec implique et qu'aucun test « chemin heureux » n'attrape ; chacune a un test dans la tâche indiquée.

1. Une fiche v2 **sans** `blocsB`, ou avec un `blocsB` qui n'est pas un tableau (fichier abîmé), doit s'ouvrir non scindée sans erreur — tâche 1.
2. Un ancien `latex` **sans `=`**, vide, ou avec **plusieurs `=`** ne doit rien perdre ni planter — tâche 4.
3. Un bloc de type **inconnu** : envoyable dans l'autre zone, duplicable, jamais « convertible » (l'entrée est absente du menu) — tâche 8.
4. **Réunir** les zones quand `blocsB` est vide ou quand la zone de gauche est vide : pas de bloc fantôme, pas de perte, l'ordre est gauche puis droite — tâche 1.
5. Une zone **vide** (dernier bloc supprimé, ou zone de droite fraîchement créée) garde ses boutons d'ajout et son clic droit « Ajouter un bloc » ; et `prefers-reduced-motion` supprime le glissement mais garde le halo — tâches 3, 5, 8.

---

### Task 1: Format de fichier — `blocsB` et opérations sur les zones

**Files:**
- Modify: `apps/zachart-maths/src/exercises/types.ts` (`Exercise`, `normalizeExercise`)
- Modify: `apps/zachart-maths/src/exercises/sheet.ts` (`isBlank`)
- Modify: `apps/zachart-maths/src/exercises/useOpenExercise.ts` (`ExerciseEdit`)
- Create: `apps/zachart-maths/src/exercises/zones.ts`
- Test: `apps/zachart-maths/src/exercises/zones.test.ts`, `apps/zachart-maths/src/exercises/types.test.ts` (ajouts)

**Interfaces:**
- Produces (utilisé par les tâches 6 et 8) :
  - `type Zone = 'a' | 'b'`
  - `isSplit(e: Exercise): boolean`
  - `splitZones(): { blocsB: unknown[] }` — le patch qui scinde
  - `mergeZones(e: Exercise): { blocs: unknown[]; blocsB: undefined }` — le patch qui réunit
  - `sendBlock(e: Exercise, id: string, from: Zone): { blocs: unknown[]; blocsB: unknown[] } | null`
  - `Exercise.blocsB?: unknown[]` ; `ExerciseEdit` accepte `blocsB`.

- [ ] **Step 1: Écrire les tests de `zones.ts`**

```ts
// apps/zachart-maths/src/exercises/zones.test.ts
import { describe, expect, it } from 'vitest'
import { mergeZones, sendBlock, splitZones, isSplit } from './zones'
import { newExercise, type Exercise } from './types'

const b = (id: string) => ({ id, type: 'texte', contenu: id })
const ex = (blocs: unknown[], blocsB?: unknown[]): Exercise => ({ ...newExercise(), blocs, ...(blocsB === undefined ? {} : { blocsB }) })

describe('zones', () => {
  it('un exercice est scindé si et seulement si blocsB existe, même vide', () => {
    expect(isSplit(ex([]))).toBe(false)
    expect(isSplit(ex([], []))).toBe(true)
    expect(splitZones()).toEqual({ blocsB: [] })
  })

  it('réunir met la zone de droite à la suite de celle de gauche et retire blocsB', () => {
    const merged = { ...ex([b('1'), b('2')], [b('3')]), ...mergeZones(ex([b('1'), b('2')], [b('3')])) }
    expect(merged.blocs.map(x => (x as { id: string }).id)).toEqual(['1', '2', '3'])
    expect(isSplit(merged)).toBe(false)
    expect('blocsB' in JSON.parse(JSON.stringify(merged))).toBe(false)
  })

  it('réunir une zone vide, ou depuis une gauche vide, ne laisse aucun bloc fantôme', () => {
    expect(mergeZones(ex([b('1')], [])).blocs).toEqual([b('1')])
    expect(mergeZones(ex([], [b('9')])).blocs).toEqual([b('9')])
    expect(mergeZones(ex([], [])).blocs).toEqual([])
  })

  it('envoie un bloc à la fin de l\'autre zone, dans les deux sens', () => {
    const e = ex([b('1'), b('2')], [b('3')])
    expect(sendBlock(e, '1', 'a')).toEqual({ blocs: [b('2')], blocsB: [b('3'), b('1')] })
    expect(sendBlock(e, '3', 'b')).toEqual({ blocs: [b('1'), b('2'), b('3')], blocsB: [] })
  })

  it('n\'envoie rien : exercice non scindé, ou bloc absent de la zone indiquée', () => {
    expect(sendBlock(ex([b('1')]), '1', 'a')).toBeNull()
    expect(sendBlock(ex([b('1')], []), '1', 'b')).toBeNull()
    expect(sendBlock(ex([b('1')], []), 'inconnu', 'a')).toBeNull()
  })

  it('envoie un bloc de type inconnu sans rien lui retirer', () => {
    const unknown = { id: 'u', type: 'futur', extra: { n: 1 } }
    expect(sendBlock(ex([unknown], []), 'u', 'a')!.blocsB).toEqual([unknown])
  })
})
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises/zones.test.ts`
Expected: FAIL (`./zones` introuvable).

- [ ] **Step 3: Ajouter `blocsB` au type et à la lecture**

Dans `types.ts`, dans `Exercise`, après `blocs: unknown[]` :

```ts
  /**
   * La seconde zone de travail, à droite. Présent (même vide) : l'exercice est scindé en deux
   * zones indépendantes ; absent : une seule zone. Les fiches écrites avant ce champ n'en ont pas.
   */
  blocsB?: unknown[]
```

Dans `types.ts`, remplacer le `return {…}` de `normalizeExercise` et ajouter un helper juste au-dessus :

```ts
/** Chaque bloc a un identifiant : sans lui, on ne pourrait ni le déplacer ni l'envoyer dans l'autre zone. */
const withIds = (blocs: unknown[]): unknown[] =>
  blocs.map(b => {
    if (typeof b !== 'object' || b === null || Array.isArray(b)) return b
    const id = (b as { id?: unknown }).id
    return typeof id === 'string' && id !== '' ? b : { ...b, id: crypto.randomUUID() }
  })
```

```ts
  const exercise: Exercise = {
    ...r,
    id,
    numero: text(r.numero),
    enonce: text(r.enonce),
    page: text(r.page),
    blocs: Array.isArray(r.blocs) ? withIds(r.blocs) : [],
    reponse: text(r.reponse),
    notes: text(r.notes),
  }
  // `...r` a laissé passer un `blocsB` qui n'est peut-être pas un tableau : seul un tableau compte.
  if (Array.isArray(r.blocsB)) exercise.blocsB = withIds(r.blocsB)
  else delete exercise.blocsB
  return exercise
```

Dans `sheet.ts`, `isBlank` : ajouter `&& (e.blocsB ?? []).length === 0`.

Dans `useOpenExercise.ts`, `ExerciseEdit` : ajouter `'blocsB'` à la liste du `Pick`.

- [ ] **Step 4: Écrire `zones.ts`**

```ts
// apps/zachart-maths/src/exercises/zones.ts
import type { Exercise } from './types'

/** Les deux zones de travail d'un exercice scindé : `a` à gauche (`blocs`), `b` à droite (`blocsB`). */
export type Zone = 'a' | 'b'

export const isSplit = (e: Exercise): boolean => e.blocsB !== undefined

/** Le patch qui scinde : la zone de droite naît vide. */
export const splitZones = (): { blocsB: unknown[] } => ({ blocsB: [] })

/**
 * Le patch qui réunit : la zone de droite est ajoutée sous celle de gauche, rien n'est perdu.
 * `blocsB: undefined` : la clé disparaît du fichier à l'écriture (JSON ignore `undefined`).
 */
export const mergeZones = (e: Exercise): { blocs: unknown[]; blocsB: undefined } => ({
  blocs: [...e.blocs, ...(e.blocsB ?? [])],
  blocsB: undefined,
})

const idOf = (block: unknown): unknown =>
  typeof block === 'object' && block !== null ? (block as { id?: unknown }).id : undefined

/** Le bloc `id` passe de la zone `from` à la fin de l'autre ; `null` si l'envoi n'a pas de sens. */
export function sendBlock(
  e: Exercise,
  id: string,
  from: Zone,
): { blocs: unknown[]; blocsB: unknown[] } | null {
  if (e.blocsB === undefined) return null
  const source = from === 'a' ? e.blocs : e.blocsB
  const target = from === 'a' ? e.blocsB : e.blocs
  const block = source.find(b => idOf(b) === id)
  if (block === undefined) return null
  const rest = source.filter(b => idOf(b) !== id)
  const moved = [...target, block]
  return from === 'a' ? { blocs: rest, blocsB: moved } : { blocs: moved, blocsB: rest }
}
```

- [ ] **Step 5: Ajouter les tests de lecture dans `types.test.ts`**

```ts
describe('blocsB à la lecture', () => {
  const file = (extra: object) => ({ version: 2, id: 's', titre: 'T', exercices: [{ id: 'e', blocs: [], ...extra }] })

  it('une fiche sans blocsB s\'ouvre non scindée', () => {
    expect(validateSheet(file({}))!.exercices[0].blocsB).toBeUndefined()
  })
  it('un blocsB qui n\'est pas un tableau est ignoré', () => {
    for (const bad of ['x', 3, null, {}]) {
      const e = validateSheet(file({ blocsB: bad }))!.exercices[0]
      expect('blocsB' in e).toBe(false)
    }
  })
  it('un blocsB vide garde l\'exercice scindé, et chaque bloc reçoit un id', () => {
    const e = validateSheet(file({ blocs: [{ type: 'texte' }], blocsB: [{ type: 'calcul', id: 'k' }] }))!.exercices[0]
    expect(e.blocsB).toHaveLength(1)
    expect((e.blocs[0] as { id: string }).id).toMatch(/.+/)
    expect(validateSheet(file({ blocsB: [] }))!.exercices[0].blocsB).toEqual([])
  })
})
```

(ajouter `validateSheet` à l'import existant de `./types` s'il n'y est pas.)

- [ ] **Step 6: Lancer tout le dossier, vérifier le vert, type-check**

Run: `cd apps/zachart-maths && bunx vitest run src/exercises && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths`
Expected: PASS, aucune erreur de type.

- [ ] **Step 7: Commit**

```bash
git add apps/zachart-maths/src/exercises/types.ts apps/zachart-maths/src/exercises/types.test.ts apps/zachart-maths/src/exercises/sheet.ts apps/zachart-maths/src/exercises/useOpenExercise.ts apps/zachart-maths/src/exercises/zones.ts apps/zachart-maths/src/exercises/zones.test.ts
git commit -m "feat(zachart-maths): second work zone (blocsB), merge and send operations"
```

---

### Task 2: Logique d'équation de Mentale → `@suite/shared/math`

**Files:**
- Create: `packages/shared/src/math/equationSteps.ts`, `packages/shared/src/math/equationNav.ts`
- Create (déplacés) : `packages/shared/src/math/equationSteps.test.ts`, `packages/shared/src/math/equationNav.test.ts`
- Modify: `packages/shared/src/math/index.ts`
- Modify: `apps/zachart-mentale/src/content/blocks.ts` (retrait de `BARE_VARIABLE`…`equationStepIsSolved`, lignes ~108-170), `BlockView.tsx`, `EquationEditor.tsx` (imports), `blocks.test.ts` (retrait des tests déplacés)
- Delete: `apps/zachart-mentale/src/content/equationNav.ts`, `equationNav.test.ts`

**Interfaces:**
- Produces (tâche 4) depuis `@suite/shared/math` :
  - `interface EquationStepLike { left: string; right: string; operation?: string }`
  - `isBareVariable(latex: string): boolean`, `equationStepIsSolved(steps: readonly EquationStepLike[], index: number): boolean`
  - `type EqField = 'left'|'right'|'operation'`, `EqPos`, `EqMove`, `EqColumn`, `EqTarget`
  - `operationVisible(steps, step)`, `readingOrder(steps)`, `navigate(steps, from, move, column)` — signatures et comportement **inchangés**.

Cette tâche est un déplacement : le comportement ne change pas, les tests existants le prouvent.

- [ ] **Step 1: Créer `equationSteps.ts`** — copier **à l'identique** (commentaires compris) de `apps/zachart-mentale/src/content/blocks.ts` : `BARE_VARIABLE`, `isBareVariable`, `normalizeIndexes`, `mentionsVariable`, `isolates`, `equationStepIsSolved` (de « Un identifiant seul » jusqu'à la fin de `equationStepIsSolved`). Seules différences, en tête du fichier et dans la signature :

```ts
// packages/shared/src/math/equationSteps.ts
/**
 * Une étape d'équation, vue par la logique pure : deux membres LaTeX et une opération facultative.
 * Le type d'une app (`EquationStep` de Mentale, de Maths) y est compatible sans en dépendre.
 */
export interface EquationStepLike {
  left: string
  right: string
  operation?: string
}

// … BARE_VARIABLE, isBareVariable, normalizeIndexes, mentionsVariable, isolates : verbatim …

export function equationStepIsSolved(steps: readonly EquationStepLike[], index: number): boolean {
  // … corps verbatim …
}
```

- [ ] **Step 2: Créer `equationNav.ts`** — `git mv apps/zachart-mentale/src/content/equationNav.ts packages/shared/src/math/equationNav.ts` puis remplacer les deux imports du haut par :

```ts
import { equationStepIsSolved, type EquationStepLike } from './equationSteps'
```

et `EquationStep[]` par `readonly EquationStepLike[]` dans les signatures (`operationVisible`, `readingOrder`, `navigate`).

- [ ] **Step 3: Déplacer les tests** — `git mv apps/zachart-mentale/src/content/equationNav.test.ts packages/shared/src/math/equationNav.test.ts` ; remplacer son import de type par `import type { EquationStepLike as EquationStep } from './equationSteps'`. Dans `blocks.test.ts` de Mentale, couper les `describe` de `isBareVariable` (≈ ligne 447) et d'`equationStepIsSolved` vers `packages/shared/src/math/equationSteps.test.ts` (import : `import { equationStepIsSolved, isBareVariable } from './equationSteps'`), puis retirer ces deux noms de l'import de `./blocks`.

- [ ] **Step 4: Exporter** — `packages/shared/src/math/index.ts` :

```ts
export { renderMathToHtml } from './renderMath'
export { equationStepIsSolved, isBareVariable, type EquationStepLike } from './equationSteps'
export {
  navigate, operationVisible, readingOrder,
  type EqColumn, type EqField, type EqMove, type EqPos, type EqTarget,
} from './equationNav'
```

- [ ] **Step 5: Brancher Mentale** — dans `blocks.ts`, supprimer la partie déplacée (aucun autre usage dans le fichier ; vérifier avec `grep -n "isBareVariable\|equationStepIsSolved\|mentionsVariable" apps/zachart-mentale/src/content/blocks.ts` → vide). `BlockView.tsx` : `import { blockGroups } from './blocks'` + `import { equationStepIsSolved } from '@suite/shared/math'`. `EquationEditor.tsx` : `equationStepIsSolved` et les imports de `./equationNav` viennent de `@suite/shared/math`. Vérifier : `grep -rn "equationNav'" apps/zachart-mentale` → vide.

- [ ] **Step 6: Vérifier tout ce que le déplacement touche**

Run: `cd packages/shared && bunx vitest run src/math src/boundary.test.ts && cd ../../apps/zachart-mentale && bunx vitest run src/content && cd ../.. && bun run test:admin && bunx tsc --noEmit -p packages/shared && bunx tsc --noEmit -p apps/zachart-mentale`
Expected: tout PASS (les tests déplacés passent dans `shared`, ceux de Mentale qui utilisent la logique restent verts, l'admin builde toujours).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/math apps/zachart-mentale/src/content/blocks.ts apps/zachart-mentale/src/content/blocks.test.ts apps/zachart-mentale/src/content/BlockView.tsx apps/zachart-mentale/src/content/EquationEditor.tsx
git add -u apps/zachart-mentale/src/content/equationNav.ts apps/zachart-mentale/src/content/equationNav.test.ts
git commit -m "refactor: move equation logic (equationNav, equationStepIsSolved) to @suite/shared/math"
```

---

### Task 3: Carte de bloc — gouttière, icônes, boutons d'ajout

**Files:**
- Create: `apps/zachart-maths/src/exercises/blockMeta.ts`, `apps/zachart-maths/src/exercises/BlockCard.tsx`
- Modify: `apps/zachart-maths/src/exercises/BlockStack.tsx`
- Test: `apps/zachart-maths/src/exercises/BlockStack.test.tsx` (ajouts)

**Interfaces:**
- Produces :
  - `BLOCK_META: Record<BlockType, { label: string; icon: LucideIcon; hue: number }>` (`blockMeta.ts`)
  - `<BlockCard block index count onMove onRemove halo? onHaloEnd? children />` — la section garde le nom accessible `Bloc ${label}, ${index+1} sur ${count}` et `data-block-id`.
  - `BlockStack` gagne la prop `label?: string` (défaut « Blocs de l'exercice »).

- [ ] **Step 1: Tests (ajouts à `BlockStack.test.tsx`)**

```tsx
it('chaque carte porte l\'icône de son type, et la gouttière tient les trois actions', () => {
  render(<Harness initial={[{ id: 'a', type: 'texte', contenu: '' }, { id: 'b', type: 'equation', etapes: [] }]} />)
  const [first, second] = screen.getAllByRole('region')
  expect(within(first).getByRole('img', { name: 'Texte' })).toBeInTheDocument()
  expect(within(second).getByRole('img', { name: 'Équation' })).toBeInTheDocument()
  const gutter = within(first).getByRole('group', { name: 'Actions du bloc' })
  expect(within(gutter).getAllByRole('button').map(b => b.getAttribute('aria-label')))
    .toEqual(['Monter le bloc', 'Descendre le bloc', 'Supprimer le bloc'])
})

it('les boutons d\'ajout ont une icône et le libellé du type', () => {
  render(<Harness />)
  const add = screen.getByRole('group', { name: 'Ajouter un bloc' })
  for (const label of ['Texte', 'Calcul', 'Tableau', 'Équation']) {
    const button = within(add).getByRole('button', { name: `Ajouter un bloc ${label}` })
    expect(button.querySelector('svg')).not.toBeNull()
    expect(button).toHaveTextContent(label)
  }
})

it('une zone vide garde ses boutons d\'ajout', async () => {
  const user = userEvent.setup()
  render(<Harness initial={[{ id: 'a', type: 'texte', contenu: '' }]} />)
  await user.click(screen.getByRole('button', { name: 'Supprimer le bloc' }))
  expect(screen.queryAllByRole('region')).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Ajouter un bloc Texte' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Lancer, vérifier l'échec** — `cd apps/zachart-maths && bunx vitest run src/exercises/BlockStack.test.tsx` → FAIL (pas de rôle `img`, pas de groupe « Actions du bloc »).

- [ ] **Step 3: `blockMeta.ts`**

```ts
// apps/zachart-maths/src/exercises/blockMeta.ts
import { Equal, Sigma, Table2, Type, type LucideIcon } from 'lucide-react'
import type { BlockType } from './blocks'

/** Ce qui distingue un type de bloc à l'écran : son libellé, son icône (celles de Mentale) et sa teinte. */
export const BLOCK_META: Record<BlockType, { label: string; icon: LucideIcon; hue: number }> = {
  texte: { label: 'Texte', icon: Type, hue: 215 },
  calcul: { label: 'Calcul', icon: Sigma, hue: 30 },
  tableau: { label: 'Tableau', icon: Table2, hue: 280 },
  equation: { label: 'Équation', icon: Equal, hue: 150 },
}
```

- [ ] **Step 4: `BlockCard.tsx`** (reprend `BlockCard` de `BlockStack.tsx`, qui est supprimé de ce fichier)

```tsx
// apps/zachart-maths/src/exercises/BlockCard.tsx
import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, HelpCircle, Trash2 } from 'lucide-react'
import { Button } from '@suite/shared/ui'
import { isKnown, type Block } from './blocks'
import { BLOCK_META } from './blockMeta'
import { borderOf, toneOf } from './toolbarCatalog'

interface BlockCardProps {
  block: Block
  index: number
  count: number
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  /** Vrai juste après un déplacement : le halo aide à retrouver le bloc du regard. */
  halo?: boolean
  onHaloEnd?: () => void
  children: ReactNode
}

/**
 * Une carte de bloc : la gouttière à gauche (icône du type, monter, descendre, supprimer) puis
 * le contenu. La gouttière est discrète tant qu'on ne survole ni ne focalise la carte.
 */
export function BlockCard({ block, index, count, onMove, onRemove, halo, onHaloEnd, children }: BlockCardProps) {
  const meta = isKnown(block) ? BLOCK_META[block.type] : null
  const label = meta?.label ?? 'Bloc inconnu'
  const Icon = meta?.icon ?? HelpCircle
  const hue = meta?.hue ?? 0
  return (
    <section
      aria-label={`Bloc ${label}, ${index + 1} sur ${count}`}
      data-block-id={block.id}
      className={`group/card${halo === true ? ' block-halo' : ''}`}
      onAnimationEnd={e => { if (e.target === e.currentTarget) onHaloEnd?.() }}
      style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}
    >
      <div
        role="group"
        aria-label="Actions du bloc"
        className="opacity-60 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 4, background: toneOf(hue), borderRight: `2px solid ${borderOf(hue)}` }}
      >
        <span role="img" aria-label={label} title={label} style={{ display: 'flex', padding: 4 }}><Icon size={16} /></span>
        <Button variant="ghost" size="icon-sm" aria-label="Monter le bloc" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Descendre le bloc" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Supprimer le bloc" onClick={onRemove}><Trash2 /></Button>
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: 8 }}>{children}</div>
    </section>
  )
}
```

- [ ] **Step 5: `BlockStack.tsx`** — retirer l'ancien `BlockCard` local et `LABELS`, importer `BlockCard` et `BLOCK_META`, ajouter la prop `label`, et remplacer le groupe d'ajout :

```tsx
// imports : ajouter
import { BlockCard } from './BlockCard'
import { BLOCK_META } from './blockMeta'
import { borderOf, toneOf } from './toolbarCatalog'

// signature
export function BlockStack({ value, onChange, label = "Blocs de l'exercice" }: {
  value: readonly unknown[]
  onChange: (blocs: Block[]) => void
  label?: string
}) {
// <ul aria-label={label} …>

      <div role="group" aria-label="Ajouter un bloc" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {BLOCK_TYPES.map(({ type }) => {
          const { label: name, icon: Icon, hue } = BLOCK_META[type]
          return (
            <Button
              key={type}
              variant="outline"
              size="sm"
              aria-label={`Ajouter un bloc ${name}`}
              onClick={() => add(type)}
              style={{ borderColor: borderOf(hue), background: toneOf(hue) }}
            >
              <Icon />{name}
            </Button>
          )
        })}
      </div>
```

(`BLOCK_TYPES` reste importé de `./blocks` ; `LABELS` n'a plus d'usage.)

- [ ] **Step 6: Vérifier** — `cd apps/zachart-maths && bunx vitest run src/exercises && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths` → PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/zachart-maths/src/exercises/blockMeta.ts apps/zachart-maths/src/exercises/BlockCard.tsx apps/zachart-maths/src/exercises/BlockStack.tsx apps/zachart-maths/src/exercises/BlockStack.test.tsx
git commit -m "feat(zachart-maths): block card with gutter and per-type icons, coloured add buttons"
```

---

### Task 4: Éditeurs calcul et équation (modèle de Mentale)

**Files:**
- Modify: `apps/zachart-maths/src/exercises/blocks.ts` (modèle d'étape, migration, `insertBlockAfter`)
- Modify: `apps/zachart-maths/src/exercises/equation.ts`, `equation.test.ts`, `blocks.test.ts`
- Create: `apps/zachart-maths/src/math/edgeMove.ts`, `edgeMove.test.ts`
- Modify: `apps/zachart-maths/src/math/MathField.tsx`
- Create: `apps/zachart-maths/src/exercises/eqTones.ts`, `CalcEditor.tsx`
- Modify (réécriture): `EquationEditor.tsx`, `EquationEditor.test.tsx`, `EquationEditor.raw.test.tsx`
- Modify: `BlockStack.tsx` (CalcEditor extrait, `insertBlockAfter`)

**Interfaces:**
- Consumes : `navigate, operationVisible, equationStepIsSolved, EqColumn, EqField` de `@suite/shared/math` (tâche 2).
- Produces :
  - `EquationStep { id: string; left: string; right: string; operation: string }` ; `newStep()`
  - `splitAtEquals(latex: string): { left: string; right: string }`
  - `insertBlockAfter(blocks: readonly Block[], id: string, type: BlockType): { blocks: Block[]; added: KnownBlock }`
  - `edgeMove(key, caret): EdgeMove | null`, `isFlatLatex(latex): boolean`
  - `MathField` : prop `onNavigate?: (move: EdgeMove) => void` ; `MathFieldHandle.focus(at?: 'start' | 'end')`.
  - `<CalcEditor block onChange onDone />`

**Sens de `operation`** : celle de l'étape *i* se lit **après** cette étape (entre *i* et *i+1*), comme dans Mentale. L'ancien `action` de l'étape *i+1* devient donc l'`operation` de l'étape *i*.

- [ ] **Step 1: Tests purs — `blocks.test.ts`** (adapter les tests d'équation existants à la forme `{ id, left, right, operation }` et ajouter) :

```ts
describe('équation : lecture d\'un ancien fichier', () => {
  const read = (etapes: unknown[]) => (parseBlocks([{ id: 'q', type: 'equation', etapes }])[0] as EquationBlock).etapes

  it('découpe un ancien latex sur le premier = et décale les actions', () => {
    expect(read([
      { id: 'a', action: '', latex: '2x+5=11' },
      { id: 'b', action: '− 5 des deux côtés', latex: '2x=6' },
    ])).toEqual([
      { id: 'a', left: '2x+5', right: '11', operation: '− 5 des deux côtés' },
      { id: 'b', left: '2x', right: '6', operation: '' },
    ])
  })
  it('un latex sans = tombe à gauche, un latex vide donne deux membres vides', () => {
    expect(read([{ id: 'a', latex: 'x+1' }])[0]).toMatchObject({ left: 'x+1', right: '' })
    expect(read([{ id: 'a', latex: '' }])[0]).toMatchObject({ left: '', right: '' })
  })
  it('plusieurs = : tout ce qui suit le premier reste dans le membre droit', () => {
    expect(read([{ id: 'a', latex: 'a=b=c' }])[0]).toMatchObject({ left: 'a', right: 'b=c' })
  })
  it('lit le nouveau format tel quel, et garde au moins une étape', () => {
    expect(read([{ id: 'a', left: 'x', right: '3', operation: 'ok' }])[0]).toEqual({ id: 'a', left: 'x', right: '3', operation: 'ok' })
    expect(read([])).toHaveLength(1)
  })
})

describe('splitAtEquals / insertBlockAfter', () => {
  it('splitAtEquals coupe au premier =', () => {
    expect(splitAtEquals(' 3x = 9 ')).toEqual({ left: '3x', right: '9' })
  })
  it('insère après le bloc visé, ou à la fin si l\'id est inconnu', () => {
    const base = [{ id: '1', type: 'texte', contenu: '' }, { id: '2', type: 'texte', contenu: '' }] as Block[]
    const r = insertBlockAfter(base, '1', 'calcul')
    expect(r.blocks.map(b => b.id)).toEqual(['1', r.added.id, '2'])
    expect(insertBlockAfter(base, 'zz', 'calcul').blocks.at(-1)!.type).toBe('calcul')
  })
})
```

`equation.test.ts` (remplacer) :

```ts
import { describe, expect, it } from 'vitest'
import { addStepAfter, patchStep, removeStep } from './equation'
import type { EquationStep } from './blocks'

const s = (id: string, left = '', right = '', operation = ''): EquationStep => ({ id, left, right, operation })

describe('equation', () => {
  it('ajoute une étape vide juste après l\'index', () => {
    const { steps, added } = addStepAfter([s('a'), s('b')], 0)
    expect(steps.map(x => x.id)).toEqual(['a', added.id, 'b'])
    expect(added).toMatchObject({ left: '', right: '', operation: '' })
  })
  it('retire une étape, jamais la dernière restante', () => {
    expect(removeStep([s('a'), s('b')], 'a').map(x => x.id)).toEqual(['b'])
    expect(removeStep([s('a')], 'a')).toHaveLength(1)
    expect(removeStep([s('a'), s('b')], 'zz')).toHaveLength(2)
  })
  it('retirer la dernière étape efface l\'opération de la nouvelle dernière : elle ne mène plus nulle part', () => {
    const next = removeStep([s('a', '', '', 'op'), s('b')], 'b')
    expect(next[0].operation).toBe('')
  })
  it('modifie un membre ou l\'opération', () => {
    expect(patchStep([s('a')], 'a', { left: 'x' })[0].left).toBe('x')
    expect(patchStep([s('a')], 'a', { operation: '+1' })[0].operation).toBe('+1')
  })
})
```

`edgeMove.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { edgeMove, isFlatLatex } from './edgeMove'

const caret = (over: object = {}) => ({ atStart: false, atEnd: false, collapsed: true, flat: true, ...over })

describe('edgeMove', () => {
  it('quitte à gauche seulement caret au début et sans sélection', () => {
    expect(edgeMove('ArrowLeft', caret({ atStart: true }))).toBe('left')
    expect(edgeMove('ArrowLeft', caret())).toBeNull()
    expect(edgeMove('ArrowLeft', caret({ atStart: true, collapsed: false }))).toBeNull()
  })
  it('quitte à droite seulement caret à la fin', () => {
    expect(edgeMove('ArrowRight', caret({ atEnd: true }))).toBe('right')
    expect(edgeMove('ArrowRight', caret())).toBeNull()
  })
  it('haut et bas quittent un champ à plat, pas une fraction', () => {
    expect(edgeMove('ArrowUp', caret())).toBe('up')
    expect(edgeMove('ArrowDown', caret({ flat: false }))).toBeNull()
  })
  it('ignore les autres touches', () => expect(edgeMove('a', caret({ atStart: true }))).toBeNull())
  it('isFlatLatex : faux dès qu\'une structure 2D est ouverte', () => {
    expect(isFlatLatex('2x+5')).toBe(true)
    expect(isFlatLatex('\\frac{1}{2}')).toBe(false)
    expect(isFlatLatex('x^{2}')).toBe(false)
    expect(isFlatLatex('\\sqrt{x}')).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer, vérifier l'échec** — `cd apps/zachart-maths && bunx vitest run src/exercises/blocks.test.ts src/exercises/equation.test.ts src/math/edgeMove.test.ts` → FAIL.

- [ ] **Step 3: `blocks.ts`** — remplacer le modèle d'étape et sa lecture :

```ts
/**
 * Une résolution pas à pas, comme dans Zachar't Mentale : chaque étape a deux membres LaTeX
 * (`left = right`) et `operation` est ce que l'élève fait POUR PASSER à l'étape suivante
 * (« − 5 des deux côtés »), écrit entre les deux étapes.
 */
export interface EquationStep { id: string; left: string; right: string; operation: string }

export const newStep = (): EquationStep => ({ id: crypto.randomUUID(), left: '', right: '', operation: '' })

/** Coupe au premier `=` ; sans `=`, tout est à gauche. Sert à relire les anciennes fiches (une ligne LaTeX par étape). */
export function splitAtEquals(latex: string): { left: string; right: string } {
  const i = latex.indexOf('=')
  return i < 0
    ? { left: latex.trim(), right: '' }
    : { left: latex.slice(0, i).trim(), right: latex.slice(i + 1).trim() }
}

type Raw = Record<string, unknown>
/** Une étape de l'ancien format : `latex` seul, sans membres. */
const isLegacyStep = (r: Raw) => !('left' in r) && !('right' in r)

/**
 * Au moins une étape, des identifiants uniques. Une étape de l'ancien format (`latex`, `action`
 * AVANT l'étape) est découpée sur son premier `=`, et son `action` devient l'`operation` de
 * l'étape précédente. Rien n'est écrit ici : la fiche ne change sur le disque qu'à l'édition.
 */
function normalizeSteps(raw: unknown): EquationStep[] {
  const items = (Array.isArray(raw) ? raw : []).filter((x): x is Raw => typeof x === 'object' && x !== null)
  const seen = new Set<string>()
  const steps = items.map((r, i): EquationStep => {
    let id = typeof r.id === 'string' && r.id !== '' ? r.id : crypto.randomUUID()
    if (seen.has(id)) id = crypto.randomUUID()
    seen.add(id)
    if (!isLegacyStep(r)) return { id, left: str(r.left), right: str(r.right), operation: str(r.operation) }
    const next = items[i + 1]
    return { id, ...splitAtEquals(str(r.latex)), operation: next !== undefined && isLegacyStep(next) ? str(next.action) : '' }
  })
  return steps.length === 0 ? [newStep()] : steps
}

/** Insère un bloc juste après `id` (à la fin si `id` est inconnu) ; `added` est le bloc créé. */
export function insertBlockAfter(blocks: readonly Block[], id: string, type: BlockType): { blocks: Block[]; added: KnownBlock } {
  const added = newBlock(type)
  const at = blocks.findIndex(b => b.id === id)
  const next = [...blocks]
  next.splice(at < 0 ? next.length : at + 1, 0, added)
  return { blocks: next, added }
}
```

`equation.ts` :

```ts
import { newStep, type EquationStep } from './blocks'

/** Ajoute une étape vide juste après `index` ; retourne la nouvelle liste et l'étape créée. */
export function addStepAfter(steps: readonly EquationStep[], index: number): { steps: EquationStep[]; added: EquationStep } {
  const added = newStep()
  const next = [...steps]
  next.splice(index + 1, 0, added)
  return { steps: next, added }
}

/**
 * Retire une étape. La dernière ne part jamais (un bloc équation a toujours une ligne). Retirer
 * la dernière étape efface l'opération de la précédente : elle menait à une étape qui n'existe plus.
 */
export function removeStep(steps: readonly EquationStep[], id: string): EquationStep[] {
  const index = steps.findIndex(s => s.id === id)
  if (steps.length <= 1 || index < 0) return [...steps]
  const next = steps.filter(s => s.id !== id)
  if (index === steps.length - 1) next[next.length - 1] = { ...next[next.length - 1], operation: '' }
  return next
}

export const patchStep = (steps: readonly EquationStep[], id: string, patch: Partial<Pick<EquationStep, 'left' | 'right' | 'operation'>>): EquationStep[] =>
  steps.map(s => (s.id === id ? { ...s, ...patch } : s))
```

- [ ] **Step 4: `edgeMove.ts`**

```ts
// apps/zachart-maths/src/math/edgeMove.ts
export type EdgeMove = 'left' | 'right' | 'up' | 'down'

export interface CaretState {
  atStart: boolean
  atEnd: boolean
  /** Aucune sélection : une flèche sur une sélection la réduit, elle ne quitte pas le champ. */
  collapsed: boolean
  /** Pas de fraction, racine ou exposant ouverts : ↑/↓ n'ont rien à faire à l'intérieur. */
  flat: boolean
}

/** Où une flèche mène HORS du champ ; `null` quand le champ la garde pour lui (déplacement du curseur). */
export function edgeMove(key: string, caret: CaretState): EdgeMove | null {
  switch (key) {
    case 'ArrowLeft': return caret.collapsed && caret.atStart ? 'left' : null
    case 'ArrowRight': return caret.collapsed && caret.atEnd ? 'right' : null
    case 'ArrowUp': return caret.flat ? 'up' : null
    case 'ArrowDown': return caret.flat ? 'down' : null
    default: return null
  }
}

/** Dans une fraction, une racine ou un exposant, MathLive utilise ↑/↓ pour changer de zone : on les lui laisse. */
export const isFlatLatex = (latex: string): boolean =>
  !/\\(?:d?frac|tfrac|binom|sqrt|left|right|over|begin)(?![a-zA-Z])|[\^_]\{/.test(latex)
```

- [ ] **Step 5: `MathField.tsx`** — brancher `onNavigate` et `focus(at)`.

Étendre le type : `MathfieldElement = HTMLElement & { value: string; insert?: …; position?: number; lastOffset?: number; selectionIsCollapsed?: boolean; executeCommand?: (command: string) => void }`. `MathFieldHandle.focus: (at?: 'start' | 'end') => void`. Ajouter `import { edgeMove, isFlatLatex, type EdgeMove } from './edgeMove'`, la prop `onNavigate?: (move: EdgeMove) => void` (et dans `latest`), puis :

```tsx
  useImperativeHandle(ref, () => ({
    focus(at) {
      const field = fieldRef.current
      if (field !== null) {
        field.focus()
        if (at !== undefined) field.executeCommand?.(at === 'end' ? 'moveToMathfieldEnd' : 'moveToMathfieldStart')
        return
      }
      const raw = rawRef.current
      if (raw === null) return
      raw.focus()
      if (at !== undefined) raw.setSelectionRange(at === 'end' ? raw.value.length : 0, at === 'end' ? raw.value.length : 0)
    },
  }), [])
```

Dans l'écouteur `keydown` de MathLive, **avant** les tests `Enter`/`Backspace` :

```ts
      const { onNavigate } = latest.current
      if (onNavigate !== undefined && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const move = edgeMove(event.key, {
          atStart: field.position === 0,
          atEnd: typeof field.lastOffset === 'number' && field.position === field.lastOffset,
          collapsed: field.selectionIsCollapsed !== false,
          flat: isFlatLatex(field.value),
        })
        if (move !== null) { event.preventDefault(); onNavigate(move); return }
      }
```

Dans le `onKeyDown` du textarea brut, même appel avec `selectionStart/End` (`atStart: s === 0`, `atEnd: s === latex.length`, `collapsed: s === e`, `flat: true`) et `onNavigate` lu directement de ses props.

- [ ] **Step 6: `eqTones.ts`, `CalcEditor.tsx`**

```ts
// apps/zachart-maths/src/exercises/eqTones.ts
/** Les teintes de Mentale : membre gauche bleu, membre droit ambre, résultat vert. */
const tone = (color: string) => ({
  borderColor: `color-mix(in oklch, ${color}, transparent 30%)`,
  background: `color-mix(in oklch, ${color}, transparent 92%)`,
})
export const LEFT_TONE = tone('#3a6bb0')
export const RIGHT_TONE = tone('#b8791f')
export const SOLVED_TONE = tone('#2f8f5b')
export const BOX = { border: '1.5px solid', borderRadius: 10, padding: '6px 10px' } as const
```

```tsx
// apps/zachart-maths/src/exercises/CalcEditor.tsx
import { useRef } from 'react'
import type { CalcBlock } from './blocks'
import { BOX, LEFT_TONE, SOLVED_TONE } from './eqTones'

/**
 * Le bloc Calcul : `expression = résultat`, deux cases colorées. Entrée passe de l'expression au
 * résultat, puis demande le bloc suivant (`onDone`).
 */
export function CalcEditor({ block, onChange, onDone }: {
  block: CalcBlock
  onChange: (patch: Partial<CalcBlock>) => void
  onDone: () => void
}) {
  const result = useRef<HTMLInputElement>(null)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        aria-label="Calcul"
        value={block.expression}
        onChange={e => onChange({ expression: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); result.current?.focus() } }}
        className="flex-1 font-mono text-sm"
        style={{ ...BOX, ...LEFT_TONE, minWidth: 0 }}
      />
      <span aria-hidden>=</span>
      <input
        ref={result}
        aria-label="Résultat du calcul"
        value={block.resultat}
        onChange={e => onChange({ resultat: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onDone() } }}
        className="font-mono text-sm"
        style={{ ...BOX, ...SOLVED_TONE, width: 130 }}
      />
    </div>
  )
}
```

- [ ] **Step 7: Réécrire `EquationEditor.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@suite/shared/ui'
import { equationStepIsSolved, navigate, operationVisible, type EqColumn, type EqField } from '@suite/shared/math'
import { MathField, type MathFieldHandle } from '../math/MathField'
import type { EdgeMove } from '../math/edgeMove'
import type { EquationBlock } from './blocks'
import { addStepAfter, patchStep, removeStep } from './equation'
import { BOX, LEFT_TONE, RIGHT_TONE, SOLVED_TONE } from './eqTones'

type At = 'start' | 'end'
const keyOf = (id: string, field: EqField) => `${id}:${field}`

/**
 * Le bloc Équation, comme dans Mentale : deux membres par étape, l'opération écrite entre deux
 * étapes, et la ligne qui passe au vert quand la variable est isolée.
 *
 * Clavier : les flèches sortent d'un champ au bord (`navigate` donne la cible) ; Tab suit l'ordre
 * du DOM, qui EST l'ordre de lecture ; Entrée ajoute une étape ; Retour arrière dans un membre
 * vide revient au membre précédent, puis supprime l'étape quand elle est entièrement vide.
 */
export function EquationEditor({ block, onChange }: { block: EquationBlock; onChange: (patch: Partial<EquationBlock>) => void }) {
  const { etapes } = block
  const fields = useRef(new Map<string, { focus: (at?: At) => void }>())
  const column = useRef<EqColumn>('left')
  // La cible à focaliser une fois rendue : le champ d'une étape qu'on vient d'ajouter n'existe pas encore.
  const pending = useRef<{ id: string; field: EqField; at?: At } | null>(null)

  const setSteps = (next: typeof etapes) => onChange({ etapes: next })
  useEffect(() => {
    const target = pending.current
    if (target === null) return
    pending.current = null
    fields.current.get(keyOf(target.id, target.field))?.focus(target.at)
  })

  const addAfter = (index: number) => {
    const { steps, added } = addStepAfter(etapes, index)
    pending.current = { id: added.id, field: 'left' }
    setSteps(steps)
  }
  const remove = (index: number) => {
    // Le curseur retourne sur l'étape d'au-dessus, là où l'élève écrivait juste avant.
    const previous = etapes[index - 1] ?? etapes[index + 1]
    pending.current = previous === undefined ? null : { id: previous.id, field: 'left', at: 'end' }
    setSteps(removeStep(etapes, etapes[index].id))
  }
  const go = (step: number, field: EqField, move: EdgeMove) => {
    const target = navigate(etapes, { step, field }, move, column.current)
    if (typeof target === 'string') return // sortie du bloc : on ne piège pas le clavier
    fields.current.get(keyOf(etapes[target.pos.step].id, target.pos.field))?.focus(target.at)
  }
  const register = (id: string, field: EqField) => (handle: { focus: (at?: At) => void } | null) => {
    if (handle === null) fields.current.delete(keyOf(id, field))
    else fields.current.set(keyOf(id, field), handle)
  }

  const member = (i: number, field: 'left' | 'right') => {
    const step = etapes[i]
    const other = field === 'left' ? step.right : step.left
    return (
      <MathField
        ref={register(step.id, field) as React.Ref<MathFieldHandle>}
        latex={step[field]}
        ariaLabel={`Membre ${field === 'left' ? 'gauche' : 'droit'} de l'étape ${i + 1}`}
        onChange={latex => setSteps(patchStep(etapes, step.id, { [field]: latex }))}
        onEnter={() => addAfter(i)}
        onNavigate={move => go(i, field, move)}
        onBackspaceWhenEmpty={() => {
          if (field === 'right') fields.current.get(keyOf(step.id, 'left'))?.focus('end')
          else if (other === '' && etapes.length > 1) remove(i)
        }}
      />
    )
  }

  return (
    <ol aria-label="Étapes de la résolution" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {etapes.map((step, i) => {
        const solved = equationStepIsSolved(etapes, i)
        const boxes = solved ? { ...BOX, ...SOLVED_TONE } : null
        return (
          <li key={step.id}>
            <div
              role="group"
              aria-label={`Étape ${i + 1}`}
              data-solved={solved}
              onFocusCapture={e => {
                const label = (e.target as HTMLElement).getAttribute('aria-label') ?? ''
                if (label.startsWith('Membre gauche')) column.current = 'left'
                else if (label.startsWith('Membre droit')) column.current = 'right'
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, ...(boxes ?? {}) }}
            >
              <div style={{ flex: 1, minWidth: 0, ...(solved ? {} : { ...BOX, ...LEFT_TONE }) }}>{member(i, 'left')}</div>
              <span aria-hidden>=</span>
              <div style={{ flex: 1, minWidth: 0, ...(solved ? {} : { ...BOX, ...RIGHT_TONE }) }}>{member(i, 'right')}</div>
              <Button variant="ghost" size="icon-sm" aria-label={`Supprimer l'étape ${i + 1}`} disabled={etapes.length <= 1} onClick={() => remove(i)}><X /></Button>
            </div>
            {operationVisible(etapes, i) && (
              <input
                ref={el => register(step.id, 'operation')(el === null ? null : {
                  focus: at => {
                    el.focus()
                    const n = at === 'end' ? el.value.length : 0
                    el.setSelectionRange(n, n)
                  },
                })}
                aria-label={`Opération après l'étape ${i + 1}`}
                placeholder="Ce que je fais : ex. − 5 des deux côtés"
                value={step.operation}
                onChange={e => setSteps(patchStep(etapes, step.id, { operation: e.target.value }))}
                onKeyDown={e => {
                  if (e.isComposing || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
                  const el = e.currentTarget
                  const collapsed = el.selectionStart === el.selectionEnd
                  if (e.key === 'Enter') { e.preventDefault(); addAfter(i) }
                  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); go(i, 'operation', e.key === 'ArrowUp' ? 'up' : 'down') }
                  else if (e.key === 'ArrowLeft' && collapsed && el.selectionStart === 0) { e.preventDefault(); go(i, 'operation', 'left') }
                  else if (e.key === 'ArrowRight' && collapsed && el.selectionStart === el.value.length) { e.preventDefault(); go(i, 'operation', 'right') }
                }}
                className="mt-1 ml-4 w-[calc(100%-1rem)] rounded border bg-background px-2 py-1 text-sm italic"
              />
            )}
          </li>
        )
      })}
      <li>
        <Button variant="outline" size="xs" onClick={() => addAfter(etapes.length - 1)}><Plus />Étape</Button>
      </li>
    </ol>
  )
}
```

- [ ] **Step 8: Tests des éditeurs** — remplacer `EquationEditor.test.tsx` et `EquationEditor.raw.test.tsx`. Conserver le `vi.mock('mathlive', …)` existant (élément `math-field` avec `value`, `insert`, `tabIndex = 0`), en y ajoutant `position = 0; lastOffset = 0`. Tests à écrire (le helper `Harness` prend `etapes` initiales au nouveau format ; `mathField(label)` = `screen.findByLabelText(label)`) :

```tsx
const steps = (...s: [string, string, string?][]) => s.map(([left, right, operation = ''], i) => ({ id: `s${i}`, left, right, operation }))

it('affiche les deux membres de chaque étape et répercute la saisie', async () => {
  render(<Harness etapes={steps(['2x+5', '11'])} />)
  const left = await mathField("Membre gauche de l'étape 1")
  expect(left.value).toBe('2x+5')
  expect((await mathField("Membre droit de l'étape 1")).value).toBe('11')
  type(left, '2x+6')
  expect(current.etapes[0].left).toBe('2x+6')
})

it('la dernière étape passe au vert quand la variable est isolée', async () => {
  render(<Harness etapes={steps(['2x+5', '11'], ['x', '3'])} />)
  await mathField("Membre gauche de l'étape 2")
  expect(screen.getByRole('group', { name: 'Étape 2' })).toHaveAttribute('data-solved', 'true')
  expect(screen.getByRole('group', { name: 'Étape 1' })).toHaveAttribute('data-solved', 'false')
})

it('Entrée ajoute une étape sous celle-ci, curseur dans son membre gauche', async () => {
  render(<Harness etapes={steps(['x', '1'])} />)
  fireEvent.keyDown(await mathField("Membre gauche de l'étape 1"), { key: 'Enter' })
  expect(current.etapes).toHaveLength(2)
  await waitFor(async () => expect(await mathField("Membre gauche de l'étape 2")).toHaveFocus())
})

it('↓ depuis un membre à plat va à l\'opération, ↓ encore à l\'étape suivante', async () => {
  render(<Harness etapes={steps(['2x', '8'], ['x', '4'])} />)
  fireEvent.keyDown(await mathField("Membre gauche de l'étape 1"), { key: 'ArrowDown' })
  expect(screen.getByLabelText("Opération après l'étape 1")).toHaveFocus()
  fireEvent.keyDown(screen.getByLabelText("Opération après l'étape 1"), { key: 'ArrowDown' })
  await waitFor(async () => expect(await mathField("Membre gauche de l'étape 2")).toHaveFocus())
})

it('→ au bord droit d\'un membre passe au membre droit', async () => {
  render(<Harness etapes={steps(['x', '1'])} />)
  const left = await mathField("Membre gauche de l'étape 1")
  Object.assign(left, { position: 1, lastOffset: 1 })
  fireEvent.keyDown(left, { key: 'ArrowRight' })
  expect(await mathField("Membre droit de l'étape 1")).toHaveFocus()
})

it('Retour arrière : membre droit vide → membre gauche ; étape entièrement vide → supprimée', async () => {
  render(<Harness etapes={steps(['x', ''], ['', ''])} />)
  fireEvent.keyDown(await mathField("Membre droit de l'étape 1"), { key: 'Backspace' })
  expect(await mathField("Membre gauche de l'étape 1")).toHaveFocus()
  fireEvent.keyDown(await mathField("Membre gauche de l'étape 2"), { key: 'Backspace' })
  expect(current.etapes).toHaveLength(1)
})

it('l\'opération après la dernière étape est cachée quand l\'étape est résolue et vide', async () => {
  render(<Harness etapes={steps(['x', '3'])} />)
  await mathField("Membre gauche de l'étape 1")
  expect(screen.queryByLabelText("Opération après l'étape 1")).not.toBeInTheDocument()
})

it('l\'ordre du DOM est l\'ordre de lecture : Tab le suit sans piéger', async () => {
  render(<Harness etapes={steps(['a', 'b'], ['c', 'd'])} />)
  await mathField("Membre gauche de l'étape 1")
  const labels = [...document.querySelectorAll('[aria-label^="Membre"], [aria-label^="Opération"]')].map(e => e.getAttribute('aria-label'))
  expect(labels).toEqual([
    "Membre gauche de l'étape 1", "Membre droit de l'étape 1", "Opération après l'étape 1",
    "Membre gauche de l'étape 2", "Membre droit de l'étape 2",
  ])
})
```

`EquationEditor.raw.test.tsx` : même `vi.mock` qui lève ; `Harness` avec `etapes: [{ id: 'a', left: '', right: '', operation: '' }]` ; taper `\frac{{1}{{2}` dans `Membre gauche de l'étape 1 (LaTeX)` → `current.etapes[0].left === '\\frac{1}{2}'`, aperçu `.katex` présent, `{Enter}` crée une étape et `Membre gauche de l'étape 2 (LaTeX)` reçoit le focus.

Test du calcul (dans `BlockStack.test.tsx`) :

```tsx
it('calcul : Entrée passe au résultat, puis crée un bloc Calcul juste en dessous', async () => {
  const user = userEvent.setup()
  render(<Harness initial={[{ id: 'a', type: 'calcul', expression: '', resultat: '' }]} />)
  await user.type(screen.getByLabelText('Calcul'), '3×4{Enter}')
  expect(screen.getByLabelText('Résultat du calcul')).toHaveFocus()
  await user.keyboard('12{Enter}')
  expect(names()).toEqual(['Bloc Calcul, 1 sur 2', 'Bloc Calcul, 2 sur 2'])
  await waitFor(() => expect(screen.getAllByLabelText('Calcul')[1]).toHaveFocus())
})
```

- [ ] **Step 9: `BlockStack.tsx`** — supprimer le `CalcEditor` local, importer celui du fichier dédié, et transmettre `onDone` ; ajouter l'insertion après un bloc :

```tsx
// editorFor reçoit (block, onChange, onDone)
case 'calcul': return <CalcEditor block={block} onChange={onChange} onDone={onDone} />

// dans le composant
const insertAfter = (id: string, type: BlockType) => {
  const r = insertBlockAfter(blocks, id, type)
  toFocus.current = r.added.id
  onChange(r.blocks)
}
// à l'appel : editorFor(block, patch => …, () => insertAfter(block.id, 'calcul'))
```

(`import { insertBlockAfter, … } from './blocks'`.)

- [ ] **Step 10: Vérifier** — `cd apps/zachart-maths && bunx vitest run && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths` → PASS. Si `tsc` signale d'autres usages de `latex`/`action` (`grep -rn "\.latex\|\.action" apps/zachart-maths/src`), les adapter au nouveau modèle.

- [ ] **Step 11: Commit**

```bash
git add apps/zachart-maths/src/exercises/blocks.ts apps/zachart-maths/src/exercises/blocks.test.ts apps/zachart-maths/src/exercises/equation.ts apps/zachart-maths/src/exercises/equation.test.ts apps/zachart-maths/src/exercises/eqTones.ts apps/zachart-maths/src/exercises/CalcEditor.tsx apps/zachart-maths/src/exercises/EquationEditor.tsx apps/zachart-maths/src/exercises/EquationEditor.test.tsx apps/zachart-maths/src/exercises/EquationEditor.raw.test.tsx apps/zachart-maths/src/exercises/BlockStack.tsx apps/zachart-maths/src/exercises/BlockStack.test.tsx apps/zachart-maths/src/math/edgeMove.ts apps/zachart-maths/src/math/edgeMove.test.ts apps/zachart-maths/src/math/MathField.tsx
git commit -m "feat(zachart-maths): calc and equation editors on Mentale's model (two members, operation, solved row)"
```

---

### Task 5: Animation de déplacement et halo

**Files:**
- Modify: `apps/zachart-maths/package.json` (dépendance `motion`)
- Modify: `apps/zachart-maths/src/exercises/BlockStack.tsx`, `apps/zachart-maths/src/index.css`
- Test: `apps/zachart-maths/src/exercises/BlockStack.test.tsx` (ajout), `apps/zachart-maths/src/exercises/BlockStack.motion.test.tsx` (nouveau)

**Interfaces:**
- Consumes : `BlockCard` `halo`/`onHaloEnd` (tâche 3).
- Produces : `BlockStack` gagne `arrivedId?: string | null` (bloc arrivé de l'autre zone : fondu d'entrée, halo, curseur) — utilisé par la tâche 6. Le `<li>` porte `data-slide="on" | "off"`.

- [ ] **Step 1: Dépendance** — dans `apps/zachart-maths/package.json`, `dependencies` : `"motion": "^13.2.0"` (même version que `shared` et Mentale), puis `bun install` à la racine.

- [ ] **Step 2: Tests**

Ajout à `BlockStack.test.tsx` :

```tsx
it('le bloc déplacé reçoit un halo et garde sa place dans le DOM (sans être recréé)', async () => {
  const user = userEvent.setup()
  render(<Harness initial={[{ id: 'a', type: 'texte', contenu: '' }, { id: 'b', type: 'calcul' }]} />)
  const second = screen.getAllByRole('region')[1]
  await user.click(within(second).getByRole('button', { name: 'Monter le bloc' }))
  const moved = document.querySelector('[data-block-id="b"]')!
  expect(moved.classList.contains('block-halo')).toBe(true)
  expect(document.querySelector('[data-block-id="a"]')!.classList.contains('block-halo')).toBe(false)
  expect(names()[0]).toMatch(/Calcul/)
})

it('un bloc arrivé de l\'autre zone reçoit halo et curseur', () => {
  render(<BlockStack value={[{ id: 'z', type: 'texte', contenu: '' }]} onChange={() => {}} arrivedId="z" />)
  expect(document.querySelector('[data-block-id="z"]')!.classList.contains('block-halo')).toBe(true)
  expect(screen.getByLabelText('Texte')).toHaveFocus()
})
```

`BlockStack.motion.test.tsx` :

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BlockStack } from './BlockStack'

// Le système demande « réduire les animations » : motion le lit à la première utilisation du hook.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query.includes('prefers-reduced-motion'), media: query, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
}))

describe('BlockStack avec « réduire les animations »', () => {
  it('ne fait plus glisser les cartes, mais garde le halo', () => {
    render(<BlockStack value={[{ id: 'a', type: 'texte', contenu: '' }]} onChange={() => {}} arrivedId="a" />)
    expect(document.querySelector('li')!.getAttribute('data-slide')).toBe('off')
    expect(document.querySelector('[data-block-id="a"]')!.classList.contains('block-halo')).toBe(true)
  })
})
```

- [ ] **Step 3: Lancer, vérifier l'échec** (`block-halo` absent).

- [ ] **Step 4: CSS** — dans `index.css` :

```css
/*
 * Le halo d'un bloc qu'on vient de déplacer : un anneau qui s'éteint en 600 ms, pour retrouver
 * le bloc du regard. Il reste sous « réduire les animations » : c'est un repère, pas un mouvement.
 */
@keyframes block-halo {
  from { box-shadow: 0 0 0 4px color-mix(in oklab, var(--ring) 80%, transparent); }
  to { box-shadow: 0 0 0 0 transparent; }
}
.block-halo {
  animation: block-halo 600ms ease-out;
}
```

- [ ] **Step 5: `BlockStack.tsx`**

```tsx
import { motion, useReducedMotion } from 'motion/react'

// props : ajouter arrivedId
export function BlockStack({ value, onChange, label = "Blocs de l'exercice", arrivedId = null }: {
  value: readonly unknown[]; onChange: (blocs: Block[]) => void; label?: string
  /** Le bloc qui vient de l'autre zone : fondu d'entrée, halo et curseur. */
  arrivedId?: string | null
}) {
  const reduced = useReducedMotion()
  const [halo, setHalo] = useState<string | null>(arrivedId)

  // Un bloc arrivé de l'autre zone : halo, et le curseur y entre pour qu'on continue d'écrire.
  useEffect(() => {
    if (arrivedId === null) return
    setHalo(arrivedId)
    toFocus.current = arrivedId
  }, [arrivedId])
  // …l'effet de focus existant (sur [blocks]) doit aussi dépendre de arrivedId : ajouter arrivedId à son tableau.

  const move = (id: string, delta: -1 | 1) => { setHalo(id); onChange(moveBlock(blocks, id, delta)) }
```

(l'effet de focus existant `[blocks]` devient `[blocks, arrivedId]`, et `toFocus` doit être déclaré **avant** le nouvel effet.)

Rendu de chaque bloc : remplacer `<BlockCard …>` dans le `map` par

```tsx
<motion.li
  key={block.id}
  // `position` : seule la place anime, jamais la taille — une carte qui s'agrandit ne s'étire pas.
  layout={reduced ? false : 'position'}
  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
  initial={block.id === arrivedId ? { opacity: 0 } : false}
  animate={{ opacity: 1 }}
  data-slide={reduced ? 'off' : 'on'}
>
  <BlockCard … halo={halo === block.id} onHaloEnd={() => setHalo(null)} onMove={delta => move(block.id, delta)} …>
```

et remplacer `<li>` par `</motion.li>` en fermeture (le `<li>` est désormais dans `BlockStack`, retiré de `BlockCard` — **`BlockCard` rend déjà une `<section>` sans `<li>`**, donc rien à retirer côté carte). Il n'y a volontairement **pas** d'animation de sortie : une sortie retarderait le démontage (et donc les tests et la suppression) pour peu de gain ; le bloc qui part d'une zone disparaît, celui qui arrive apparaît en fondu avec le halo.

- [ ] **Step 6: Vérifier** — `cd apps/zachart-maths && bunx vitest run && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths` → PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/zachart-maths/package.json bun.lock apps/zachart-maths/src/exercises/BlockStack.tsx apps/zachart-maths/src/exercises/BlockStack.test.tsx apps/zachart-maths/src/exercises/BlockStack.motion.test.tsx apps/zachart-maths/src/index.css
git commit -m "feat(zachart-maths): animated block moves with halo, honouring reduced motion"
```

(si le fichier de verrou s'appelle autrement — `bun.lockb` — l'ajouter à la place ; `git status --short` le montre.)

---

### Task 6: Zone de réponse, focus, « scinder » et deux zones

**Files:**
- Modify: `apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx`
- Test: `apps/zachart-maths/src/exercises/ExerciseWorkspace.test.tsx` (ajouts + adaptations)

**Interfaces:**
- Consumes : `isSplit`, `splitZones`, `mergeZones`, `sendBlock`, `Zone` (tâche 1) ; `BlockStack` `label`, `arrivedId` (tâches 3, 5).
- Produces : `BlockStack` gagne `onSend?: (id: string) => void` (câblé au clic droit en tâche 8, déclaré ici pour que le workspace le passe) — **ne pas l'implémenter côté UI ici** : seulement le type et le passage de prop, sans effet jusqu'à la tâche 8.

- [ ] **Step 1: Tests (ajouts)**

```tsx
describe('disposition en deux zones et zone de réponse', () => {
  const twoSheets = () => ({ 'Ch/f.json': sheetFile('F', [ex('e1', { enonce: 'Q1', blocs: [{ id: 'b1', type: 'texte', contenu: 'x' }] }), ex('e2')]) })

  it('« scinder » crée la zone de droite vide ; « réunir » remet ses blocs à la suite', async () => {
    const user = userEvent.setup()
    await setup(twoSheets()); await open('Ch/f.json')
    await user.click(await screen.findByRole('button', { name: 'Scinder la zone de travail en deux' }))
    expect(useOpenExercise.getState().exercise!.blocsB).toEqual([])
    expect(screen.getByRole('group', { name: 'Zone de travail de droite' })).toBeInTheDocument()
    // un bloc dans la zone de droite, puis on réunit
    useOpenExercise.getState().edit({ blocsB: [{ id: 'b2', type: 'texte', contenu: 'y' }] })
    await user.click(screen.getByRole('button', { name: 'Réunir les zones de travail' }))
    const e = useOpenExercise.getState().exercise!
    expect(e.blocs.map(b => (b as { id: string }).id)).toEqual(['b1', 'b2'])
    expect(e.blocsB).toBeUndefined()
  })

  it('la zone de droite vide garde ses boutons d\'ajout', async () => {
    const user = userEvent.setup()
    await setup(twoSheets()); await open('Ch/f.json')
    await user.click(await screen.findByRole('button', { name: 'Scinder la zone de travail en deux' }))
    const right = screen.getByRole('group', { name: 'Zone de travail de droite' })
    await user.click(within(right).getByRole('button', { name: 'Ajouter un bloc Texte' }))
    expect(useOpenExercise.getState().exercise!.blocsB).toHaveLength(1)
    expect(useOpenExercise.getState().exercise!.blocs).toHaveLength(1)
  })

  it('le bouton du bas passe à l\'exercice suivant, puis crée un exercice au dernier, curseur dans l\'énoncé', async () => {
    const user = userEvent.setup()
    await setup(twoSheets()); await open('Ch/f.json')
    await user.click(await screen.findByRole('button', { name: 'Exercice suivant', description: /.*/ }))
    expect(useOpenExercise.getState().currentId).toBe('e2')
    // e2 est vierge au dernier rang : rien à créer par-dessus, le bouton est désactivé
    expect(screen.getByRole('button', { name: 'Nouvel exercice' })).toBeDisabled()
    await user.type(screen.getByLabelText("Énoncé de l'exercice"), 'Q2')
    await user.click(screen.getByRole('button', { name: 'Nouvel exercice' }))
    expect(useOpenExercise.getState().sheet!.exercices).toHaveLength(3)
    await waitFor(() => expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveFocus())
  })

  it('le bouton « Nouvel exercice » n\'est plus dans l\'en-tête', async () => {
    await setup(twoSheets()); await open('Ch/f.json')
    await screen.findByRole('button', { name: 'Exercice suivant' })
    const header = document.querySelector('header')!
    expect(within(header).queryByRole('button', { name: 'Nouvel exercice' })).toBeNull()
  })
})
```

Adapter les anciens tests qui cliquaient « Nouvel exercice » dans l'en-tête : il vit maintenant dans la zone de réponse, et il applique la règle « pas par-dessus un exercice vierge » (le bouton est désactivé tant que le dernier exercice est vide). Écrire un énoncé avant le clic.

- [ ] **Step 2: Lancer, vérifier l'échec.**

- [ ] **Step 3: `ExerciseWorkspace.tsx`** — modifications (les hooks restent **avant** les `return` anticipés : y placer les nouveaux `useRef`/`useState`/`useEffect`).

Imports : `Columns2` (lucide), `ChevronRight`, `isSplit, mergeZones, sendBlock, splitZones, type Zone` de `./zones`.

Nouveaux hooks, à côté des existants :

```tsx
  const enonce = useRef<HTMLTextAreaElement>(null)
  /** Vrai quand une action vient de créer un exercice : le curseur va dans son énoncé, qu'on remplit d'abord. */
  const focusEnonce = useRef(false)
  const [arrived, setArrived] = useState<{ zone: Zone; id: string } | null>(null)

  useEffect(() => {
    if (!focusEnonce.current) return
    focusEnonce.current = false
    enonce.current?.focus()
  }, [currentId])
  // Changer d'exercice : le « bloc arrivé » de l'ancien n'a plus de sens.
  useEffect(() => setArrived(null), [currentId])
```

Helper (hors rendu, après les hooks) :

```tsx
  /** Avance d'un exercice ; si l'action en a créé un (au bord de la fiche), le curseur ira dans son énoncé. */
  const advance = (delta: -1 | 1) => {
    const count = () => useOpenExercise.getState().sheet?.exercices.length ?? 0
    const before = count()
    useOpenExercise.getState().step(delta)
    if (count() > before) focusEnonce.current = true
  }
```

JSX : dans l'en-tête, remplacer `onClick={() => step(-1)}` / `step(1)` par `advance(-1)` / `advance(1)`, **supprimer** le bouton `Plus` « Nouvel exercice » (et l'import `Plus` s'il n'est plus utilisé). Remplacer le `<textarea>` de l'énoncé par une ligne :

```tsx
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <textarea
            ref={enonce}
            aria-label="Énoncé de l'exercice"
            placeholder="Quelle est la question ?"
            value={exercise.enonce}
            rows={Math.max(2, exercise.enonce.split('\n').length)}
            onChange={e => edit({ enonce: e.target.value })}
            className={`${field} w-full`}
          />
          <Button
            variant={split ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-pressed={split}
            aria-label={split ? 'Réunir les zones de travail' : 'Scinder la zone de travail en deux'}
            title={split ? 'Réunir les zones de travail' : 'Scinder la zone de travail en deux'}
            onClick={() => edit(split ? mergeZones(exercise) : splitZones())}
          ><Columns2 /></Button>
        </div>
```

avec `const split = isSplit(exercise)` après le calcul de `position`. Centre :

```tsx
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Toolbar target={target} onSymbol={insertSymbol} />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'grid', gridTemplateColumns: split ? '1fr 1fr' : '1fr', gap: split ? 1 : 0, background: split ? 'var(--border)' : undefined }}>
          <div role="group" aria-label={split ? 'Zone de travail de gauche' : 'Zone de travail'} style={{ minWidth: 0, minHeight: 0, overflowY: 'auto', padding: 16, background: 'var(--background)' }}>
            <BlockStack
              value={exercise.blocs}
              onChange={blocs => edit({ blocs })}
              onSend={split ? id => send('a', id) : undefined}
              arrivedId={arrived?.zone === 'a' ? arrived.id : null}
            />
          </div>
          {split && (
            <div role="group" aria-label="Zone de travail de droite" style={{ minWidth: 0, minHeight: 0, overflowY: 'auto', padding: 16, background: 'var(--background)' }}>
              <BlockStack
                label="Blocs de la zone de droite"
                value={exercise.blocsB ?? []}
                onChange={blocsB => edit({ blocsB })}
                onSend={id => send('b', id)}
                arrivedId={arrived?.zone === 'b' ? arrived.id : null}
              />
            </div>
          )}
        </div>
      </div>
```

avec :

```tsx
  const send = (from: Zone, id: string) => {
    const patch = sendBlock(exercise, id, from)
    if (patch === null) return
    edit(patch)
    setArrived({ zone: from === 'a' ? 'b' : 'a', id })
  }
```

Pied de page : sous le `<p role=status…>`, ajouter le bouton, aligné à droite :

```tsx
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <Button
            variant="outline" size="sm"
            aria-label={position < count ? 'Exercice suivant' : 'Nouvel exercice'}
            title={position === count && blank ? "Écris dans cet exercice avant d'en ajouter un après" : undefined}
            disabled={position === count && blank}
            onClick={() => advance(1)}
          >
            {position < count ? <>Exercice suivant<ChevronRight /></> : <>Nouvel exercice<Plus /></>}
          </Button>
        </div>
```

(`Plus` reste importé pour ce bouton ; retirer l'import `Plus` **n'est donc pas** à faire.) Ajouter à `BlockStack` la prop `onSend?: (id: string) => void` dans sa signature, sans l'utiliser encore (le lint « variable inutilisée » est évité en la passant dans les props destructurées seulement en tâche 8 : ici, la déclarer dans le type suffit).

- [ ] **Step 4: Vérifier** — `cd apps/zachart-maths && bunx vitest run && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx apps/zachart-maths/src/exercises/ExerciseWorkspace.test.tsx apps/zachart-maths/src/exercises/BlockStack.tsx
git commit -m "feat(zachart-maths): split work zone, next/new exercise in the answer area, enonce focus on creation"
```

---

### Task 7: Barre de symboles sur 2 colonnes

**Files:**
- Modify: `apps/zachart-maths/src/exercises/Toolbar.tsx`
- Test: `apps/zachart-maths/src/exercises/Toolbar.test.tsx` (nouveau)

- [ ] **Step 1: Test**

```tsx
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Toolbar } from './Toolbar'
import { SYMBOL_FAMILIES } from './toolbarCatalog'

describe('Toolbar', () => {
  it('range les signes de chaque famille sur deux colonnes, familles groupées', () => {
    render(<Toolbar target="text" onSymbol={() => {}} />)
    for (const family of SYMBOL_FAMILIES) {
      const group = screen.getByRole('group', { name: family.name })
      expect(group.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
      expect(within(group).getAllByRole('button')).toHaveLength(family.symbols.length)
    }
  })
})
```

- [ ] **Step 2: Lancer, vérifier l'échec** (`gridTemplateColumns` vide).

- [ ] **Step 3: `Toolbar.tsx`** — largeur de la barre : `width: 84` → `width: 104` ; le conteneur de chaque famille :

```tsx
        <div key={family.name} role="group" aria-label={family.name} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', justifyItems: 'center', gap: 3, padding: 4, borderRadius: 8, background: toneOf(family.hue) }}>
```

Mettre à jour le commentaire de tête (« verticale, **sur deux colonnes**, une couleur par famille »).

- [ ] **Step 4: Vérifier** — `cd apps/zachart-maths && bunx vitest run src/exercises` → PASS. **Contrôle visuel** (jsdom ne mesure pas la mise en page) : `bun run --filter zachart-maths dev`, vérifier que chaque famille tient sur deux colonnes sans débordement horizontal et que la barre défile verticalement.

- [ ] **Step 5: Commit**

```bash
git add apps/zachart-maths/src/exercises/Toolbar.tsx apps/zachart-maths/src/exercises/Toolbar.test.tsx
git commit -m "feat(zachart-maths): symbol toolbar on two columns"
```

---

### Task 8: Clic droit à trois niveaux

**Files:**
- Create: `apps/zachart-maths/src/exercises/BlockContextMenu.tsx`, `FieldContextMenu.tsx`, `EmptyAreaContextMenu.tsx`, `symbolInsert.ts`
- Modify: `apps/zachart-maths/src/exercises/blocks.ts` (`duplicateBlock`, `convertBlock`, `blockToPlain`), `BlockStack.tsx`, `CalcEditor.tsx`, `EquationEditor.tsx`, `ExerciseWorkspace.tsx`
- Test: `apps/zachart-maths/src/exercises/blocks.test.ts` (ajouts), `apps/zachart-maths/src/exercises/ContextMenus.test.tsx` (nouveau)

**Interfaces:**
- Consumes : `ContextMenu*` de `@suite/shared/ui` ; `BLOCK_META` ; `onSend`/`isSplit` (tâche 6) ; `SYMBOL_FAMILIES`.
- Produces :
  - `duplicateBlock(blocks, id): { blocks: Block[]; added: Block } ` (nouveaux ids pour le bloc et ses étapes ; fonctionne sur un bloc inconnu, copie verbatim)
  - `convertBlock(block: KnownBlock, to: BlockType): KnownBlock` (même `id`)
  - `SymbolInsertContext: Context<((symbol: SymbolEntry) => void) | null>`
  - `<FieldContextMenu kind="text" | "math">`, `<BlockContextMenu …>`, `<EmptyAreaContextMenu …>`.

**Règle de propagation (comme Mentale) :** chaque niveau appelle `event.stopPropagation()` sur son `onContextMenu`, donc un clic droit dans un champ n'ouvre que le menu du champ, sur un bloc (hors champ) que celui du bloc, et sur le vide que celui de la zone.

- [ ] **Step 1: Tests purs (`blocks.test.ts`)**

```ts
describe('duplicateBlock', () => {
  it('copie le bloc juste après lui avec de nouveaux ids, étapes comprises', () => {
    const eq: Block = { id: 'q', type: 'equation', etapes: [{ id: 's', left: 'x', right: '1', operation: '' }] }
    const { blocks, added } = duplicateBlock([eq], 'q')
    expect(blocks).toHaveLength(2)
    expect(added.id).not.toBe('q')
    expect((added as EquationBlock).etapes[0]).toMatchObject({ left: 'x', right: '1' })
    expect((added as EquationBlock).etapes[0].id).not.toBe('s')
  })
  it('copie un bloc de type inconnu tel quel, hors son id', () => {
    const u: Block = { id: 'u', type: 'futur', extra: { n: 1 } }
    const { added } = duplicateBlock([u], 'u')
    expect(added).toMatchObject({ type: 'futur', extra: { n: 1 } })
    expect(added.id).not.toBe('u')
  })
})

describe('convertBlock', () => {
  const calc: KnownBlock = { id: 'c', type: 'calcul', expression: '3×4', resultat: '12' }
  it('garde l\'id et le contenu lisible d\'un type à l\'autre', () => {
    expect(convertBlock(calc, 'texte')).toEqual({ id: 'c', type: 'texte', contenu: '3×4 = 12' })
    expect(convertBlock({ id: 't', type: 'texte', contenu: '2x = 8' }, 'calcul')).toEqual({ id: 't', type: 'calcul', expression: '2x', resultat: '8' })
    const eq = convertBlock({ id: 't', type: 'texte', contenu: '2x+5=11\nx=3' }, 'equation') as EquationBlock
    expect(eq.etapes.map(s => [s.left, s.right])).toEqual([['2x+5', '11'], ['x', '3']])
  })
  it('vers le même type ou un contenu vide : un bloc valide, jamais d\'exception', () => {
    expect(convertBlock(calc, 'calcul')).toEqual(calc)
    expect((convertBlock({ id: 't', type: 'texte', contenu: '' }, 'equation') as EquationBlock).etapes).toHaveLength(1)
    expect((convertBlock({ id: 't', type: 'texte', contenu: '' }, 'tableau') as TableBlock).cellules.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Implémenter dans `blocks.ts`**

```ts
/** Le contenu d'un bloc en texte brut : ce qu'on garde en le convertissant vers un autre type. */
export function blockToPlain(block: KnownBlock): string {
  switch (block.type) {
    case 'texte': return block.contenu
    case 'calcul': return block.resultat === '' ? block.expression : `${block.expression} = ${block.resultat}`
    case 'tableau': return block.cellules.map(row => row.join('\t')).join('\n')
    case 'equation': return block.etapes.map(s => `${s.left} = ${s.right}`).join('\n')
  }
}

/** Change le type d'un bloc en gardant son id et ce qu'il disait. Vers le même type : le bloc tel quel. */
export function convertBlock(block: KnownBlock, to: BlockType): KnownBlock {
  if (block.type === to) return block
  const plain = blockToPlain(block)
  const lines = plain.split('\n').filter(l => l.trim() !== '')
  switch (to) {
    case 'texte': return { id: block.id, type: 'texte', contenu: plain }
    case 'calcul': {
      const { left, right } = splitAtEquals(lines[0] ?? '')
      return { id: block.id, type: 'calcul', expression: left, resultat: right }
    }
    case 'equation': {
      const etapes = lines.map(l => ({ id: crypto.randomUUID(), ...splitAtEquals(l), operation: '' }))
      return { id: block.id, type: 'equation', etapes: etapes.length > 0 ? etapes : [newStep()] }
    }
    case 'tableau': return { id: block.id, type: 'tableau', cellules: normalizeCells(plain.split('\n').map(l => l.split('\t'))) }
  }
}

/** Copie un bloc juste après lui, avec de nouveaux ids (le sien et ceux de ses étapes). */
export function duplicateBlock(blocks: readonly Block[], id: string): { blocks: Block[]; added: Block } {
  const at = blocks.findIndex(b => b.id === id)
  if (at < 0) return { blocks: [...blocks], added: blocks[0] }
  const copy = structuredClone(blocks[at]) as Block
  copy.id = crypto.randomUUID()
  if (copy.type === 'equation') (copy as EquationBlock).etapes = (copy as EquationBlock).etapes.map(s => ({ ...s, id: crypto.randomUUID() }))
  const next = [...blocks]
  next.splice(at + 1, 0, copy)
  return { blocks: next, added: copy }
}
```

(`normalizeCells` borne et rectifie déjà : un contenu vide donne bien un tableau 1×1 au moins.)

- [ ] **Step 3: Tests des menus (`ContextMenus.test.tsx`)**

```tsx
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BlockStack } from './BlockStack'
import type { Block } from './blocks'

let current: unknown[] = []
function Harness({ initial, onSend, split }: { initial: unknown[]; onSend?: (id: string) => void; split?: boolean }) {
  const [value, setValue] = useState(initial)
  current = value
  return <BlockStack value={value} onChange={(b: Block[]) => setValue(b)} onSend={onSend} split={split} onToggleSplit={() => {}} />
}
const two = [{ id: 'a', type: 'texte', contenu: 'A' }, { id: 'b', type: 'calcul', expression: '', resultat: '' }]
const menuItem = (name: RegExp) => screen.findByRole('menuitem', { name })

describe('clic droit', () => {
  it('sur un bloc : monter, descendre, dupliquer, supprimer ; « monter » grisé au premier', async () => {
    render(<Harness initial={two} />)
    fireEvent.contextMenu(screen.getAllByRole('region')[0], {})   // hors champ : la gouttière
    expect(await menuItem(/Monter/)).toHaveAttribute('aria-disabled', 'true')
    expect(await menuItem(/Descendre/)).not.toHaveAttribute('aria-disabled', 'true')
    expect(await menuItem(/Dupliquer/)).toBeInTheDocument()
    expect(await menuItem(/Supprimer/)).toBeInTheDocument()
  })

  it('« Dupliquer » insère une copie juste en dessous', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    fireEvent.contextMenu(screen.getAllByRole('region')[0])
    await user.click(await menuItem(/Dupliquer/))
    expect(current).toHaveLength(3)
    expect((current[1] as { contenu: string }).contenu).toBe('A')
  })

  it('« Changer de type » convertit ; absent sur un bloc de type inconnu', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness initial={[{ id: 'u', type: 'futur' }]} />)
    fireEvent.contextMenu(screen.getByRole('region'))
    await screen.findByRole('menuitem', { name: /Supprimer/ })
    expect(screen.queryByRole('menuitem', { name: /Changer de type/ })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /Dupliquer/ })).not.toBeNull()
    unmount()
    render(<Harness initial={two} />)
    fireEvent.contextMenu(screen.getAllByRole('region')[0])
    await user.click(await menuItem(/Changer de type/))
    await user.click(await menuItem(/Calcul/))
    expect((current[0] as { type: string }).type).toBe('calcul')
  })

  it('« Envoyer dans l\'autre zone » n\'apparaît que si l\'exercice est scindé, et appelle onSend', async () => {
    const user = userEvent.setup()
    const sent: string[] = []
    const { unmount } = render(<Harness initial={two} />)
    fireEvent.contextMenu(screen.getAllByRole('region')[0])
    await screen.findByRole('menuitem', { name: /Supprimer/ })
    expect(screen.queryByRole('menuitem', { name: /autre zone/ })).toBeNull()
    unmount()
    render(<Harness initial={two} onSend={id => sent.push(id)} />)
    fireEvent.contextMenu(screen.getAllByRole('region')[1])
    await user.click(await menuItem(/autre zone/))
    expect(sent).toEqual(['b'])
  })

  it('dans un champ : couper/copier/coller seulement, pas le menu du bloc', async () => {
    render(<Harness initial={two} />)
    fireEvent.contextMenu(screen.getByLabelText('Texte'))
    expect(await menuItem(/Copier/)).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Dupliquer/ })).toBeNull()
  })

  it('sur le vide, même d\'une zone vide : ajouter un bloc de chaque type', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[]} />)
    fireEvent.contextMenu(screen.getByTestId('zone-vide'))
    await user.click(await menuItem(/Équation/))
    expect((current[0] as { type: string }).type).toBe('equation')
  })

  it('sur le vide : scinder / réunir selon l\'état', async () => {
    const { rerender } = render(<Harness initial={[]} split={false} />)
    fireEvent.contextMenu(screen.getByTestId('zone-vide'))
    expect(await menuItem(/Scinder/)).toBeInTheDocument()
    rerender(<Harness initial={[]} split />)
  })
})
```

- [ ] **Step 4: Lancer, vérifier l'échec.**

- [ ] **Step 5: `symbolInsert.ts`**

```ts
// apps/zachart-maths/src/exercises/symbolInsert.ts
import { createContext } from 'react'
import type { SymbolEntry } from './toolbarCatalog'

/** Insère un signe dans le dernier champ où l'élève a écrit : c'est `insertSymbol` du workspace, offert au clic droit. */
export const SymbolInsertContext = createContext<((symbol: SymbolEntry) => void) | null>(null)
```

- [ ] **Step 6: `FieldContextMenu.tsx`** — version propre à Maths (copie allégée de celle de Mentale : sans correcteur orthographique ni raccourcis affichés ; l'unification est le sujet du cycle 2).

```tsx
import { useContext, useRef, type ReactNode } from 'react'
import { ClipboardPaste, Copy, Scissors, Sigma, TextSelect } from 'lucide-react'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@suite/shared/ui'
import { insertAtCursor, isTextField } from './insertAtCursor'
import { isMathField, type MathfieldElement } from '../math/MathField'
import { SymbolInsertContext } from './symbolInsert'
import { SYMBOL_FAMILIES } from './toolbarCatalog'

const editableIn = (wrapper: HTMLElement) => wrapper.querySelector<HTMLElement>('textarea, input, math-field')

/**
 * Le clic droit d'un champ : couper, copier, coller, tout sélectionner ; pour une formule, en plus
 * les structures courantes (fraction, puissance…). Il arrête l'évènement : le menu du bloc et celui
 * du vide ne s'ouvrent pas par-dessus.
 *
 * `display: contents` : le wrapper n'existe pas pour la mise en page, mais reste un nœud par lequel
 * l'évènement remonte, et c'est là qu'on retrouve le vrai champ (textarea, input ou `math-field`).
 */
export function FieldContextMenu({ kind, children }: { kind: 'text' | 'math'; children: ReactNode }) {
  const wrapper = useRef<HTMLElement | null>(null)
  const insertSymbol = useContext(SymbolInsertContext)

  /** Redonne le focus au champ avant d'agir : Radix le rend au déclencheur en fermant le menu. */
  const withField = (run: (field: HTMLElement) => void) => {
    const field = wrapper.current === null ? null : editableIn(wrapper.current)
    if (field === null) return
    setTimeout(() => { field.focus(); run(field) }, 0)
  }
  const paste = (field: HTMLElement) => {
    void navigator.clipboard.readText().then(text => {
      if (text === '') return
      if (isMathField(field)) (field as MathfieldElement).insert?.(text, { focus: true })
      else if (isTextField(field)) insertAtCursor(field, text)
    }).catch(() => { /* presse-papiers inaccessible : le menu ne dit rien de plus que le geste clavier */ })
  }
  const structures = SYMBOL_FAMILIES.find(f => f.name === 'Structures')

  return (
    <ContextMenu>
      <ContextMenuTrigger
        style={{ display: 'contents' }}
        onContextMenu={e => { e.stopPropagation(); wrapper.current = e.currentTarget }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => withField(() => document.execCommand('cut'))}><Scissors size={14} />Couper</ContextMenuItem>
        <ContextMenuItem onSelect={() => withField(() => document.execCommand('copy'))}><Copy size={14} />Copier</ContextMenuItem>
        <ContextMenuItem onSelect={() => withField(paste)}><ClipboardPaste size={14} />Coller</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => withField(() => document.execCommand('selectAll'))}><TextSelect size={14} />Tout sélectionner</ContextMenuItem>
        {kind === 'math' && insertSymbol !== null && structures !== undefined && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger><Sigma size={14} />Insérer</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {structures.symbols.map(symbol => (
                  <ContextMenuItem key={symbol.label} onSelect={() => withField(() => insertSymbol(symbol))}>
                    <span aria-hidden style={{ width: 18, textAlign: 'center' }}>{symbol.glyph}</span>{symbol.label}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

- [ ] **Step 7: `BlockContextMenu.tsx`**

```tsx
import type { ReactNode } from 'react'
import { ArrowDown, ArrowLeftRight, ArrowUp, CopyPlus, Shapes, Trash2 } from 'lucide-react'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@suite/shared/ui'
import { BLOCK_TYPES, type BlockType } from './blocks'
import { BLOCK_META } from './blockMeta'

interface Props {
  index: number
  count: number
  /** `null` : bloc de type inconnu — conservé tel quel, donc ni converti ni modifié. */
  kind: BlockType | null
  onMove: (delta: -1 | 1) => void
  onDuplicate: () => void
  onRemove: () => void
  onChangeKind: (type: BlockType) => void
  /** Présent seulement quand l'exercice est scindé. */
  onSend?: () => void
  children: ReactNode
}

/**
 * Le clic droit d'un bloc (la carte, hors des champs : ceux-ci ont le leur). Il arrête l'évènement,
 * pour que le menu du vide qui entoure toute la pile ne s'ouvre pas en même temps.
 */
export function BlockContextMenu({ index, count, kind, onMove, onDuplicate, onRemove, onChangeKind, onSend, children }: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={e => e.stopPropagation()}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled={index === 0} onSelect={() => onMove(-1)}><ArrowUp size={14} />Monter</ContextMenuItem>
        <ContextMenuItem disabled={index === count - 1} onSelect={() => onMove(1)}><ArrowDown size={14} />Descendre</ContextMenuItem>
        <ContextMenuItem onSelect={onDuplicate}><CopyPlus size={14} />Dupliquer</ContextMenuItem>
        {kind !== null && (
          <ContextMenuSub>
            <ContextMenuSubTrigger><Shapes size={14} />Changer de type</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {BLOCK_TYPES.filter(t => t.type !== kind).map(({ type }) => {
                const { label, icon: Icon } = BLOCK_META[type]
                return <ContextMenuItem key={type} onSelect={() => onChangeKind(type)}><Icon size={14} />{label}</ContextMenuItem>
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {onSend !== undefined && <ContextMenuItem onSelect={onSend}><ArrowLeftRight size={14} />Envoyer dans l'autre zone</ContextMenuItem>}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onRemove}><Trash2 size={14} />Supprimer</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

(Si `ContextMenuItem` n'a pas de prop `variant`, retirer ce prop : vérifier dans `packages/shared/src/ui/context-menu.tsx` ; Mentale n'en dépend pas.)

- [ ] **Step 8: `EmptyAreaContextMenu.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Columns2, Plus } from 'lucide-react'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@suite/shared/ui'
import { BLOCK_TYPES, type BlockType } from './blocks'
import { BLOCK_META } from './blockMeta'

/**
 * Le clic droit sur le vide d'une zone de travail (et dans une zone sans bloc) : ajouter un bloc,
 * scinder ou réunir les zones. C'est le niveau le plus extérieur ; bloc et champ l'arrêtent avant lui.
 */
export function EmptyAreaContextMenu({ onAdd, split, onToggleSplit, children }: {
  onAdd: (type: BlockType) => void
  split: boolean
  onToggleSplit?: () => void
  children: ReactNode
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {BLOCK_TYPES.map(({ type }) => {
          const { label, icon: Icon } = BLOCK_META[type]
          return <ContextMenuItem key={type} onSelect={() => onAdd(type)}><Plus size={14} /><Icon size={14} />Ajouter un bloc {label}</ContextMenuItem>
        })}
        {onToggleSplit !== undefined && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onToggleSplit}><Columns2 size={14} />{split ? 'Réunir les zones' : 'Scinder en deux zones'}</ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

Le test « sur le vide » cherche `/Équation/` : l'entrée « Ajouter un bloc Équation » le satisfait.

- [ ] **Step 9: Câbler `BlockStack`** — nouvelles props `onSend?`, `split?: boolean`, `onToggleSplit?: () => void` (déstructurer `onSend` ici : la tâche 6 l'avait seulement déclarée). Enrober chaque carte et la racine :

```tsx
      <EmptyAreaContextMenu onAdd={type => add(type)} split={split} onToggleSplit={onToggleSplit}>
        <div data-testid="zone-vide" style={{ minHeight: '100%' }}>
          …<ul> et le groupe d'ajout existants…
        </div>
      </EmptyAreaContextMenu>
```

Dans le `map`, autour de `BlockCard` (à l'intérieur du `motion.li`) :

```tsx
<BlockContextMenu
  index={i} count={blocks.length} kind={isKnown(block) ? block.type : null}
  onMove={delta => move(block.id, delta)}
  onDuplicate={() => { const r = duplicateBlock(blocks, block.id); setHalo(r.added.id); onChange(r.blocks) }}
  onRemove={() => onChange(removeBlock(blocks, block.id))}
  onChangeKind={type => isKnown(block) && onChange(blocks.map(b => (b.id === block.id ? convertBlock(block, type) : b)))}
  onSend={onSend === undefined ? undefined : () => onSend(block.id)}
>
  <div>
    <BlockCard …/>
  </div>
</BlockContextMenu>
```

Envelopper les champs : `FieldContextMenu kind="text"` autour du `textarea` de `TextEditor`, des deux `input` de `CalcEditor`, de chaque `input` de cellule de `TableEditor`, de l'`input` d'opération de `EquationEditor` ; `kind="math"` autour de chaque `MathField` (`member(...)`). Dans `ExerciseWorkspace`, envelopper aussi (`kind="text"`) l'énoncé et la réponse, et fournir le contexte :

```tsx
<SymbolInsertContext value={insertSymbol}> … le <section aria-label="Exercice"> … </SymbolInsertContext>
```

(React 19 : le contexte s'utilise directement comme fournisseur.) Pour la zone de droite, `BlockStack` reçoit `split={split}` et `onToggleSplit={() => edit(split ? mergeZones(exercise) : splitZones())}` dans **les deux** zones (factoriser en `const toggleSplit`, réutilisé par le bouton de l'en-tête).

- [ ] **Step 10: Vérifier** — `cd apps/zachart-maths && bunx vitest run && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths && bun run test:scripts` → PASS. Si un test existant interroge `getAllByRole('menuitem')` ou compte des `region`, vérifier qu'il n'est pas perturbé par les nouveaux enveloppes (`display: contents` n'ajoute aucun rôle).

- [ ] **Step 11: Commit**

```bash
git add apps/zachart-maths/src/exercises/BlockContextMenu.tsx apps/zachart-maths/src/exercises/FieldContextMenu.tsx apps/zachart-maths/src/exercises/EmptyAreaContextMenu.tsx apps/zachart-maths/src/exercises/symbolInsert.ts apps/zachart-maths/src/exercises/ContextMenus.test.tsx apps/zachart-maths/src/exercises/blocks.ts apps/zachart-maths/src/exercises/blocks.test.ts apps/zachart-maths/src/exercises/BlockStack.tsx apps/zachart-maths/src/exercises/CalcEditor.tsx apps/zachart-maths/src/exercises/EquationEditor.tsx apps/zachart-maths/src/exercises/ExerciseWorkspace.tsx
git commit -m "feat(zachart-maths): three-level right-click menus on the work area (block, field, empty space)"
```

---

### Task 9: Documentation, revue de toute la branche, vérification dans l'app

**Files:**
- Modify: `CLAUDE.md` (section Zach'Math et ligne `@suite/shared/math`)

- [ ] **Step 1: `CLAUDE.md`** — dans « Zach'Math », mettre à jour : un exercice a une zone (`blocs`) ou deux (`blocsB` présent) ; `Blocks` : l'équation est `left | right | operation` (l'`operation` d'une étape se lit après elle), un ancien `latex` est découpé sur son premier `=` à la lecture ; clic droit à trois niveaux (`BlockContextMenu`, `FieldContextMenu`, `EmptyAreaContextMenu`) ; animation `motion` + halo. Dans la liste de `@suite/shared/math` : ajouter `equationStepIsSolved`, `navigate`/`readingOrder`/`operationVisible` (logique pure de l'équation, partagée avec Mentale).

- [ ] **Step 2: Vérification complète**

Run (racine) : `bun run test:all && bunx tsc --noEmit -p apps/zachart-maths && bunx tsc --noEmit -p packages/shared && bunx tsc --noEmit -p apps/zachart-mentale && cargo test --workspace`
Expected: tout PASS. Si un échec est sans lien avec ce chantier, le dire tel quel au lieu de le masquer.

- [ ] **Step 3: Revue de toute la branche** — `superpowers:requesting-code-review` sur `git diff main...HEAD` : la revue globale est obligatoire (elle attrape les bugs entre tâches : ids de blocs entre zones, focus, propagation des clic droit). Traiter les retours avant de continuer.

- [ ] **Step 4: Vérification dans l'app réelle** (`bun run --filter zachart-maths tauri dev`) — cocher à l'œil :
  1. Barre de symboles sur 2 colonnes, sans débordement.
  2. Monter/descendre un bloc : glissement fluide, halo ~600 ms sur le bloc déplacé, le bloc remplacé glisse en sens inverse.
  3. « Scinder » : deux zones indépendantes ; « Envoyer dans l'autre zone » (clic droit) : le bloc apparaît en fondu avec halo et reçoit le curseur ; « Réunir » : tout est à la suite.
  4. Équation : deux cases bleu/ambre, ligne verte quand `x = 3`, flèches/Tab/Entrée/Retour arrière ; ouvrir une ancienne fiche : étapes découpées sur le `=`.
  5. Calcul : Entrée → résultat → nouveau bloc calcul dessous.
  6. « Nouvel exercice » dans la zone de réponse : curseur dans l'énoncé.
  7. Clic droit : bloc, champ, vide ; jamais deux menus à la fois.
  8. Réglage système « réduire les animations » : plus de glissement, halo conservé.

- [ ] **Step 5: Graphe et commit** — `graphify update .` (sans coût LLM, cf. CLAUDE.md), puis :

```bash
git add CLAUDE.md
git commit -m "docs: Zach'Math two-zone work area, equation model and shared equation logic in CLAUDE.md"
```

Ne pas ajouter `graphify-out/` s'il est ignoré ; sinon `git status --short` et ajouter explicitement les fichiers voulus.

---

## Self-review (spec ↔ plan)

- Disposition, focus, bouton du bas, scinder → tâche 6. Format `blocsB`, fusion, envoi → tâche 1 (+ 6, 8). Migration de l'équation → tâche 4 (écart signalé en tête). Logique partagée → tâche 2. Carte, icônes, boutons d'ajout → tâche 3. Calcul, équation, clavier → tâche 4. Animation, halo, `prefers-reduced-motion` → tâche 5. Barre 2 colonnes → tâche 7. Clic droit 3 niveaux, propagation arrêtée, bloc inconnu → tâche 8. Revue et app réelle → tâche 9.
- Écart assumé : pas d'animation de **sortie** d'un bloc envoyé dans l'autre zone (voir tâche 5) ; l'arrivée est animée (fondu + halo).
- Types cohérents entre tâches : `EquationStep { left, right, operation }` (4 → 8), `Zone`/`sendBlock` (1 → 6, 8), `BlockStack` props `label`, `arrivedId`, `onSend`, `split`, `onToggleSplit` (3, 5, 6, 8), `MathFieldHandle.focus(at?)` et `onNavigate` (4).
