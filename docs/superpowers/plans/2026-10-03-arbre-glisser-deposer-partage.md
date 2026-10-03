# Glisser-déposer d'arbre partagé : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un seul moteur de glisser-déposer d'arbre (évènements pointeur, fantôme, dépliage au survol) pour Zachar't Mentale et Zach'Math, qui fonctionne dans la webview Tauri des deux apps.

**Architecture:** Un nouveau point d'entrée `@suite/shared/tree` héberge le store, le moteur (`beginTreeDrag`, `dropTargetAt`, `consumeSwallowedClick`) et le fantôme ; tout ce qui est propre à une app arrive par des handlers (`canDrop`, `isExpanded`, `expand`, `onDrop`). Mentale garde ses modules actuels comme **fines façades** autour du moteur partagé, ce qui laisse ses tests et tous ses imports intacts. Maths remplace son glisser-déposer HTML5 par ce moteur.

**Tech Stack:** React 19, TypeScript, zustand, Bun workspaces, Vitest + Testing Library, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-03-arbre-glisser-deposer-partage-design.md`

**Écart avec la spec** (à ledgerer comme `Ruling:` par l'exécutant) : la spec dit « le store et le fantôme locaux sont supprimés » côté Mentale. Ce plan les **remplace par des façades** de même nom et de même chemin (`state/useTreeDragStore.ts` ré-exporte le store partagé ; `sidebar/TreeDragGhost.tsx` enveloppe le fantôme partagé). Raison : les tests existants de Mentale (`treeDrag.test.ts`, `FileTreeRow.drag.test.tsx`) importent ces chemins et doivent rester verts **sans modification** ; c'est la preuve de non-régression voulue par la spec. Aucun comportement ne change.

## Global Constraints

- **React, pas Vue.** Textes d'interface et commentaires de code : dans `packages/shared/src/tree/`, commentaires en **anglais** comme le code déplacé (`treeDrag.ts` de Mentale) ; dans Maths, en français comme le reste de l'app.
- `packages/shared` n'importe **jamais** une app ; imports relatifs dans `shared`, jamais `@suite/shared/…` à l'intérieur ; les apps n'importent que les points d'entrée publics. `src/boundary.test.ts` (shared et Maths) et `admin/src/boundary.test.ts` restent verts ; **l'admin n'importe pas `@suite/shared/tree`**.
- Rien de Tauri dans `shared/src/tree` : il touche seulement le DOM et `window`.
- Le comportement du glisser-déposer de Mentale ne change pas : seuil 5 px, 600 ms de dépliage au survol, annulation à Échap/`blur`/`pointercancel`, clic avalé après un vrai drag, bouton principal seulement.
- Commandes depuis la racine. Tests d'un fichier : `cd packages/shared && bunx vitest run <fichier>` (idem `apps/zachart-mentale`, `apps/zachart-maths`). Type-check : `bunx tsc --noEmit -p packages/shared` (ou `apps/zachart-maths`, `apps/zachart-mentale`).
- **Jamais** `git add -A` ni `git add -f` : chemins explicites. `apps/zachart-maths/src-tauri/Cargo.toml` est modifié dans l'arbre de travail, hors de ce chantier : ne pas l'ajouter.
- Message de commit : se termine par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Travail sur `main`, push à la fin seulement.
- **Écrire les fichiers avec l'outil Write/Edit**, pas avec des scripts shell ou Python à guillemets imbriqués. Le script `task-start`/`task-done` du skill n'existe pas dans cette installation : tenir le registre à la main.

## Review Focus

Entrées que la spec implique et qu'aucun test « chemin heureux » n'attrape ; chacune a son test dans la tâche indiquée.

1. Un appui **non principal** (clic droit, ouvre le menu contextuel) ne démarre ni drag ni « clic avalé » — tâches 1 et 4.
2. Un drag qui finit sur du **vide** (aucune cible) n'avale pas le clic **suivant** : le prochain appui remet l'état à zéro — tâche 1.
3. Un drag **annulé** (Échap, `blur`) ne laisse ni fantôme ni surbrillance de cible, et plus aucun écouteur `window` — tâches 1 et 2.
4. Un simple **clic** sur un fichier le sélectionne toujours (Maths), et un clic droit ouvre son menu sans drag — tâche 4.
5. Déposer un fichier sur un chapitre **replié par le survol** fonctionne (il s'ouvre, puis reçoit le fichier) — tâche 4.

---

### Task 1: `@suite/shared/tree` : store, moteur, `dropTargetAt`

**Files:**
- Create: `packages/shared/src/tree/useTreeDragStore.ts`, `treeDrag.ts`, `index.ts`
- Create: `packages/shared/src/tree/treeDrag.test.ts`
- Modify: `packages/shared/package.json` (export `./tree`)

**Interfaces:**
- Produces (tâches 2, 3, 4) depuis `@suite/shared/tree` :
  - `interface TreeDragSource { path: string; name: string; kind: string }`, `interface TreeDragPointer { x: number; y: number }`
  - `useTreeDragStore` : même forme que celui de Mentale (`source`, `pointer`, `targetPath`, `begin`, `movePointer`, `setTarget`, `end`)
  - `interface TreeDragHandlers { canDrop(source: TreeDragSource, targetPath: string): boolean; isExpanded(targetPath: string): boolean; expand(targetPath: string): void; onDrop(source: TreeDragSource, targetPath: string): void }`
  - `beginTreeDrag(event: ReactPointerEvent<HTMLElement>, source: TreeDragSource, handlers: TreeDragHandlers): void`
  - `consumeSwallowedClick(): boolean`, `dropTargetAt(x: number, y: number): string | null`, `DRAG_THRESHOLD_PX = 5`, `HOVER_EXPAND_MS = 600`

- [ ] **Step 1: Écrire les tests du moteur**

```ts
// packages/shared/src/tree/treeDrag.test.ts
import type { PointerEvent as ReactPointerEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DRAG_THRESHOLD_PX, HOVER_EXPAND_MS, beginTreeDrag, consumeSwallowedClick, dropTargetAt, type TreeDragHandlers } from './treeDrag'
import { useTreeDragStore } from './useTreeDragStore'

const originalElementFromPoint = document.elementFromPoint as ((x: number, y: number) => Element | null) | undefined

/** jsdom has no `elementFromPoint` at all, so it is installed rather than spied on. */
function installElementFromPoint() {
  Object.defineProperty(document, 'elementFromPoint', { value: vi.fn(() => null), writable: true, configurable: true })
}
const pointAt = (element: Element | null) => vi.mocked(document.elementFromPoint).mockReturnValue(element)

function pointerEvent(type: string, init: PointerEventInit): Event {
  const Constructor = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent
  return new Constructor(type, init)
}
const press = (x = 10, y = 10, button = 0) => ({ button, clientX: x, clientY: y }) as ReactPointerEvent<HTMLElement>
const move = (x: number, y: number) => window.dispatchEvent(pointerEvent('pointermove', { clientX: x, clientY: y }))
const release = () => window.dispatchEvent(pointerEvent('pointerup', {}))

const FILE = { path: 'A/un.json', name: 'Un', kind: 'file' }

function handlers(over: Partial<TreeDragHandlers> = {}): TreeDragHandlers {
  return {
    canDrop: vi.fn(() => true),
    isExpanded: vi.fn(() => true),
    expand: vi.fn(),
    onDrop: vi.fn(),
    ...over,
  }
}

describe('dropTargetAt', () => {
  beforeEach(() => {
    installElementFromPoint()
    document.body.innerHTML = `
      <div data-drop-folder="B">
        <button data-tree-row="B" data-tree-kind="folder">B</button>
        <button data-tree-row="B/deux.json" data-tree-kind="file">Deux</button>
      </div>`
  })
  afterEach(() => {
    document.body.innerHTML = ''
    if (originalElementFromPoint === undefined) delete (document as unknown as Record<string, unknown>).elementFromPoint
    else document.elementFromPoint = originalElementFromPoint
  })

  it('reads the folder header under the pointer', () => {
    pointAt(document.querySelector('[data-tree-row="B"]'))
    expect(dropTargetAt(1, 1)).toBe('B')
  })
  it('resolves a file to the folder that encloses it', () => {
    pointAt(document.querySelector('[data-tree-row="B/deux.json"]'))
    expect(dropTargetAt(1, 1)).toBe('B')
  })
  it('finds no destination over empty space, or where the engine has no elementFromPoint', () => {
    pointAt(null)
    expect(dropTargetAt(1, 1)).toBeNull()
    delete (document as unknown as Record<string, unknown>).elementFromPoint
    expect(dropTargetAt(1, 1)).toBeNull()
  })
})

describe('beginTreeDrag', () => {
  beforeEach(() => {
    installElementFromPoint()
    document.body.innerHTML = '<div data-drop-folder="B"><button data-tree-row="B" data-tree-kind="folder">B</button></div>'
    pointAt(document.querySelector('[data-tree-row="B"]'))
    useTreeDragStore.setState({ source: null, pointer: null, targetPath: null })
    consumeSwallowedClick() // start from a clean module state
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    if (originalElementFromPoint === undefined) delete (document as unknown as Record<string, unknown>).elementFromPoint
    else document.elementFromPoint = originalElementFromPoint
  })

  it('does not start below the threshold, and the click that follows is not swallowed', () => {
    const h = handlers()
    beginTreeDrag(press(10, 10), FILE, h)
    move(10 + DRAG_THRESHOLD_PX - 1, 10)
    expect(useTreeDragStore.getState().source).toBeNull()
    release()
    expect(h.onDrop).not.toHaveBeenCalled()
    expect(consumeSwallowedClick()).toBe(false)
  })

  it('starts past the threshold and the pointer follows', () => {
    beginTreeDrag(press(10, 10), FILE, handlers())
    move(40, 25)
    const { source, pointer } = useTreeDragStore.getState()
    expect(source).toEqual(FILE)
    expect(pointer).toEqual({ x: 40, y: 25 })
    release()
  })

  it('keeps the target only if canDrop accepts it', () => {
    const h = handlers({ canDrop: vi.fn(() => false) })
    beginTreeDrag(press(), FILE, h)
    move(60, 60)
    expect(useTreeDragStore.getState().targetPath).toBeNull()
    release()
    expect(h.onDrop).not.toHaveBeenCalled()
  })

  it('drops once on a valid target, then swallows exactly one click', () => {
    const h = handlers()
    beginTreeDrag(press(), FILE, h)
    move(60, 60)
    expect(useTreeDragStore.getState().targetPath).toBe('B')
    release()
    expect(h.onDrop).toHaveBeenCalledTimes(1)
    expect(h.onDrop).toHaveBeenCalledWith(FILE, 'B')
    expect(useTreeDragStore.getState().source).toBeNull()
    expect(consumeSwallowedClick()).toBe(true)
    expect(consumeSwallowedClick()).toBe(false)
  })

  it('a drag that ends over empty space drops nothing, and the next press clears the swallowed click', () => {
    pointAt(null)
    const h = handlers()
    beginTreeDrag(press(), FILE, h)
    move(60, 60)
    release()
    expect(h.onDrop).not.toHaveBeenCalled()
    // The tail click of that drag would be swallowed… but a fresh press must not inherit it.
    beginTreeDrag(press(), FILE, handlers())
    expect(consumeSwallowedClick()).toBe(false)
    release()
  })

  it.each([
    ['Escape', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
    ['blur', () => window.dispatchEvent(new Event('blur'))],
    ['pointercancel', () => window.dispatchEvent(pointerEvent('pointercancel', {}))],
  ])('%s cancels without dropping, clears the store and the listeners', (_name, cancel) => {
    const h = handlers()
    beginTreeDrag(press(), FILE, h)
    move(60, 60)
    cancel()
    expect(useTreeDragStore.getState()).toMatchObject({ source: null, pointer: null, targetPath: null })
    release()
    expect(h.onDrop).not.toHaveBeenCalled()
    const calls = vi.mocked(h.canDrop).mock.calls.length
    move(90, 90)
    expect(vi.mocked(h.canDrop).mock.calls.length).toBe(calls)
    expect(consumeSwallowedClick()).toBe(true)
  })

  it('ignores a non-primary press (a right-click opens the menu, it never drags)', () => {
    const h = handlers()
    beginTreeDrag(press(10, 10, 2), FILE, h)
    move(80, 80)
    release()
    expect(useTreeDragStore.getState().source).toBeNull()
    expect(h.onDrop).not.toHaveBeenCalled()
    expect(consumeSwallowedClick()).toBe(false)
  })

  describe('hover-to-expand', () => {
    it('opens a closed folder after the delay, once', () => {
      vi.useFakeTimers()
      const h = handlers({ isExpanded: vi.fn(() => false) })
      beginTreeDrag(press(), FILE, h)
      move(60, 60)
      vi.advanceTimersByTime(HOVER_EXPAND_MS - 1)
      expect(h.expand).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(h.expand).toHaveBeenCalledTimes(1)
      expect(h.expand).toHaveBeenCalledWith('B')
      move(61, 61)
      vi.advanceTimersByTime(HOVER_EXPAND_MS * 2)
      expect(h.expand).toHaveBeenCalledTimes(1)
      release()
    })

    it('never opens a folder that is already open', () => {
      vi.useFakeTimers()
      const h = handlers({ isExpanded: vi.fn(() => true) })
      beginTreeDrag(press(), FILE, h)
      move(60, 60)
      vi.advanceTimersByTime(HOVER_EXPAND_MS * 2)
      expect(h.expand).not.toHaveBeenCalled()
      release()
    })

    it('does not open a folder the pointer left in the meantime', () => {
      vi.useFakeTimers()
      const h = handlers({ isExpanded: vi.fn(() => false) })
      beginTreeDrag(press(), FILE, h)
      move(60, 60)
      vi.advanceTimersByTime(HOVER_EXPAND_MS - 100)
      pointAt(null)
      move(70, 70)
      vi.advanceTimersByTime(HOVER_EXPAND_MS)
      expect(h.expand).not.toHaveBeenCalled()
      release()
    })

    it('does not open anything once the drop has happened', () => {
      vi.useFakeTimers()
      const h = handlers({ isExpanded: vi.fn(() => false) })
      beginTreeDrag(press(), FILE, h)
      move(60, 60)
      release()
      vi.advanceTimersByTime(HOVER_EXPAND_MS * 2)
      expect(h.expand).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Lancer, vérifier l'échec** — `cd packages/shared && bunx vitest run src/tree/treeDrag.test.ts` → FAIL (modules introuvables).

- [ ] **Step 3: `useTreeDragStore.ts`** (le store de Mentale, `kind` libre)

```ts
// packages/shared/src/tree/useTreeDragStore.ts
import { create } from 'zustand'

/** The row in flight: what the ghost shows and what the drop validation needs. */
export interface TreeDragSource {
  path: string
  /** What the row already displays — the app decides how it is spelled. */
  name: string
  /** `'folder'`, `'mindmap'`, `'file'`… — free: only the app (and its ghost icon) reads it. */
  kind: string
}

export interface TreeDragPointer {
  x: number
  y: number
}

interface TreeDragState {
  /** The row being dragged, or `null` when no drag is in progress. */
  source: TreeDragSource | null
  /** Cursor position in client pixels, for the floating ghost. */
  pointer: TreeDragPointer | null
  /** The folder that would receive the drop, or `null` when there is no valid one. */
  targetPath: string | null
  begin: (source: TreeDragSource, pointer: TreeDragPointer) => void
  movePointer: (pointer: TreeDragPointer) => void
  setTarget: (targetPath: string | null) => void
  end: () => void
}

/**
 * A tree's drag & drop, as state — deliberately NOT React context: a row subscribes to the two
 * booleans it needs (`is this row in flight?`, `is it the target?`), so a pointer move re-renders
 * the ghost alone rather than the whole tree, however many rows are on screen.
 */
export const useTreeDragStore = create<TreeDragState>(set => ({
  source: null,
  pointer: null,
  targetPath: null,
  begin: (source, pointer) => set({ source, pointer, targetPath: null }),
  movePointer: pointer => set({ pointer }),
  setTarget: targetPath => set(state => (state.targetPath === targetPath ? state : { targetPath })),
  end: () => set({ source: null, pointer: null, targetPath: null }),
}))
```

- [ ] **Step 4: `treeDrag.ts`** (déplacé de Mentale ; les parties propres à l'app deviennent des handlers)

```ts
// packages/shared/src/tree/treeDrag.ts
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTreeDragStore, type TreeDragSource } from './useTreeDragStore'

/**
 * How far the pointer must travel before a press becomes a drag.
 *
 * Below it the gesture is still the click that opens a file (and the double-click that renames
 * it, and the right-click that opens the menu): a tree has no drag handle, so the only thing
 * separating the two is having actually moved.
 */
export const DRAG_THRESHOLD_PX = 5

/**
 * How long a collapsed folder must be hovered mid-drag before it opens, so a destination hidden
 * one level down is reachable without letting go — the behaviour Finder and Explorer trained
 * everyone on.
 */
export const HOVER_EXPAND_MS = 600

/** What an app plugs into the engine: every rule that depends on its own data. */
export interface TreeDragHandlers {
  /** Whether dropping `source` into `targetPath` would do something. Keeps the highlight honest. */
  canDrop: (source: TreeDragSource, targetPath: string) => boolean
  /** Whether the folder is already open — a hover only opens a folder that is closed. */
  isExpanded: (targetPath: string) => boolean
  expand: (targetPath: string) => void
  /** The whole consequence of a move: the app owns it, errors included. */
  onDrop: (source: TreeDragSource, targetPath: string) => void
}

/**
 * Set once a gesture has actually moved, and read back by the row's own click handler: a drag
 * ends with a `pointerup`, which the browser follows with a `click`, and without this a file
 * dropped back onto its own row would also OPEN. Module state rather than store state because it
 * is consumed exactly once, by whichever row the click lands on, and it is cleared by the next
 * press — a click that reached no row can never swallow a later, genuine one.
 */
let swallowClick = false

/** Whether the click that is being handled is the tail of a drag, and must be ignored. */
export function consumeSwallowedClick(): boolean {
  if (!swallowClick) return false
  swallowClick = false
  return true
}

/**
 * The folder the pointer would drop into, or `null`.
 *
 * Two levels, because a tree's rows are not all potential destinations: a folder's own header is
 * one, while anywhere inside a folder's subtree — over a file, or over a nested folder — still
 * means that enclosing folder, which is what makes the hit area the whole branch rather than a
 * 20 px line of text.
 */
export function dropTargetAt(x: number, y: number): string | null {
  // Guarded rather than assumed: `elementFromPoint` is standard in the Tauri webviews but absent
  // from some non-browser DOM implementations, and this runs inside a pointer handler where a
  // throw would be swallowed silently.
  if (typeof document.elementFromPoint !== 'function') return null

  const element = document.elementFromPoint(x, y)
  if (element === null) return null

  const row = element.closest('[data-tree-row]')
  if (row?.getAttribute('data-tree-kind') === 'folder') return row.getAttribute('data-tree-row')

  return element.closest('[data-drop-folder]')?.getAttribute('data-drop-folder') ?? null
}

/**
 * Starts tracking a press as a possible drag.
 *
 * Pointer events rather than HTML5 drag & drop, for two reasons: the Tauri webview has its
 * drag-drop handler enabled (it is what lets a file or a picture be dropped onto the window from
 * the file manager), which makes in-page `dragstart`/`drop` unreliable there, and this way the
 * ghost and the drop highlight are ordinary markup we style ourselves, not the browser's opinion
 * of what a drag looks like.
 *
 * Listeners are attached to the window, not the row: the rows are a scrollable list the gesture
 * reorders, so the pointer routinely leaves the element it started on, and a mid-drag tree
 * refresh can replace the row entirely.
 */
export function beginTreeDrag(
  event: ReactPointerEvent<HTMLElement>,
  source: TreeDragSource,
  handlers: TreeDragHandlers,
): void {
  swallowClick = false
  if (event.button !== 0) return

  const startX = event.clientX
  const startY = event.clientY
  let active = false
  let hoveredPath: string | null = null
  let expandTimer: number | null = null

  function cancelExpandTimer() {
    if (expandTimer !== null) window.clearTimeout(expandTimer)
    expandTimer = null
  }

  function stopListening() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('blur', onCancel)
  }

  function onMove(move: PointerEvent) {
    if (!active) {
      if (Math.abs(move.clientX - startX) < DRAG_THRESHOLD_PX && Math.abs(move.clientY - startY) < DRAG_THRESHOLD_PX) return
      active = true
      useTreeDragStore.getState().begin(source, { x: move.clientX, y: move.clientY })
    }

    const drag = useTreeDragStore.getState()
    drag.movePointer({ x: move.clientX, y: move.clientY })
    const candidate = dropTargetAt(move.clientX, move.clientY)
    const target = candidate !== null && handlers.canDrop(source, candidate) ? candidate : null
    drag.setTarget(target)

    if (target === hoveredPath) return
    hoveredPath = target
    cancelExpandTimer()
    // Only a folder that is actually closed, and only the one the pointer rests on: opening
    // everything the cursor sweeps across would fling the tree open.
    if (target !== null && !handlers.isExpanded(target)) {
      expandTimer = window.setTimeout(() => handlers.expand(target), HOVER_EXPAND_MS)
    }
  }

  function onUp() {
    stopListening()
    cancelExpandTimer()
    const target = useTreeDragStore.getState().targetPath
    useTreeDragStore.getState().end()
    if (!active) return
    swallowClick = true
    if (target === null) return
    handlers.onDrop(source, target)
  }

  function onCancel() {
    stopListening()
    cancelExpandTimer()
    if (active) swallowClick = true
    useTreeDragStore.getState().end()
  }

  function onKeyDown(key: KeyboardEvent) {
    if (key.key === 'Escape') onCancel()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('blur', onCancel)
}
```

- [ ] **Step 5: `index.ts` et export**

```ts
// packages/shared/src/tree/index.ts
export * from './useTreeDragStore'
export * from './treeDrag'
```

`packages/shared/package.json`, dans `exports`, après `"./math": "./src/math/index.ts"` ajouter (sans oublier la virgule) : `"./tree": "./src/tree/index.ts"`.

- [ ] **Step 6: Vérifier** — `cd packages/shared && bunx vitest run src/tree src/boundary.test.ts && cd ../.. && bunx tsc --noEmit -p packages/shared` → PASS. Si un test « cancel » échoue sur le comptage des appels de `canDrop`, vérifier que `stopListening` retire bien les cinq écouteurs.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/tree/useTreeDragStore.ts packages/shared/src/tree/treeDrag.ts packages/shared/src/tree/index.ts packages/shared/src/tree/treeDrag.test.ts packages/shared/package.json
git commit -m "feat(shared): tree drag-and-drop engine (store, pointer drag, drop-target lookup)"
```

---

### Task 2: `TreeDragGhost` partagé et son CSS

**Files:**
- Create: `packages/shared/src/tree/TreeDragGhost.tsx`, `TreeDragGhost.test.tsx`
- Modify: `packages/shared/src/tree/index.ts`, `packages/shared/src/theme/theme.css` (ajout du bloc `.tree-drag-ghost*`)
- Modify: `apps/zachart-mentale/src/index.css` (retrait du même bloc, lignes ~845-889)

**Interfaces:**
- Consumes : `useTreeDragStore` (tâche 1).
- Produces (tâches 3, 4) : `<TreeDragGhost describeTarget={(path: string) => string} icon?={(kind: string) => ReactNode} refusal?={string} />`. Le nœud porte `data-testid="tree-drag-ghost"`, `data-valid`, et les classes `tree-drag-ghost`, `tree-drag-ghost__name`, `tree-drag-ghost__target` (inchangés).

- [ ] **Step 1: Test**

```tsx
// packages/shared/src/tree/TreeDragGhost.test.tsx
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { TreeDragGhost } from './TreeDragGhost'
import { useTreeDragStore } from './useTreeDragStore'

const props = { describeTarget: (path: string) => `Déplacer dans « ${path} »` }
const drag = (targetPath: string | null) =>
  act(() => {
    useTreeDragStore.setState({ source: { path: 'A/un.json', name: 'Un', kind: 'file' }, pointer: { x: 100, y: 50 }, targetPath })
  })

describe('TreeDragGhost', () => {
  beforeEach(() => useTreeDragStore.setState({ source: null, pointer: null, targetPath: null }))

  it('is absent outside a drag', () => {
    render(<TreeDragGhost {...props} />)
    expect(screen.queryByTestId('tree-drag-ghost')).toBeNull()
  })

  it('names the row in flight and follows the pointer', () => {
    render(<TreeDragGhost {...props} />)
    drag(null)
    const ghost = screen.getByTestId('tree-drag-ghost')
    expect(ghost).toHaveTextContent('Un')
    expect(ghost).toHaveStyle({ left: '114px', top: '64px' })
    expect(ghost).toHaveAttribute('data-valid', 'false')
  })

  it('states the destination when valid, a plain refusal otherwise', () => {
    render(<TreeDragGhost {...props} />)
    drag('B')
    expect(screen.getByTestId('tree-drag-ghost')).toHaveTextContent('Déplacer dans « B »')
    expect(screen.getByTestId('tree-drag-ghost')).toHaveAttribute('data-valid', 'true')
    drag(null)
    expect(screen.getByTestId('tree-drag-ghost')).toHaveTextContent('Déposer sur un dossier')
  })

  it('lets the app choose the refusal text and the icon of each kind', () => {
    render(<TreeDragGhost {...props} refusal="Dépose sur un chapitre" icon={kind => <span data-testid={`icon-${kind}`} />} />)
    drag(null)
    expect(screen.getByTestId('tree-drag-ghost')).toHaveTextContent('Dépose sur un chapitre')
    expect(screen.getByTestId('icon-file')).toBeInTheDocument()
  })

  it('disappears when the drag ends', () => {
    render(<TreeDragGhost {...props} />)
    drag('B')
    act(() => useTreeDragStore.getState().end())
    expect(screen.queryByTestId('tree-drag-ghost')).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer, vérifier l'échec** — `cd packages/shared && bunx vitest run src/tree/TreeDragGhost.test.tsx` → FAIL.

- [ ] **Step 3: `TreeDragGhost.tsx`**

```tsx
// packages/shared/src/tree/TreeDragGhost.tsx
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTreeDragStore } from './useTreeDragStore'

interface TreeDragGhostProps {
  /** The second line when the pointer is over a valid destination — « Déplacer dans « B » ». */
  describeTarget: (targetPath: string) => string
  /** The second line when it is not over a valid destination. */
  refusal?: string
  /** The icon of what is in flight, by kind. */
  icon?: (kind: string) => ReactNode
}

/**
 * What follows the cursor during a tree drag.
 *
 * Two lines on purpose: the first is the row that is in flight (so a drag that started on a
 * deeply indented file still says what it is carrying), the second says where it would land — the
 * destination folder's name, or a plain refusal when the pointer is not over a valid one. Showing
 * the destination is what makes the gesture answer "où ça va se déposer ?" without the user
 * having to guess from a highlight alone.
 *
 * Portalled to `document.body` and positioned `fixed`: the sidebar scrolls and clips its content,
 * so a ghost rendered inside it would be cut off exactly when the drag reaches the bottom of the
 * list.
 */
export function TreeDragGhost({ describeTarget, refusal = 'Déposer sur un dossier', icon }: TreeDragGhostProps) {
  const source = useTreeDragStore(s => s.source)
  const pointer = useTreeDragStore(s => s.pointer)
  const targetPath = useTreeDragStore(s => s.targetPath)

  if (source === null || pointer === null) return null

  return createPortal(
    <div
      className="tree-drag-ghost"
      data-testid="tree-drag-ghost"
      data-valid={targetPath !== null}
      style={{ left: pointer.x + 14, top: pointer.y + 14 }}
    >
      <span className="tree-drag-ghost__name">
        {icon?.(source.kind)}
        {source.name}
      </span>
      <span className="tree-drag-ghost__target">{targetPath === null ? refusal : describeTarget(targetPath)}</span>
    </div>,
    document.body,
  )
}
```

`index.ts` : ajouter `export * from './TreeDragGhost'`.

- [ ] **Step 4: Déplacer le CSS.** Couper de `apps/zachart-mentale/src/index.css` le bloc entier (commentaire d'en-tête « The ghost that follows the cursor… » + `.tree-drag-ghost`, `.tree-drag-ghost__name`, `.tree-drag-ghost__target`, `.tree-drag-ghost[data-valid='true'] .tree-drag-ghost__target` + son commentaire) et le coller **tel quel** à la fin de `packages/shared/src/theme/theme.css`. `grep -n "tree-drag-ghost" apps/zachart-mentale/src/index.css` doit ensuite ne rien renvoyer. Les deux apps importent déjà `@suite/shared/theme.css` : rien d'autre à brancher.

- [ ] **Step 5: Vérifier** — `cd packages/shared && bunx vitest run src/tree src/boundary.test.ts && cd ../.. && bunx tsc --noEmit -p packages/shared` → PASS. Si un test de Mentale lit `index.css?raw` pour y chercher `.tree-drag-ghost`, `grep -rn "tree-drag-ghost" apps/zachart-mentale/src --include=*.test.*` : en pareil cas, le faire lire `theme.css` de `shared` à la place (c'est un déplacement de la même règle).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/tree/TreeDragGhost.tsx packages/shared/src/tree/TreeDragGhost.test.tsx packages/shared/src/tree/index.ts packages/shared/src/theme/theme.css apps/zachart-mentale/src/index.css
git commit -m "feat(shared): shared tree drag ghost, its CSS moves to the shared theme"
```

---

### Task 3: Mentale sur le moteur partagé (façades)

**Files:**
- Modify: `apps/zachart-mentale/src/components/sidebar/treeDrag.ts` (remplacé par une façade)
- Modify: `apps/zachart-mentale/src/state/useTreeDragStore.ts` (remplacé par un ré-export)
- Modify: `apps/zachart-mentale/src/components/sidebar/TreeDragGhost.tsx` (remplacé par une façade)
- Aucun test modifié : `treeDrag.test.ts`, `FileTreeRow.drag.test.tsx`, `FileTreeRow.test.tsx`, `FileSidebar.test.tsx` doivent passer **tels quels**.

**Interfaces:**
- Consumes : `beginTreeDrag`, `consumeSwallowedClick`, `dropTargetAt`, `DRAG_THRESHOLD_PX`, `HOVER_EXPAND_MS`, `useTreeDragStore`, `TreeDragGhost` de `@suite/shared/tree`.
- Produces : les mêmes exports qu'avant, aux mêmes chemins — `treeDrag.ts` : `DRAG_THRESHOLD_PX`, `HOVER_EXPAND_MS`, `consumeSwallowedClick`, `dropTargetAt`, `isValidDropTarget(source, targetPath)`, `beginTreeDrag(event, source)` (2 arguments, handlers liés) ; `useTreeDragStore.ts` : `useTreeDragStore`, `TreeDragSource`, `TreeDragPointer` ; `TreeDragGhost.tsx` : `TreeDragGhost` sans props.

- [ ] **Step 1: Mesure de départ** — `cd apps/zachart-mentale && bunx vitest run src/components/sidebar 2>&1 | tail -6` : noter le nombre de tests passants (la référence à retrouver à l'identique après la tâche).

- [ ] **Step 2: `state/useTreeDragStore.ts`** — remplacer tout le fichier par :

```ts
/**
 * The sidebar's drag & drop state now lives in `@suite/shared/tree`, shared with the other apps of
 * the suite. Re-exported here so every import of this path (rows, ghost, tests) keeps working.
 */
export { useTreeDragStore, type TreeDragPointer, type TreeDragSource } from '@suite/shared/tree'
```

- [ ] **Step 3: `sidebar/treeDrag.ts`** — remplacer tout le fichier par :

```ts
import type { PointerEvent as ReactPointerEvent } from 'react'
import { beginTreeDrag as beginSharedTreeDrag, type TreeDragHandlers } from '@suite/shared/tree'
import { isInsideFolder, isSameFilePath, parentDirOf } from '../../persistence/paths'
import type { TreeDragSource } from '../../state/useTreeDragStore'
import { useWorkspaceStore } from '../../state/useWorkspaceStore'

// The gesture itself — threshold, window listeners, ghost position, hover-to-expand, the swallowed
// click — lives in `@suite/shared/tree`. What stays here is what depends on THIS app's data: the
// path rules, and what a drop and an expansion do to the workspace store.
export { DRAG_THRESHOLD_PX, HOVER_EXPAND_MS, consumeSwallowedClick, dropTargetAt } from '@suite/shared/tree'

/**
 * Whether dropping `source` into `targetPath` would do something.
 *
 * The three refusals mirror `movePath`'s, one gesture earlier: the row itself, a folder inside the
 * dragged folder (an infinite tree), and the folder the file already lives in (a no-op). Refusing
 * them HERE is what keeps the drop highlight honest — it is never shown for a drop that would fail
 * or do nothing.
 */
export function isValidDropTarget(source: TreeDragSource, targetPath: string | null): boolean {
  if (targetPath === null || targetPath === '') return false
  if (isSameFilePath(source.path, targetPath)) return false
  if (source.kind === 'folder' && isInsideFolder(targetPath, source.path)) return false
  if (isSameFilePath(parentDirOf(source.path), targetPath)) return false
  return true
}

const handlers: TreeDragHandlers = {
  canDrop: (source, targetPath) => isValidDropTarget(source, targetPath),
  isExpanded: targetPath => useWorkspaceStore.getState().expandedPaths.has(targetPath),
  expand: targetPath => useWorkspaceStore.getState().expandPaths([targetPath]),
  // The store owns the whole consequence of a move — the open path, the expanded folders, both
  // listings, and the error banner if it fails.
  onDrop: (source, targetPath) => {
    void useWorkspaceStore.getState().moveNode(source.path, targetPath, source.kind === 'folder')
  },
}

/** Starts tracking a press as a possible drag of one of this sidebar's rows. */
export function beginTreeDrag(event: ReactPointerEvent<HTMLElement>, source: TreeDragSource): void {
  beginSharedTreeDrag(event, source, handlers)
}
```

- [ ] **Step 4: `sidebar/TreeDragGhost.tsx`** — remplacer tout le fichier par :

```tsx
import { FileJson, Folder } from 'lucide-react'
import { TreeDragGhost as SharedTreeDragGhost } from '@suite/shared/tree'
import { lastSegment } from './treeFilter'

/**
 * What follows the cursor during a sidebar drag: the shared ghost, with this app's wording and
 * icons. The second line says where the row would land — the destination folder's name — or a
 * plain refusal when the pointer is not over a valid one.
 */
export function TreeDragGhost() {
  return (
    <SharedTreeDragGhost
      describeTarget={targetPath => `Déplacer dans « ${lastSegment(targetPath)} »`}
      refusal="Déposer sur un dossier"
      icon={kind => (kind === 'folder' ? <Folder size={14} /> : <FileJson size={14} />)}
    />
  )
}
```

- [ ] **Step 5: Vérifier — sans toucher à un seul test de Mentale** — `cd apps/zachart-mentale && bunx vitest run src/components/sidebar src/components/RecentFilesList.test.tsx 2>&1 | tail -8` : **même nombre de tests passants qu'à l'étape 1**, aucun échec. Puis `cd ../.. && bunx tsc --noEmit -p apps/zachart-mentale && grep -rn "treeDrag'\|useTreeDragStore'\|TreeDragGhost'" apps/zachart-mentale/src --include=*.tsx --include=*.ts | grep -v test | head` : toutes les importations pointent encore vers les mêmes chemins. Si un test échoue, la façade diverge du comportement d'avant : la corriger, ne pas modifier le test.

- [ ] **Step 6: Commit**

```bash
git add apps/zachart-mentale/src/components/sidebar/treeDrag.ts apps/zachart-mentale/src/state/useTreeDragStore.ts apps/zachart-mentale/src/components/sidebar/TreeDragGhost.tsx
git commit -m "refactor(zachart-mentale): tree drag-and-drop on the shared engine, behind thin facades"
```

---

### Task 4: Maths : `ExerciseTree` en glisser-déposer pointeur

**Files:**
- Modify: `apps/zachart-maths/src/exercises/ExerciseTree.tsx`
- Create: `apps/zachart-maths/src/exercises/ExerciseTree.drag.test.tsx`

**Interfaces:**
- Consumes : `beginTreeDrag`, `consumeSwallowedClick`, `useTreeDragStore`, `TreeDragGhost` de `@suite/shared/tree` ; `useExerciseStore.getState().moveExercise(path, chapter)` ; `splitPath` de `./names`.

- [ ] **Step 1: Tests**

```tsx
// apps/zachart-maths/src/exercises/ExerciseTree.drag.test.tsx
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTreeDragStore } from '@suite/shared/tree'
import { ExerciseTree } from './ExerciseTree'
import { createMemoryFs } from './memoryFs'
import { useExerciseStore } from './useExerciseStore'

const fiche = (titre: string) =>
  JSON.stringify({ version: 2, id: titre, titre, exercices: [{ id: 'e', numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '' }] })

const originalElementFromPoint = document.elementFromPoint as ((x: number, y: number) => Element | null) | undefined
const pointAt = (el: Element | null) => vi.mocked(document.elementFromPoint).mockReturnValue(el)
const paths = (chapter: string) => useExerciseStore.getState().tree.find(c => c.name === chapter)?.exercises.map(e => e.path) ?? []

async function setup() {
  const fs = createMemoryFs({ 'A/un.json': fiche('Un'), 'B/deux.json': fiche('Deux') })
  render(<ExerciseTree />)
  await act(async () => useExerciseStore.getState().init(fs))
  return { fs, user: userEvent.setup() }
}
const chapter = (name: string) => screen.getByRole('button', { name })
const file = (titre: string) => screen.getByRole('button', { name: titre })
const pointerDown = (el: Element, x = 10, y = 10, button = 0) => fireEvent.pointerDown(el, { button, clientX: x, clientY: y })
const move = (x: number, y: number) => fireEvent(window, new MouseEvent('pointermove', { clientX: x, clientY: y }))
const release = () => fireEvent(window, new MouseEvent('pointerup'))

describe("glisser-déposer dans l'arbre des exercices", () => {
  beforeEach(() => {
    Object.defineProperty(document, 'elementFromPoint', { value: vi.fn(() => null), writable: true, configurable: true })
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null })
    useTreeDragStore.setState({ source: null, pointer: null, targetPath: null })
  })
  afterEach(() => {
    if (originalElementFromPoint === undefined) delete (document as unknown as Record<string, unknown>).elementFromPoint
    else document.elementFromPoint = originalElementFromPoint
  })

  it('glisser un fichier sur un autre chapitre le déplace', async () => {
    await setup()
    await screen.findByText('Un')
    pointAt(chapter('B'))
    pointerDown(file('Un'))
    move(60, 60)
    release()
    await waitFor(() => expect(paths('B')).toContain('B/un.json'))
    expect(paths('A')).not.toContain('A/un.json')
  })

  it('le déposer sur son propre chapitre ne change rien, et le fantôme refuse', async () => {
    await setup()
    await screen.findByText('Un')
    pointAt(chapter('A'))
    pointerDown(file('Un'))
    move(60, 60)
    expect(await screen.findByTestId('tree-drag-ghost')).toHaveTextContent('Déposer sur un chapitre')
    release()
    expect(paths('A')).toEqual(['A/un.json'])
  })

  it('le fantôme annonce le chapitre visé, et disparaît après le dépôt', async () => {
    await setup()
    await screen.findByText('Un')
    pointAt(chapter('B'))
    pointerDown(file('Un'))
    move(60, 60)
    expect(await screen.findByTestId('tree-drag-ghost')).toHaveTextContent('Déplacer dans « B »')
    release()
    await waitFor(() => expect(screen.queryByTestId('tree-drag-ghost')).toBeNull())
  })

  it('Échap annule : rien ne bouge, plus de fantôme', async () => {
    await setup()
    await screen.findByText('Un')
    pointAt(chapter('B'))
    pointerDown(file('Un'))
    move(60, 60)
    fireEvent(window, new KeyboardEvent('keydown', { key: 'Escape' }))
    release()
    expect(screen.queryByTestId('tree-drag-ghost')).toBeNull()
    expect(paths('A')).toEqual(['A/un.json'])
  })

  it('un chapitre replié s’ouvre au survol, puis reçoit le fichier', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { user } = await setup()
      await user.click(chapter('B'))
      expect(screen.queryByText('Deux')).toBeNull()
      pointAt(chapter('B'))
      pointerDown(file('Un'))
      move(60, 60)
      await act(async () => void vi.advanceTimersByTime(700))
      expect(await screen.findByText('Deux')).toBeInTheDocument()
      release()
      await waitFor(() => expect(paths('B')).toContain('B/un.json'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('un simple clic sélectionne le fichier, un clic après un vrai drag ne le sélectionne pas', async () => {
    const { user } = await setup()
    await screen.findByText('Un')
    await user.click(file('Un'))
    expect(useExerciseStore.getState().selected).toBe('A/un.json')
    useExerciseStore.setState({ selected: null })
    pointAt(chapter('A'))
    pointerDown(file('Un'))
    move(60, 60)
    release()
    fireEvent.click(file('Un'))
    expect(useExerciseStore.getState().selected).toBeNull()
  })

  it('un clic droit ouvre le menu sans démarrer de drag', async () => {
    await setup()
    await screen.findByText('Un')
    pointerDown(file('Un'), 10, 10, 2)
    move(80, 80)
    release()
    expect(useTreeDragStore.getState().source).toBeNull()
    fireEvent.contextMenu(file('Un'))
    expect(await screen.findByRole('menuitem', { name: /Renommer/ })).toBeInTheDocument()
  })

  it('les boutons de fichier ne sont plus « draggable » (le navigateur ne dispute plus le geste)', async () => {
    await setup()
    await screen.findByText('Un')
    expect(file('Un')).not.toHaveAttribute('draggable', 'true')
  })
})
```

- [ ] **Step 2: Lancer, vérifier l'échec** — `cd apps/zachart-maths && bunx vitest run src/exercises/ExerciseTree.drag.test.tsx` → FAIL (le fichier ne bouge pas, `draggable` est présent, pas de fantôme).

- [ ] **Step 3: `ExerciseTree.tsx`** — modifications (lire le fichier avant, les chaînes ci-dessous sont celles du code actuel) :

(a) Imports : ajouter `import { beginTreeDrag, consumeSwallowedClick, TreeDragGhost, useTreeDragStore } from '@suite/shared/tree'` et `useRef` à l'import de `react` si absent.

(b) Supprimer la constante `const DRAG_TYPE = 'application/x-zachart-exercise'` et l'état `const [dropTarget, setDropTarget] = useState<string | null>(null)`. À leur place, dans le composant `ExerciseTree`, après `folded` :

```tsx
  // La cible de dépôt vient du moteur partagé : une ligne ne s'abonne qu'à ce qui la concerne.
  const dropTarget = useTreeDragStore(s => s.targetPath)
  const dragging = useTreeDragStore(s => s.source?.path ?? null)
  // Les poignées du moteur sont fixées à l'appui et vivent tout le geste : elles lisent l'état
  // replié du moment, pas celui du rendu qui les a créées.
  const foldedRef = useRef(folded)
  foldedRef.current = folded

  const startDrag = (e: React.PointerEvent<HTMLElement>, exo: { path: string; titre: string }) =>
    beginTreeDrag(e, { path: exo.path, name: exo.titre, kind: 'file' }, {
      // Un fichier ne se dépose que sur un AUTRE chapitre.
      canDrop: (source, target) => target !== splitPath(source.path)[0],
      isExpanded: target => !foldedRef.current.has(target),
      expand: target => setFolded(prev => { const next = new Set(prev); next.delete(target); return next }),
      onDrop: (source, target) => void useExerciseStore.getState().moveExercise(source.path, target),
    })
```

(c) Le conteneur d'un chapitre `<div key={chapter.name}>` devient `<div key={chapter.name} data-drop-folder={chapter.name}>` (toute la branche, fichiers compris, est une zone de dépôt).

(d) Le `<div onDragOver=… onDragLeave=… onDrop=… style={{ outline: dropTarget === chapter.name … }}>` de l'en-tête de chapitre devient :

```tsx
                  <div
                    data-tree-row={chapter.name}
                    data-tree-kind="folder"
                    style={{ outline: dropTarget === chapter.name ? '2px solid var(--ring)' : undefined }}
                  >
```

(les trois gestionnaires HTML5 sont supprimés).

(e) Le `<button type="button" draggable onDragStart=… aria-current=… onClick=…>` d'un fichier devient : retirer `draggable` et `onDragStart`, ajouter

```tsx
                              data-tree-row={exo.path}
                              data-tree-kind="file"
                              onPointerDown={e => startDrag(e, exo)}
```

et son `onClick` devient `onClick={() => { if (consumeSwallowedClick()) return; if (!exo.corrompu) store.select(exo.path) }}`. Le style existant y ajoute `opacity: dragging === exo.path ? 0.5 : undefined`.

(f) Rendre le fantôme une fois, à la fin du `<nav>`, juste avant `<ConfirmDialog …>` :

```tsx
      <TreeDragGhost
        describeTarget={chapter => `Déplacer dans « ${chapter} »`}
        refusal="Déposer sur un chapitre"
        icon={() => <FileText size={14} />}
      />
```

- [ ] **Step 4: Vérifier** — `cd apps/zachart-maths && bunx vitest run && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths` → PASS (les tests existants de l'arbre, dont ceux du clic droit des cycles précédents, restent verts). S'il existait un test de l'ancien glisser-déposer HTML5 (`grep -n "dragStart\|drop(" apps/zachart-maths/src/exercises/ExerciseTree*.test.tsx`), le réécrire sur le geste pointeur : il testait l'ancien mécanisme, que cette tâche remplace.

- [ ] **Step 5: Commit**

```bash
git add apps/zachart-maths/src/exercises/ExerciseTree.tsx apps/zachart-maths/src/exercises/ExerciseTree.drag.test.tsx
git commit -m "feat(zachart-maths): pointer-based drag-and-drop in the exercise tree (shared engine)"
```

---

### Task 5: Documentation, vérification complète, app réelle, push

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: `CLAUDE.md`.** Dans la liste des entrées publiques de `shared` (ligne `@suite/shared/{ui,theme,update,shell,commands,settings,search,math}`), ajouter `tree` : `@suite/shared/{ui,theme,update,shell,commands,settings,search,math,tree}`. Après la puce « Shell panels fold… », ajouter :

```
- Tree drag-and-drop (`@suite/shared/tree`): `beginTreeDrag(event, source, handlers)` is a pointer-event
  engine (5px threshold, hover-to-expand after 600 ms, Escape/blur/pointercancel cancel, the click
  that follows a real drag is swallowed once — `consumeSwallowedClick`), NOT HTML5 drag & drop,
  which is unreliable in the Tauri webview. The app injects `canDrop` / `isExpanded` / `expand` /
  `onDrop`; rows carry `data-tree-row`, `data-tree-kind` and the enclosing branch `data-drop-folder`.
  `TreeDragGhost` + `useTreeDragStore` are shared too. Mentale keeps `sidebar/treeDrag.ts`,
  `state/useTreeDragStore.ts` and `sidebar/TreeDragGhost.tsx` as thin facades over it; Maths'
  `ExerciseTree` uses it directly. `admin/` must not import it.
```

- [ ] **Step 2: Vérification complète** — `bun run test:all && bunx tsc --noEmit -p apps/zachart-maths && bunx tsc --noEmit -p packages/shared && bunx tsc --noEmit -p apps/zachart-mentale && cargo test --workspace` → tout PASS. La suite de Mentale a un test, `SettingsDialog > resets the card levels…`, qui dépasse parfois son délai quand toute la suite tourne en parallèle : s'il échoue seul, le relancer isolément et relancer la suite de Mentale ; ne pas le masquer, le signaler.

- [ ] **Step 3: Revue de toute la branche** (`git diff 52a68c3..HEAD`) : sans outil de sous-agent, relecture complète par l'exécutant, notée « self-review » ; surveiller en particulier que les tests de Mentale n'ont pas été modifiés (`git diff 52a68c3..HEAD --stat -- 'apps/zachart-mentale/**/*.test.*'` doit être vide) et que `shared/src/tree` n'importe rien d'une app.

- [ ] **Step 4: App réelle** (`bun run --filter zachart-maths tauri dev`, puis `bun run --filter zachart-mentale tauri dev`) — cocher à l'œil :
  1. Maths : glisser un fichier sur un autre chapitre le déplace, avec le fantôme « Déplacer dans « B » » ; sur son propre chapitre, le fantôme refuse ; Échap annule.
  2. Maths : un chapitre replié s'ouvre quand on le survole ~0,6 s ; un simple clic sur un fichier le sélectionne ; un clic droit ouvre le menu sans glisser.
  3. Mentale : glisser une carte vers un dossier, un dossier dans un dossier, vers un dossier replié ; le fantôme, la surbrillance et le dépliage au survol sont identiques à avant ; Échap annule ; la bande « Déplacer vers… » du menu propose les mêmes destinations.

- [ ] **Step 5: Commit puis push**

```bash
git add CLAUDE.md
git commit -m "docs: shared tree drag-and-drop engine in CLAUDE.md"
git push origin main
```

---

## Self-review (spec ↔ plan)

- Store, moteur, `consumeSwallowedClick`, `dropTargetAt`, export `package.json` → tâche 1. Fantôme + CSS déplacé → tâche 2. Mentale branchée, tests inchangés → tâche 3 (façades, écart signalé en tête). Maths en glisser-déposer pointeur, `draggable` retiré, dépliage au survol → tâche 4. Docs, vérification, app réelle, push → tâche 5. Frontières (`shared`, Maths, admin) → contraintes globales et étapes de vérification.
- Types cohérents entre tâches : `TreeDragSource { path, name, kind: string }` et `TreeDragHandlers` (1 → 3, 4), `TreeDragGhost` props `describeTarget` / `refusal` / `icon` (2 → 3, 4), `beginTreeDrag(event, source, handlers)` côté partagé et `beginTreeDrag(event, source)` côté façade Mentale (3).
- Points à vérifier par l'exécutant à la lecture du code réel : le geste `fireEvent.pointerDown` sous jsdom (la version de jsdom doit fournir `PointerEvent`, sinon construire l'évènement avec `MouseEvent` comme dans les tests du moteur), et le texte exact des chaînes de `ExerciseTree.tsx` à remplacer (le fichier a reçu des menus au cycle 2).
