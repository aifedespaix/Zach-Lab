# Sidebars rangeables et clic droit : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un rangement de panneau partagé par Zach'Math et Zachar't Mentale (même bande, mêmes raccourcis), et les clics droits de Mentale sur les sidebars de Maths.

**Architecture:** `@suite/shared/shell` gagne `usePanelCollapsed` (état rangé mémorisé), `CollapsedRail` (la bande de 32 px) et `CollapsiblePanel` (`ResizablePanel` + rangement + commande). Maths range ses deux panneaux avec `CollapsiblePanel`. Mentale ne reprend que l'état mémorisé (gauche) et la bande (droite). Les menus clic droit de Maths s'appuient sur le `ContextMenu` de `@suite/shared/ui`, avec de petites opérations pures nouvelles (dupliquer un fichier, réordonner et insérer un exercice dans une fiche).

**Tech Stack:** React 19, TypeScript, Bun workspaces, Vitest + Testing Library, zustand, Radix `ContextMenu` via `@suite/shared/ui`, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-03-sidebars-rangeables-design.md`

**Écarts avec la spec** (chacun décidé après lecture du code, à ledgerer comme `Ruling:` par l'exécutant) :
- **Pas d'animation de largeur au repli.** `CollapsiblePanel` remplace `ResizablePanel` par la bande, au lieu de faire varier la largeur d'un même élément ; la largeur d'avant est restaurée parce qu'elle est déjà sauvegardée. L'animation de `ResizablePanel` (largeur au reset) est inchangée. Le test « pas d'animation sous `prefers-reduced-motion` » disparaît avec elle.
- **Mentale, gauche : on ne mémorise que l'état.** La bande vit dans le même élément que le menu clic droit de `FileSidebar` ; la remplacer par `CollapsedRail` casserait ce menu dans l'état rangé. Seul `useState(false)` devient `usePanelCollapsed(...)`.
- **Mentale, droite : bande remplacée, état non mémorisé.** `manuallyCollapsed` y est remis à `false` quand une fiche s'ouvre (`CardDetailPanel.tsx:192`) : le mémoriser serait incohérent. Seule la bande devient `CollapsedRail`.
- **« Ranger le panneau » dans le vide de l'arbre**, pas dans un menu distinct de la sidebar gauche (même emplacement visible en pratique).

## Global Constraints

- **React, pas Vue.** Textes d'interface et commentaires en **français** (le code de `shared` garde ses commentaires dans la langue du fichier voisin : anglais dans `shell/`), commentaires `/** … */` sur le « pourquoi », comme le code voisin.
- `packages/shared` n'importe **jamais** une app ; imports relatifs dans `shared` ; les apps n'importent que les points d'entrée publics (`@suite/shared/{ui,theme,update,shell,commands,settings,search,math}`). `src/boundary.test.ts` (shared et Maths) et `admin/src/boundary.test.ts` restent verts.
- Tout le disque de Maths passe par le port `ExerciseFs` ; jamais `@tauri-apps/plugin-fs` dans la logique.
- Une fiche garde toujours au moins un exercice ; un fichier illisible (`corrompu`) reste visible mais ne s'ouvre ni ne s'édite.
- Commandes depuis la racine. Tests d'un fichier : `cd apps/zachart-maths && bunx vitest run <fichier>` (idem `packages/shared`, `apps/zachart-mentale`). Type-check : `bunx tsc --noEmit -p apps/zachart-maths` (ou `packages/shared`, `apps/zachart-mentale`).
- **Jamais** `git add -A` ni `git add -f` : toujours des chemins explicites. `apps/zachart-maths/src-tauri/Cargo.toml` est modifié dans l'arbre de travail, hors de ce chantier : ne pas l'ajouter.
- Message de commit : se termine par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Travail sur `main`, push à la fin seulement.
- **Écrire les fichiers avec l'outil Write/Edit**, pas avec des scripts shell ou Python à guillemets imbriqués (le cycle 1 a perdu du temps sur des échappements). Le script `task-start`/`task-done` du skill n'existe pas dans cette installation : tenir le registre à la main.

## Review Focus

Entrées que la spec implique et qu'aucun test « chemin heureux » n'attrape ; chacune a son test dans la tâche indiquée.

1. `localStorage` bloqué, ou valeur stockée absurde : le panneau reste déplié, jamais d'exception — tâche 1.
2. Panneau **rangé** : le raccourci qui le déplie doit encore fonctionner (la commande est enregistrée avant le retour anticipé) — tâches 1 et 3.
3. Dupliquer un fichier **illisible**, ou dont le nom est déjà pris (`… (copie)` existe) : erreur claire ou nom unique, jamais d'écrasement — tâche 4.
4. Réordonner / insérer sur le premier, le dernier ou un id inconnu : sans effet ou bornes respectées ; supprimer un exercice **qui n'est pas** l'exercice affiché ne change pas l'exercice affiché — tâche 4.
5. Un clic droit sur une ligne n'ouvre **jamais** aussi le menu du vide ; « Monter / Descendre » sont grisés aux bords — tâches 5 et 6.

---

### Task 1: `usePanelCollapsed`, `CollapsedRail`, `CollapsiblePanel` dans `@suite/shared/shell`

**Files:**
- Create: `packages/shared/src/shell/usePanelCollapsed.ts`, `usePanelCollapsed.test.ts`
- Create: `packages/shared/src/shell/CollapsedRail.tsx`, `CollapsiblePanel.tsx`, `CollapsiblePanel.test.tsx`
- Modify: `packages/shared/src/shell/index.ts`

**Interfaces:**
- Produces (tâches 2, 3) depuis `@suite/shared/shell` :
  - `usePanelCollapsed(key: string): readonly [collapsed: boolean, setCollapsed: (next: boolean | ((current: boolean) => boolean)) => void]`
  - `<CollapsedRail side="left" | "right" command={string} label={string} {...divProps} />`
  - `<CollapsiblePanel side label resizeLabel? storage collapsedKey toggleCommand foldLabel unfoldLabel>children</CollapsiblePanel>` — enregistre `toggleCommand` (libellé contextuel `foldLabel` / `unfoldLabel`), affiche la bande quand rangé, sinon un `ResizablePanel`.

- [ ] **Step 1: Test de `usePanelCollapsed`**

```ts
// packages/shared/src/shell/usePanelCollapsed.test.ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePanelCollapsed } from './usePanelCollapsed'

const KEY = 'test:collapsed'

describe('usePanelCollapsed', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('est déplié par défaut', () => {
    expect(renderHook(() => usePanelCollapsed(KEY)).result.current[0]).toBe(false)
  })

  it('mémorise le rangement et le relit au montage suivant', () => {
    const first = renderHook(() => usePanelCollapsed(KEY))
    act(() => first.result.current[1](true))
    expect(first.result.current[0]).toBe(true)
    first.unmount()
    expect(renderHook(() => usePanelCollapsed(KEY)).result.current[0]).toBe(true)
  })

  it('accepte une fonction, pour basculer', () => {
    const { result } = renderHook(() => usePanelCollapsed(KEY))
    act(() => result.current[1](c => !c))
    expect(result.current[0]).toBe(true)
    act(() => result.current[1](c => !c))
    expect(result.current[0]).toBe(false)
  })

  it('une valeur stockée absurde laisse le panneau déplié', () => {
    localStorage.setItem(KEY, 'peut-être')
    expect(renderHook(() => usePanelCollapsed(KEY)).result.current[0]).toBe(false)
  })

  it('un stockage bloqué ne lève jamais, en lecture comme en écriture', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqué') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqué') })
    const { result } = renderHook(() => usePanelCollapsed(KEY))
    expect(result.current[0]).toBe(false)
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer, vérifier l'échec** — `cd packages/shared && bunx vitest run src/shell/usePanelCollapsed.test.ts` → FAIL (module introuvable).

- [ ] **Step 3: `usePanelCollapsed.ts`**

```ts
// packages/shared/src/shell/usePanelCollapsed.ts
import { useCallback, useState } from 'react'

/**
 * Whether a side panel is folded away, remembered between launches.
 *
 * Same contract as `createPanelWidthStorage`: read synchronously on the first render (an effect
 * would paint the panel open for a frame and then fold it), a garbage value means "open", and a
 * blocked `localStorage` only costs the next launch its remembered state.
 */
export function usePanelCollapsed(key: string) {
  const [collapsed, set] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })

  const setCollapsed = useCallback(
    (next: boolean | ((current: boolean) => boolean)) => {
      set(current => {
        const value = typeof next === 'function' ? next(current) : next
        try {
          localStorage.setItem(key, value ? '1' : '0')
        } catch {
          // Best-effort: see the contract above.
        }
        return value
      })
    },
    [key],
  )

  return [collapsed, setCollapsed] as const
}
```

- [ ] **Step 4: Test de `CollapsiblePanel`** (couvre aussi `CollapsedRail`)

```tsx
// packages/shared/src/shell/CollapsiblePanel.test.tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineCommandCatalog, runCommand } from '../commands'
import { TooltipProvider } from '../ui'
import { CollapsiblePanel } from './CollapsiblePanel'
import { createPanelWidthStorage } from './panelWidth'

defineCommandCatalog({
  categories: [{ id: 'view', label: 'Affichage' }],
  commands: [{ id: 'test.toggle', label: 'Basculer le panneau', description: 'Test.', category: 'view', defaultBinding: 'Mod+B' }],
})

const storage = createPanelWidthStorage({ key: 'test:width', min: 100, max: 600, fallback: 240 })

function Panel({ side = 'left' as const }) {
  return (
    <TooltipProvider>
      <CollapsiblePanel
        side={side}
        label="Panneau test"
        storage={storage}
        collapsedKey="test:collapsed"
        toggleCommand="test.toggle"
        foldLabel="Replier le panneau test"
        unfoldLabel="Déplier le panneau test"
      >
        <p>Contenu du panneau</p>
      </CollapsiblePanel>
    </TooltipProvider>
  )
}

describe('CollapsiblePanel', () => {
  beforeEach(() => localStorage.clear())

  it('déplié : montre son contenu et sa poignée, pas la bande', () => {
    render(<Panel />)
    expect(screen.getByText('Contenu du panneau')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Déplier le panneau test' })).toBeNull()
  })

  it('la commande range le panneau : la bande remplace le contenu, qui n\'est plus monté', () => {
    render(<Panel />)
    act(() => void runCommand('test.toggle'))
    expect(screen.queryByText('Contenu du panneau')).toBeNull()
    expect(screen.getByRole('button', { name: 'Déplier le panneau test' })).toBeInTheDocument()
  })

  it('le bouton de la bande déplie, et la largeur d\'avant est restaurée', async () => {
    storage.save(333)
    render(<Panel />)
    act(() => void runCommand('test.toggle'))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Déplier le panneau test' }))
    expect(screen.getByText('Contenu du panneau')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Panneau test' })).toHaveStyle({ width: '333px' })
  })

  it('rangé, le raccourci (la commande) déplie encore : elle est enregistrée avant le retour anticipé', () => {
    render(<Panel />)
    act(() => void runCommand('test.toggle'))
    expect(screen.queryByText('Contenu du panneau')).toBeNull()
    act(() => void runCommand('test.toggle'))
    expect(screen.getByText('Contenu du panneau')).toBeInTheDocument()
  })

  it('l\'état rangé est mémorisé d\'un lancement à l\'autre', () => {
    const { unmount } = render(<Panel />)
    act(() => void runCommand('test.toggle'))
    unmount()
    render(<Panel />)
    expect(screen.queryByText('Contenu du panneau')).toBeNull()
  })

  it('la bande du côté droit porte son propre bouton', () => {
    localStorage.setItem('test:collapsed', '1')
    render(<Panel side="right" />)
    expect(screen.getByRole('button', { name: 'Déplier le panneau test' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Lancer, vérifier l'échec** — `bunx vitest run src/shell/CollapsiblePanel.test.tsx` → FAIL.

- [ ] **Step 6: `CollapsedRail.tsx` et `CollapsiblePanel.tsx`**

```tsx
// packages/shared/src/shell/CollapsedRail.tsx
import type { ComponentProps } from 'react'
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react'
import { CommandButton } from '../commands'
import type { PanelSide } from './usePanelResize'

interface CollapsedRailProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** The edge of the window the folded panel sits against. */
  side: PanelSide
  /** The command that unfolds the panel: its shortcut shows in the tooltip. */
  command: string
  /** The button's accessible name, e.g. « Déplier le panneau des fiches ». */
  label: string
}

/**
 * The 32px strip a folded side panel leaves behind: one button that unfolds it.
 *
 * Bottom-aligned so folding and unfolding does not make the control jump to another corner of
 * the screen. Extra props go to the strip itself, so an app can hang a `data-testid` on it.
 */
export function CollapsedRail({ side, command, label, style, ...rest }: CollapsedRailProps) {
  return (
    <div
      {...rest}
      style={{
        width: 32,
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingBottom: 8,
        ...(side === 'left' ? { borderRight: '1px solid var(--border)' } : { borderLeft: '1px solid var(--border)' }),
        ...style,
      }}
    >
      <CommandButton command={command} icon={side === 'left' ? PanelLeftOpen : PanelRightOpen} label={label} variant="ghost" size="icon-sm" />
    </div>
  )
}
```

```tsx
// packages/shared/src/shell/CollapsiblePanel.tsx
import type { ReactNode } from 'react'
import { useCommand } from '../commands'
import { CollapsedRail } from './CollapsedRail'
import type { PanelWidthStorage } from './panelWidth'
import { ResizablePanel } from './ResizablePanel'
import { usePanelCollapsed } from './usePanelCollapsed'
import type { PanelSide } from './usePanelResize'

interface CollapsiblePanelProps {
  side: PanelSide
  /** The region's accessible name. */
  label: string
  resizeLabel?: string
  storage: PanelWidthStorage
  /** `localStorage` key of the folded state. */
  collapsedKey: string
  /** The app's command id that folds and unfolds this panel. */
  toggleCommand: string
  /** The contextual label while open / folded, e.g. « Replier l'arborescence » / « Déplier l'arborescence ». */
  foldLabel: string
  unfoldLabel: string
  children?: ReactNode
}

/**
 * A `ResizablePanel` that can be folded to a 32px rail and brought back.
 *
 * The command is registered BEFORE the folded early-return: folding the panel away must not take
 * the very shortcut that unfolds it. The panel's width needs no care here — `ResizablePanel`
 * saves it as it changes and reads it back when it mounts again.
 *
 * The app puts its own fold button in the panel's header with `toggleCommand`; the folded rail
 * carries the unfold one.
 */
export function CollapsiblePanel({ side, label, resizeLabel, storage, collapsedKey, toggleCommand, foldLabel, unfoldLabel, children }: CollapsiblePanelProps) {
  const [collapsed, setCollapsed] = usePanelCollapsed(collapsedKey)
  useCommand(toggleCommand, () => setCollapsed(current => !current), true, collapsed ? unfoldLabel : foldLabel)

  if (collapsed) return <CollapsedRail side={side} command={toggleCommand} label={unfoldLabel} />
  return (
    <ResizablePanel side={side} label={label} resizeLabel={resizeLabel} storage={storage}>
      {children}
    </ResizablePanel>
  )
}
```

`index.ts` : ajouter
```ts
export * from './usePanelCollapsed'
export * from './CollapsedRail'
export * from './CollapsiblePanel'
```

- [ ] **Step 7: Vérifier** — `cd packages/shared && bunx vitest run src/shell src/boundary.test.ts && cd ../.. && bunx tsc --noEmit -p packages/shared` → PASS. Si `shared/src/commands/index.ts` n'exporte pas `defineCommandCatalog`/`runCommand`/`CommandButton`/`useCommand` sous ces noms, adapter les imports du test et des composants (ils sont exportés publiquement : `grep -n "export" packages/shared/src/commands/index.ts`).

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/shell/usePanelCollapsed.ts packages/shared/src/shell/usePanelCollapsed.test.ts packages/shared/src/shell/CollapsedRail.tsx packages/shared/src/shell/CollapsiblePanel.tsx packages/shared/src/shell/CollapsiblePanel.test.tsx packages/shared/src/shell/index.ts
git commit -m "feat(shared): foldable side panels (usePanelCollapsed, CollapsedRail, CollapsiblePanel)"
```

---

### Task 2: Mentale reprend l'état mémorisé (gauche) et la bande partagée (droite)

**Files:**
- Modify: `apps/zachart-mentale/src/components/sidebar/FileSidebar.tsx` (ligne ~125 : `useState(false)` de `collapsed`)
- Modify: `apps/zachart-mentale/src/components/detail/CardDetailPanel.tsx` (lignes ~279-300 : la bande)
- Modify (si besoin): `FileSidebar.test.tsx`

**Interfaces:**
- Consumes : `usePanelCollapsed`, `CollapsedRail` de `@suite/shared/shell` (tâche 1).

- [ ] **Step 1: Test de régression de la mémoire (gauche)** — ajouter à `FileSidebar.test.tsx`, en suivant la mise en place (`render`, helpers) qu'utilise le test voisin qui clique « Replier la barre latérale » (ligne ~336) :

```tsx
it('l\'état replié de la barre latérale est mémorisé d\'un lancement à l\'autre', async () => {
  // même mise en place que le test « Replier la barre latérale » voisin
  const { unmount } = renderSidebar()   // adapter : l'helper de rendu déjà utilisé dans ce fichier
  await userEvent.setup().click(screen.getByRole('button', { name: 'Replier la barre latérale' }))
  unmount()
  renderSidebar()
  expect(screen.getByRole('button', { name: 'Déplier la barre latérale' })).toBeInTheDocument()
})
```

Lire d'abord les lignes 320-360 de `FileSidebar.test.tsx` pour reprendre exactement leur rendu (mocks, stores) ; `renderSidebar` n'est qu'un nom de remplacement pour ce rendu. Ajouter dans le `beforeEach` du fichier `localStorage.removeItem('zachart-mentale:sidebar-collapsed')` : sans cela l'état rangé fuit d'un test au suivant.

- [ ] **Step 2: Lancer, vérifier l'échec** — `cd apps/zachart-mentale && bunx vitest run src/components/sidebar/FileSidebar.test.tsx -t "mémorisé"` → FAIL (l'état n'est pas relu).

- [ ] **Step 3: Gauche** — dans `FileSidebar.tsx`, remplacer `const [collapsed, setCollapsed] = useState(false)` par :

```tsx
// Remembered between launches, like the width beside it.
const [collapsed, setCollapsed] = usePanelCollapsed('zachart-mentale:sidebar-collapsed')
```

et ajouter `usePanelCollapsed` à l'import existant de `@suite/shared/shell` (la ligne importe déjà `PanelResizeHandle`/`usePanelResize` ; vérifier avec `grep -n "shared/shell" FileSidebar.tsx`). Retirer `useState` de l'import React seulement s'il n'est plus utilisé ailleurs dans le fichier.

- [ ] **Step 4: Droite** — dans `CardDetailPanel.tsx`, remplacer le bloc `if (isOpen && manuallyCollapsed) { return ( <> <TooltipProvider> <div style={{ width: 32, … }}> <CommandButton …/> </div> </TooltipProvider> {editor} </> ) }` par :

```tsx
  if (isOpen && manuallyCollapsed) {
    return (
      <>
        <TooltipProvider>
          <CollapsedRail
            side="right"
            command="view.toggleDetailPanel"
            label="Déplier le panneau des fiches"
          />
        </TooltipProvider>
        {editor}
      </>
    )
  }
```

avec `CollapsedRail` importé de `@suite/shared/shell`. Retirer `PanelRightOpen` de l'import `lucide-react` du fichier s'il n'est plus utilisé (`PanelRightClose` reste utilisé plus bas).

- [ ] **Step 5: Vérifier** — `cd apps/zachart-mentale && bunx vitest run src/components/sidebar src/components/detail 2>&1 | tail` puis `cd ../.. && bunx tsc --noEmit -p apps/zachart-mentale` → PASS (les tests « Replier/Déplier le panneau des fiches » et « la barre latérale » restent verts : mêmes noms accessibles). Si un test de `FileSidebar` échoue par fuite d'état entre tests, vider la clé dans son `beforeEach` (déjà prévu à l'étape 1).

- [ ] **Step 6: Commit**

```bash
git add apps/zachart-mentale/src/components/sidebar/FileSidebar.tsx apps/zachart-mentale/src/components/sidebar/FileSidebar.test.tsx apps/zachart-mentale/src/components/detail/CardDetailPanel.tsx
git commit -m "refactor(zachart-mentale): remembered sidebar fold state, shared CollapsedRail on the fiches panel"
```

---

### Task 3: Maths — panneaux rangeables, commandes, boutons d'en-tête

**Files:**
- Modify: `apps/zachart-maths/src/commands.ts`, `apps/zachart-maths/src/App.tsx`
- Modify: `apps/zachart-maths/src/exercises/ExerciseTree.tsx` (en-tête, ligne ~86-92), `apps/zachart-maths/src/cours/CoursePanel.tsx` (en-tête de `CoursesSection`)
- Test: `apps/zachart-maths/src/App.test.tsx` (ajouts)

**Interfaces:**
- Consumes : `CollapsiblePanel` (tâche 1).
- Produces : commandes `view.toggleTree` (`Mod+B`) et `view.toggleCourses` (`Mod+Shift+B`) ; catégorie `view`. Utilisées en tâches 5 et 6 (`runCommand('view.toggleTree')`).

- [ ] **Step 1: Tests (ajouts dans `describe('App base', …)`)**

```tsx
  it('le bouton d\'en-tête range le panneau gauche, la bande le rouvre', async () => {
    const user = userEvent.setup()
    render(<App />)
    await act(async () => {})
    await user.click(await screen.findByRole('button', { name: "Replier l'arborescence" }))
    expect(screen.queryByRole('complementary', { name: 'Panneau gauche' })).toBeNull()
    await user.click(screen.getByRole('button', { name: "Déplier l'arborescence" }))
    expect(screen.getByRole('complementary', { name: 'Panneau gauche' })).toBeInTheDocument()
  })

  it('Ctrl+B range le panneau gauche et le rouvre, même rangé', async () => {
    const user = userEvent.setup()
    render(<App />)
    await act(async () => {})
    await user.keyboard('{Control>}b{/Control}')
    expect(screen.queryByRole('complementary', { name: 'Panneau gauche' })).toBeNull()
    await user.keyboard('{Control>}b{/Control}')
    expect(screen.getByRole('complementary', { name: 'Panneau gauche' })).toBeInTheDocument()
  })

  it('Ctrl+Maj+B range le panneau des cours, indépendamment de celui de gauche', async () => {
    const user = userEvent.setup()
    render(<App />)
    await act(async () => {})
    await user.keyboard('{Control>}{Shift>}b{/Shift}{/Control}')
    expect(screen.queryByRole('complementary', { name: 'Panneau droit' })).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Panneau gauche' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Déplier le panneau des cours' }))
    expect(screen.getByRole('complementary', { name: 'Panneau droit' })).toBeInTheDocument()
  })

  it('les deux panneaux rangés se souviennent de leur état au lancement suivant', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await act(async () => {})
    await user.click(await screen.findByRole('button', { name: "Replier l'arborescence" }))
    unmount()
    render(<App />)
    await act(async () => {})
    expect(screen.queryByRole('complementary', { name: 'Panneau gauche' })).toBeNull()
  })
```

- [ ] **Step 2: Lancer, vérifier l'échec** — `cd apps/zachart-maths && bunx vitest run src/App.test.tsx` → les 4 nouveaux tests FAIL.

- [ ] **Step 3: `commands.ts`** — ajouter, avant `] as const` :

```ts
  {
    id: 'view.toggleTree',
    label: 'Afficher ou masquer l’arborescence',
    description: 'Replie le panneau des exercices pour donner toute la place à la zone de travail.',
    category: 'view',
    defaultBinding: 'Mod+B',
  },
  {
    id: 'view.toggleCourses',
    label: 'Afficher ou masquer les cours',
    description: 'Replie le panneau des cours et des notes pour donner toute la place à la zone de travail.',
    category: 'view',
    defaultBinding: 'Mod+Shift+B',
  },
```

et dans `categories` : `{ id: 'view', label: 'Affichage' },`.

- [ ] **Step 4: `App.tsx`** — remplacer l'import `ResizablePanel` par `CollapsiblePanel` (`import { AppShell, BootScreen, CollapsiblePanel, createPanelWidthStorage } from '@suite/shared/shell'`) et les deux panneaux :

```tsx
        left={
          <CollapsiblePanel
            side="left"
            label="Panneau gauche"
            resizeLabel="Redimensionner le panneau de gauche"
            storage={leftPanel}
            collapsedKey="zachart-maths:left-collapsed"
            toggleCommand="view.toggleTree"
            foldLabel="Replier l'arborescence"
            unfoldLabel="Déplier l'arborescence"
          >
            <ExerciseTree />
            <SheetOutline />
          </CollapsiblePanel>
        }
        right={
          <CollapsiblePanel
            side="right"
            label="Panneau droit"
            resizeLabel="Redimensionner le panneau de droite"
            storage={rightPanel}
            collapsedKey="zachart-maths:right-collapsed"
            toggleCommand="view.toggleCourses"
            foldLabel="Replier le panneau des cours"
            unfoldLabel="Déplier le panneau des cours"
          >
            <CoursePanel />
          </CollapsiblePanel>
        }
```

- [ ] **Step 5: Boutons d'en-tête.**

`ExerciseTree.tsx` : importer `PanelLeftClose` (lucide) et `CommandButton` (`@suite/shared/commands`) ; dans l'en-tête (`<strong>Mes exercices</strong>` + bouton « Nouveau chapitre »), regrouper les boutons :

```tsx
        <strong style={{ fontSize: 13 }}>Mes exercices</strong>
        <div style={{ display: 'flex', gap: 2 }}>
          <Button variant="ghost" size="icon-sm" aria-label="Nouveau chapitre" onClick={() => setNaming({ kind: 'new-chapter' })}>
            <FolderPlus />
          </Button>
          <CommandButton command="view.toggleTree" icon={PanelLeftClose} label="Replier l'arborescence" variant="ghost" size="icon-sm" />
        </div>
```

`CoursePanel.tsx`, `CoursesSection` : importer `PanelRightClose` et `CommandButton` (le fichier importe déjà `useCommand` de `@suite/shared/commands`) ; à la fin du `<header>`, après le bouton « Notes » :

```tsx
        <CommandButton command="view.toggleCourses" icon={PanelRightClose} label="Replier le panneau des cours" variant="ghost" size="icon-sm" />
```

- [ ] **Step 6: Vérifier** — `cd apps/zachart-maths && bunx vitest run && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths` → PASS. Les tests existants `App.test.tsx` (« deux panneaux », `separator` ×2) doivent rester verts : `CollapsiblePanel` déplié rend le même `ResizablePanel`.

- [ ] **Step 7: Commit**

```bash
git add apps/zachart-maths/src/commands.ts apps/zachart-maths/src/App.tsx apps/zachart-maths/src/App.test.tsx apps/zachart-maths/src/exercises/ExerciseTree.tsx apps/zachart-maths/src/cours/CoursePanel.tsx
git commit -m "feat(zachart-maths): foldable side panels with Ctrl+B and Ctrl+Shift+B"
```

---

### Task 4: Logique — dupliquer un fichier, réordonner et insérer un exercice dans une fiche

**Files:**
- Modify: `apps/zachart-maths/src/exercises/library.ts`, `sheet.ts`, `useExerciseStore.ts`, `useOpenExercise.ts`
- Test: `library.test.ts`, `sheet.test.ts`, `useOpenExercise` (via `ExerciseWorkspace.test.tsx` ou un nouveau `useOpenExercise.test.ts`)

**Interfaces:**
- Produces (tâche 5) :
  - `duplicateExercise(fs: ExerciseFs, path: string): Promise<string>` (`library.ts`) — retourne le chemin de la copie, placée juste après l'original.
  - `moveExercise(sheet: Sheet, id: string, delta: -1 | 1): Sheet` et `insertExerciseAt(sheet: Sheet, id: string, where: 'before' | 'after'): { sheet: Sheet; added: Exercise }` (`sheet.ts`).
  - Store de l'arbre : `duplicateExercise(path: string): Promise<void>` (sélectionne la copie).
  - `useOpenExercise` : `reorder(id: string, delta: -1 | 1): void`, `insertAt(id: string, where: 'before' | 'after'): void` (l'exercice ajouté devient l'exercice affiché), `removeById(id: string): void`.

- [ ] **Step 1: Tests de `sheet.ts`** (ajouter à `sheet.test.ts` ; reprendre son import de `newExercise`/`Sheet` et ses helpers, ou ces lignes) :

```ts
describe('moveExercise / insertExerciseAt', () => {
  const sheetOf = (...ids: string[]): Sheet => ({
    version: 2, id: 's', titre: 'T', exercices: ids.map(id => ({ ...newExercise(), id })),
  })
  const idsOf = (s: Sheet) => s.exercices.map(e => e.id)

  it("réordonne d'un cran, dans les deux sens", () => {
    expect(idsOf(moveExercise(sheetOf('a', 'b', 'c'), 'b', -1))).toEqual(['b', 'a', 'c'])
    expect(idsOf(moveExercise(sheetOf('a', 'b', 'c'), 'b', 1))).toEqual(['a', 'c', 'b'])
  })
  it('sans effet au premier et au dernier rang, ou sur un id inconnu (même fiche rendue)', () => {
    const s = sheetOf('a', 'b')
    expect(moveExercise(s, 'a', -1)).toBe(s)
    expect(moveExercise(s, 'b', 1)).toBe(s)
    expect(moveExercise(s, 'zz', 1)).toBe(s)
  })
  it('insère un exercice vierge avant ou après celui visé', () => {
    const before = insertExerciseAt(sheetOf('a', 'b'), 'b', 'before')
    expect(idsOf(before.sheet)).toEqual(['a', before.added.id, 'b'])
    const after = insertExerciseAt(sheetOf('a', 'b'), 'b', 'after')
    expect(idsOf(after.sheet)).toEqual(['a', 'b', after.added.id])
    expect(after.added.enonce).toBe('')
  })
  it("un id inconnu : l'exercice est ajouté à la fin, jamais perdu", () => {
    const r = insertExerciseAt(sheetOf('a'), 'zz', 'before')
    expect(idsOf(r.sheet)).toEqual(['a', r.added.id])
  })
})
```

(importer `moveExercise`, `insertExerciseAt` de `./sheet`.)

- [ ] **Step 2: Tests de `library.ts`** (ajouter à `library.test.ts`, qui importe déjà `createMemoryFs`, `createExercise`, `loadTree`, `readSheet`) :

```ts
describe('duplicateExercise', () => {
  const setup = async () => {
    const fs = createMemoryFs()
    await createChapter(fs, 'Fractions')
    const path = await createExercise(fs, 'Fractions', 'Calculs')
    return { fs, path }
  }

  it('crée une copie « (copie) » juste après l\'original, avec de nouveaux ids', async () => {
    const { fs, path } = await setup()
    await createExercise(fs, 'Fractions', 'Autre')
    const original = (await readSheet(fs, path))!
    const copyPath = await duplicateExercise(fs, path)
    expect(copyPath).toBe('Fractions/Calculs (copie).json')
    const copy = (await readSheet(fs, copyPath))!
    expect(copy.titre).toBe('Calculs (copie)')
    expect(copy.id).not.toBe(original.id)
    expect(copy.exercices[0].id).not.toBe(original.exercices[0].id)
    expect((await loadTree(fs))[0].exercises.map(e => e.titre)).toEqual(['Calculs', 'Calculs (copie)', 'Autre'])
  })

  it('une seconde copie prend un nom libre, sans jamais écraser', async () => {
    const { fs, path } = await setup()
    const first = await duplicateExercise(fs, path)
    const second = await duplicateExercise(fs, path)
    expect(second).not.toBe(first)
    expect(fs.files.has(first)).toBe(true)
    expect(fs.files.has(second)).toBe(true)
  })

  it('un fichier illisible ne se duplique pas : erreur claire, rien n\'est créé', async () => {
    const fs = createMemoryFs({ 'Fractions/cassé.json': '{pas du json' })
    await expect(duplicateExercise(fs, 'Fractions/cassé.json')).rejects.toThrow(/illisible/)
    expect([...fs.files.keys()]).toEqual(['Fractions/cassé.json'])
  })
})
```

(importer `duplicateExercise`, `createChapter` s'il manque.)

- [ ] **Step 3: Lancer, vérifier l'échec** — `cd apps/zachart-maths && bunx vitest run src/exercises/sheet.test.ts src/exercises/library.test.ts` → FAIL (fonctions absentes).

- [ ] **Step 4: `sheet.ts`** — ajouter :

```ts
/** Déplace un exercice d'un cran ; sans effet (la même fiche est rendue) au bord ou si `id` n'y est pas. */
export function moveExercise(sheet: Sheet, id: string, delta: -1 | 1): Sheet {
  const from = indexOf(sheet, id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= sheet.exercices.length) return sheet
  const exercices = [...sheet.exercices]
  ;[exercices[from], exercices[to]] = [exercices[to], exercices[from]]
  return { ...sheet, exercices }
}

/** Un exercice vierge juste avant ou après `id` ; à la fin si `id` n'y est pas. `added` est le créé. */
export function insertExerciseAt(sheet: Sheet, id: string, where: 'before' | 'after'): { sheet: Sheet; added: Exercise } {
  const added = newExercise()
  const at = indexOf(sheet, id)
  const exercices = [...sheet.exercices]
  exercices.splice(at < 0 ? exercices.length : where === 'before' ? at : at + 1, 0, added)
  return { sheet: { ...sheet, exercices }, added }
}
```

- [ ] **Step 5: `library.ts`** — ajouter :

```ts
/**
 * Copie un fichier juste après l'original : titre et fichier « … (copie) », avec de nouveaux
 * identifiants (la fiche et ses exercices) pour que rien ne soit partagé avec l'original.
 * Retourne le chemin de la copie.
 */
export async function duplicateExercise(fs: ExerciseFs, path: string): Promise<string> {
  const sheet = await readSheet(fs, path)
  if (sheet === null) throw new Error("Cet exercice est illisible, il ne peut pas être dupliqué.")
  const [chapter, file] = splitPath(path)
  const files = await exerciseFiles(fs, chapter)
  const stems = files.map(f => f.slice(0, -EXERCISE_EXT.length))
  const stem = uniqueName(`${file.slice(0, -EXERCISE_EXT.length)} (copie)`, stems)
  const copyFile = stem + EXERCISE_EXT
  const copy: Sheet = {
    ...sheet,
    id: crypto.randomUUID(),
    titre: `${sheet.titre} (copie)`,
    exercices: sheet.exercices.map(e => ({ ...e, id: crypto.randomUUID() })),
  }
  await saveSheet(fs, joinPath(chapter, copyFile), copy)
  const order = files.filter(f => f !== copyFile)
  order.splice(files.indexOf(file) + 1, 0, copyFile)
  await writeOrder(fs, chapter, order)
  return joinPath(chapter, copyFile)
}
```

- [ ] **Step 6: Store de l'arbre** — dans `useExerciseStore.ts` : dans l'interface `duplicateExercise(path: string): Promise<void>` et dans l'implémentation :

```ts
    async duplicateExercise(path) {
      const copy = await run(fs => library.duplicateExercise(fs, path))
      if (copy !== undefined) set({ selected: copy })
    },
```

- [ ] **Step 7: `useOpenExercise`** — importer `insertExerciseAt, moveExercise as moveInSheet` de `./sheet`. Dans l'interface :

```ts
  /** Déplace un exercice de la fiche d'un cran ; l'exercice affiché ne change pas. */
  reorder(id: string, delta: -1 | 1): void
  /** Un exercice vierge avant ou après `id` ; il devient l'exercice affiché. */
  insertAt(id: string, where: 'before' | 'after'): void
  /** Retire `id` ; l'exercice affiché ne change que s'il s'agissait de lui. */
  removeById(id: string): void
```

et dans l'implémentation (après `removeCurrent`) :

```ts
    reorder(id, delta) {
      const { sheet, currentId } = get()
      if (sheet === null || currentId === null) return
      const moved = moveInSheet(sheet, id, delta)
      if (moved !== sheet) change(moved, currentId)
    },
    insertAt(id, where) {
      const { sheet } = get()
      if (sheet === null) return
      const grown = insertExerciseAt(sheet, id, where)
      change(grown.sheet, grown.added.id)
    },
    removeById(id) {
      const { sheet, currentId } = get()
      if (sheet === null || currentId === null || sheet.exercices.length <= 1) return
      const dropped = dropExercise(sheet, id)
      if (dropped.sheet === sheet) return
      change(dropped.sheet, id === currentId ? dropped.focus : currentId)
    },
```

- [ ] **Step 8: Tests de `useOpenExercise`** (nouveau `useOpenExercise.test.ts`) :

```ts
import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryFs } from './memoryFs'
import { useExerciseStore } from './useExerciseStore'
import { useOpenExercise } from './useOpenExercise'

const ex = (id: string) => ({ id, numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '' })
const file = JSON.stringify({ version: 2, id: 's', titre: 'F', exercices: [ex('a'), ex('b'), ex('c')] })

async function openSheet() {
  await act(async () => useExerciseStore.getState().init(createMemoryFs({ 'Ch/f.json': file })))
  await act(async () => useExerciseStore.getState().select('Ch/f.json'))
  await act(async () => {})
}
const ids = () => useOpenExercise.getState().sheet!.exercices.map(e => e.id)

describe('useOpenExercise : réorganiser la fiche', () => {
  beforeEach(() => {
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null })
    useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' })
  })

  it("reorder déplace sans changer l'exercice affiché", async () => {
    await openSheet()
    act(() => useOpenExercise.getState().reorder('b', -1))
    expect(ids()).toEqual(['b', 'a', 'c'])
    expect(useOpenExercise.getState().currentId).toBe('a')
  })

  it("insertAt crée un exercice vierge et l'affiche", async () => {
    await openSheet()
    act(() => useOpenExercise.getState().insertAt('b', 'after'))
    expect(ids()).toHaveLength(4)
    expect(ids()[2]).toBe(useOpenExercise.getState().currentId)
  })

  it("removeById d'un autre exercice garde l'exercice affiché ; du courant, passe au voisin", async () => {
    await openSheet()
    act(() => useOpenExercise.getState().removeById('c'))
    expect(ids()).toEqual(['a', 'b'])
    expect(useOpenExercise.getState().currentId).toBe('a')
    act(() => useOpenExercise.getState().removeById('a'))
    expect(ids()).toEqual(['b'])
    expect(useOpenExercise.getState().currentId).toBe('b')
  })

  it('removeById ne retire jamais le seul exercice, ni un id inconnu', async () => {
    await openSheet()
    act(() => useOpenExercise.getState().removeById('zz'))
    expect(ids()).toHaveLength(3)
    act(() => { useOpenExercise.getState().removeById('a'); useOpenExercise.getState().removeById('b') })
    act(() => useOpenExercise.getState().removeById('c'))
    expect(ids()).toHaveLength(1)
  })
})
```

- [ ] **Step 9: Vérifier** — `cd apps/zachart-maths && bunx vitest run && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths` → PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/zachart-maths/src/exercises/library.ts apps/zachart-maths/src/exercises/library.test.ts apps/zachart-maths/src/exercises/sheet.ts apps/zachart-maths/src/exercises/sheet.test.ts apps/zachart-maths/src/exercises/useExerciseStore.ts apps/zachart-maths/src/exercises/useOpenExercise.ts apps/zachart-maths/src/exercises/useOpenExercise.test.ts
git commit -m "feat(zachart-maths): duplicate a file, reorder and insert exercises within a sheet"
```

---

### Task 5: Menus de l'arbre de gauche et de la fiche ouverte

**Files:**
- Modify: `apps/zachart-maths/src/exercises/ExerciseTree.tsx`, `SheetOutline.tsx`
- Test: `apps/zachart-maths/src/exercises/ExerciseTree.test.tsx` (ajouts), `SheetOutline.test.tsx` (ajouts)

**Interfaces:**
- Consumes : `duplicateExercise` du store, `reorder`/`insertAt`/`removeById`/`goTo` de `useOpenExercise` (tâche 4), `runCommand('view.toggleTree')` (tâche 3), `ContextMenu*` de `@suite/shared/ui`, `ConfirmDialog`.

- [ ] **Step 1: Tests de l'arbre** (ajouter à `ExerciseTree.test.tsx`, qui a `setup(files)` retournant `{ fs, user }` et rend `<ExerciseTree />`) :

```tsx
describe('clic droit sur l\'arbre', () => {
  const fiche = (titre: string) => JSON.stringify({ version: 2, id: titre, titre, exercices: [{ id: 'e', numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '' }] })
  const twoChapters = () => ({ 'A/un.json': fiche('Un'), 'B/deux.json': fiche('Deux') })
  const item = (name: RegExp) => screen.findByRole('menuitem', { name })

  it('sur le vide : nouveau chapitre, tout replier / déplier', async () => {
    await setup(twoChapters())
    fireEvent.contextMenu(screen.getByTestId('arbre-vide'))
    expect(await item(/Nouveau chapitre/)).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Tout replier/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Tout déplier/ })).toBeInTheDocument()
  })

  it('« Tout replier » cache les fichiers, « Tout déplier » les rend', async () => {
    const { user } = await setup(twoChapters())
    expect(await screen.findByText('Un')).toBeInTheDocument()
    fireEvent.contextMenu(screen.getByTestId('arbre-vide'))
    await user.click(await item(/Tout replier/))
    expect(screen.queryByText('Un')).toBeNull()
    fireEvent.contextMenu(screen.getByTestId('arbre-vide'))
    await user.click(await item(/Tout déplier/))
    expect(screen.getByText('Un')).toBeInTheDocument()
  })

  it('« Nouveau chapitre » ouvre le champ de nom', async () => {
    const { user } = await setup(twoChapters())
    fireEvent.contextMenu(screen.getByTestId('arbre-vide'))
    await user.click(await item(/Nouveau chapitre/))
    expect(screen.getByLabelText('Nom du nouveau chapitre')).toBeInTheDocument()
  })

  it('sur un chapitre : replier / déplier, et pas le menu du vide', async () => {
    const { user } = await setup(twoChapters())
    fireEvent.contextMenu(await screen.findByRole('button', { name: 'A' }))
    await user.click(await item(/Replier/))
    expect(screen.queryByText('Un')).toBeNull()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'A' }))
    expect(await item(/Déplier/)).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Tout replier/ })).toBeNull()
  })

  it('sur un fichier : « Dupliquer » crée la copie et la sélectionne ; absent… grisé pour un fichier illisible', async () => {
    const { user } = await setup({ ...twoChapters(), 'A/cassé.json': '{pas du json' })
    fireEvent.contextMenu(await screen.findByRole('button', { name: /Un/ }))
    await user.click(await item(/Dupliquer/))
    await waitFor(() => expect(useExerciseStore.getState().selected).toBe('A/Un (copie).json'))
    fireEvent.contextMenu(await screen.findByRole('button', { name: /cassé/ }))
    expect(await item(/Dupliquer/)).toHaveAttribute('aria-disabled', 'true')
  })

  it('« Ranger le panneau » du vide appelle la commande de rangement', async () => {
    const calls: number[] = []
    const registration = { run: () => void calls.push(1), enabled: true }
    useCommandRegistry.getState().register('view.toggleTree', registration)
    const { user } = await setup(twoChapters())
    fireEvent.contextMenu(screen.getByTestId('arbre-vide'))
    await user.click(await item(/Ranger le panneau/))
    expect(calls).toHaveLength(1)
    useCommandRegistry.getState().unregister('view.toggleTree', registration)
  })
})
```

imports : `fireEvent`, `waitFor` de Testing Library ; `useCommandRegistry` de `@suite/shared/commands` — vérifier qu'il est exporté (`grep -n "useCommandRegistry" packages/shared/src/commands/index.ts`) ; sinon enregistrer la commande par un petit composant utilisant `useCommand('view.toggleTree', …)` rendu à côté de l'arbre, et l'inclure dans `setup`.

- [ ] **Step 2: Tests de la fiche ouverte** (ajouter à `SheetOutline.test.tsx`, en reprenant son `setup` ; sinon ouvrir une fiche de 3 exercices comme dans les tests de `useOpenExercise` de la tâche 4 et rendre `<SheetOutline />`) :

```tsx
describe('clic droit sur la fiche ouverte', () => {
  const item = (name: RegExp) => screen.findByRole('menuitem', { name })

  it('Monter / Descendre sont grisés aux bords et réordonnent ailleurs', async () => {
    const user = userEvent.setup()
    await openThreeExercises()   // fiche a, b, c ; exercice a affiché
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 1' }))
    expect(await item(/Monter/)).toHaveAttribute('aria-disabled', 'true')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 2' }))
    await user.click(await item(/Monter/))
    expect(useOpenExercise.getState().sheet!.exercices.map(e => e.id)).toEqual(['b', 'a', 'c'])
  })

  it('« Aller à cet exercice » l\'affiche', async () => {
    const user = userEvent.setup()
    await openThreeExercises()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 3' }))
    await user.click(await item(/Aller à cet exercice/))
    expect(useOpenExercise.getState().currentId).toBe('c')
  })

  it('« Nouvel exercice avant / après » insère au bon endroit et l\'affiche', async () => {
    const user = userEvent.setup()
    await openThreeExercises()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 2' }))
    await user.click(await item(/Nouvel exercice après/))
    const { sheet, currentId } = useOpenExercise.getState()
    expect(sheet!.exercices.map(e => e.id).slice(0, 2)).toEqual(['a', 'b'])
    expect(sheet!.exercices[2].id).toBe(currentId)
  })

  it('« Supprimer » demande confirmation ; refusé, rien ne part', async () => {
    const user = userEvent.setup()
    await openThreeExercises()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 2' }))
    await user.click(await item(/Supprimer/))
    expect(await screen.findByText(/Supprimer cet exercice/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Annuler/ }))
    expect(useOpenExercise.getState().sheet!.exercices).toHaveLength(3)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 2' }))
    await user.click(await item(/Supprimer/))
    await user.click(await screen.findByRole('button', { name: /Supprimer|Confirmer/ }))
    expect(useOpenExercise.getState().sheet!.exercices.map(e => e.id)).toEqual(['a', 'c'])
  })

  it('le seul exercice d\'une fiche ne peut pas être supprimé : l\'entrée est grisée', async () => {
    await openOneExercise()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 1' }))
    expect(await item(/Supprimer/)).toHaveAttribute('aria-disabled', 'true')
  })
})
```

`openThreeExercises()` / `openOneExercise()` : ouvrent dans les stores (comme `openSheet` de la tâche 4) une fiche de 3 / 1 exercices d'ids `a`, `b`, `c` avec `enonce: ''`, et rendent `<SheetOutline />` ; les écrire dans le fichier de test. Le libellé exact du bouton de confirmation vient de `ConfirmDialog` (`packages/shared/src/ui/confirm-dialog.tsx`) : le lire et ajuster les deux `getByRole('button', …)`.

- [ ] **Step 3: Lancer, vérifier l'échec** — `cd apps/zachart-maths && bunx vitest run src/exercises/ExerciseTree.test.tsx src/exercises/SheetOutline.test.tsx` → FAIL.

- [ ] **Step 4: `ExerciseTree.tsx`.** Ajouter aux imports `Copy`-like icônes de lucide (`ChevronsDownUp`, `ChevronsUpDown`, `CopyPlus`, `PanelLeftClose`) et `runCommand` de `@suite/shared/commands`. Puis :

(a) **Menu du vide.** Envelopper le `<div style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>` (le conteneur qui contient `tree.map(...)`) :

```tsx
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-testid="arbre-vide" style={{ overflowY: 'auto', flex: 1, paddingBottom: 8 }}>
            {/* … contenu existant inchangé … */}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setNaming({ kind: 'new-chapter' })}><FolderPlus />Nouveau chapitre</ContextMenuItem>
          <ContextMenuItem disabled={tree.length === 0} onSelect={() => setFolded(new Set(tree.map(c => c.name)))}><ChevronsDownUp />Tout replier</ContextMenuItem>
          <ContextMenuItem disabled={folded.size === 0} onSelect={() => setFolded(new Set())}><ChevronsUpDown />Tout déplier</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void runCommand('view.toggleTree')}><PanelLeftClose />Ranger le panneau</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
```

(b) **Arrêt de la propagation.** Sur chacun des deux `<ContextMenuTrigger asChild>` existants (chapitre, fichier), ajouter `onContextMenu={e => e.stopPropagation()}`.

(c) **Chapitre.** Dans son `ContextMenuContent`, avant « Nouvel exercice » :

```tsx
                  <ContextMenuItem onSelect={() => toggle(chapter.name)}>{open ? 'Replier' : 'Déplier'}</ContextMenuItem>
                  <ContextMenuSeparator />
```

(d) **Fichier.** Dans son `ContextMenuContent`, après « Descendre » :

```tsx
                            <ContextMenuItem disabled={exo.corrompu} onSelect={() => void store.duplicateExercise(exo.path)}><CopyPlus />Dupliquer</ContextMenuItem>
```

- [ ] **Step 5: `SheetOutline.tsx`.** Imports : `useState` existe ; ajouter `ArrowDown, ArrowUp, CornerDownRight, CornerUpRight, Trash2` (lucide), `ConfirmDialog, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger` de `@suite/shared/ui`. État : `const [deleting, setDeleting] = useState<string | null>(null)`. Envelopper chaque `<button …>` de ligne :

```tsx
              <li key={exercise.id}>
                <ContextMenu>
                  <ContextMenuTrigger asChild onContextMenu={e => e.stopPropagation()}>
                    <button /* … bouton existant inchangé … */ >{/* … */}</button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => useOpenExercise.getState().goTo(exercise.id)}>Aller à cet exercice</ContextMenuItem>
                    <ContextMenuItem disabled={i === 0} onSelect={() => useOpenExercise.getState().reorder(exercise.id, -1)}><ArrowUp />Monter</ContextMenuItem>
                    <ContextMenuItem disabled={i === sheet.exercices.length - 1} onSelect={() => useOpenExercise.getState().reorder(exercise.id, 1)}><ArrowDown />Descendre</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => useOpenExercise.getState().insertAt(exercise.id, 'before')}><CornerUpRight />Nouvel exercice avant</ContextMenuItem>
                    <ContextMenuItem onSelect={() => useOpenExercise.getState().insertAt(exercise.id, 'after')}><CornerDownRight />Nouvel exercice après</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem variant="destructive" disabled={sheet.exercices.length <= 1} onSelect={() => setDeleting(exercise.id)}><Trash2 />Supprimer</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </li>
```

et, à la fin de la `<section>` :

```tsx
      <ConfirmDialog
        open={deleting !== null}
        title="Supprimer cet exercice ?"
        description={`L'exercice sera effacé de la fiche « ${sheet.titre} ». Cette action est définitive.`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => { if (deleting !== null) useOpenExercise.getState().removeById(deleting); setDeleting(null) }}
      />
```

(le `if (sheet === null) return null` existant précède ces ajouts : `sheet` y est non nul ; les hooks `useState` restent déclarés **avant** ce retour.)

- [ ] **Step 6: Vérifier** — `cd apps/zachart-maths && bunx vitest run && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths` → PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/zachart-maths/src/exercises/ExerciseTree.tsx apps/zachart-maths/src/exercises/ExerciseTree.test.tsx apps/zachart-maths/src/exercises/SheetOutline.tsx apps/zachart-maths/src/exercises/SheetOutline.test.tsx
git commit -m "feat(zachart-maths): right-click menus on the file tree and the open sheet"
```

---

### Task 6: Menus du panneau des cours

**Files:**
- Modify: `apps/zachart-maths/src/exercises/FieldContextMenu.tsx` (prop `extra`)
- Modify: `apps/zachart-maths/src/cours/CoursePanel.tsx`
- Test: `apps/zachart-maths/src/cours/CoursePanel.test.tsx` (ajouts)

**Interfaces:**
- Consumes : `useCoursesStore` (`setSearchOpen`, `setNotesVisible`, `select`), `runCommand('view.toggleCourses')`, `FieldContextMenu`.
- Produces : `FieldContextMenu` accepte `extra?: ReactNode` — des `ContextMenuItem` ajoutés à la fin, après un séparateur.

- [ ] **Step 1: Tests** (ajouter à `CoursePanel.test.tsx`, dont `setup`, `open`, `exo` existent) :

```tsx
describe('clic droit sur le panneau des cours', () => {
  const item = (name: RegExp) => screen.findByRole('menuitem', { name })

  it('sur le vide : chercher un cours, notes, ranger le panneau', async () => {
    const { user } = await setup()
    fireEvent.contextMenu(screen.getByTestId('cours-vide'))
    await user.click(await item(/Chercher un cours/))
    expect(useCoursesStore.getState().searchOpen).toBe(true)
  })

  it('« Masquer les notes » / « Afficher les notes » suit l\'état', async () => {
    const { user } = await setup()
    fireEvent.contextMenu(screen.getByTestId('cours-vide'))
    await user.click(await item(/Masquer les notes/))
    expect(useCoursesStore.getState().notesVisible).toBe(false)
    fireEvent.contextMenu(screen.getByTestId('cours-vide'))
    expect(await item(/Afficher les notes/)).toBeInTheDocument()
  })

  it('« Ranger le panneau » appelle la commande de rangement', async () => {
    const calls: number[] = []
    const registration = { run: () => void calls.push(1), enabled: true }
    useCommandRegistry.getState().register('view.toggleCourses', registration)
    const { user } = await setup()
    fireEvent.contextMenu(screen.getByTestId('cours-vide'))
    await user.click(await item(/Ranger le panneau/))
    expect(calls).toHaveLength(1)
    useCommandRegistry.getState().unregister('view.toggleCourses', registration)
  })

  it('sur un cours suggéré : ouvrir, copier le titre ; pas le menu du vide', async () => {
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => void written.push(t) }, configurable: true })
    const { user } = await setup({ 'Fractions/a.json': exo('Calculs') })
    await open('Fractions/a.json')
    const group = await screen.findByRole('group', { name: 'Cours suggérés' })
    const row = within(group).getAllByRole('button')[0]
    fireEvent.contextMenu(row)
    expect(screen.queryByRole('menuitem', { name: /Chercher un cours/ })).toBeNull()
    await user.click(await item(/Copier le titre/))
    expect(written).toHaveLength(1)
    expect(row.textContent).toContain(written[0])
    fireEvent.contextMenu(row)
    await user.click(await item(/Ouvrir/))
    expect(useCoursesStore.getState().selectedId).not.toBeNull()
  })

  it('dans les notes : le menu de champ, plus « Masquer les notes »', async () => {
    await setup()
    fireEvent.contextMenu(screen.getByLabelText('Mes notes'))
    expect(await item(/Copier/)).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Masquer les notes/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Chercher un cours/ })).toBeNull()
  })
})
```

imports : `fireEvent`, `useCommandRegistry` (voir la note de la tâche 5).

- [ ] **Step 2: Lancer, vérifier l'échec** — `cd apps/zachart-maths && bunx vitest run src/cours/CoursePanel.test.tsx` → FAIL.

- [ ] **Step 3: `FieldContextMenu.tsx`** — ajouter la prop et le rendu :

```tsx
export function FieldContextMenu({ kind, extra, children }: { kind: 'text' | 'math'; extra?: ReactNode; children: ReactNode }) {
```

et, juste avant `</ContextMenuContent>` :

```tsx
        {extra !== undefined && (
          <>
            <ContextMenuSeparator />
            {extra}
          </>
        )}
```

- [ ] **Step 4: `CoursePanel.tsx`.** Imports : `Copy`, `ExternalLink`, `PanelRightClose` (déjà ajouté tâche 3), `Eye` (lucide) ; `ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger` de `@suite/shared/ui` ; `runCommand` de `@suite/shared/commands` ; `FieldContextMenu` de `../exercises/FieldContextMenu`.

(a) **Cours suggéré.** Envelopper son `<button …>` :

```tsx
              <li key={course.id}>
                <CourseMenu course={course} onOpen={() => select(course.id)}>
                  <button /* … bouton existant inchangé … */ >{/* … */}</button>
                </CourseMenu>
              </li>
```

avec, au-dessus de `CoursesSection` :

```tsx
const copyTitle = (titre: string) => void navigator.clipboard?.writeText(titre).catch(() => {})

/** Le clic droit d'un cours : l'ouvrir, copier son titre. Il arrête l'évènement : le menu du vide ne s'ouvre pas. */
function CourseMenu({ course, onOpen, children }: { course: Course; onOpen: () => void; children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={e => e.stopPropagation()}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onOpen}><ExternalLink size={14} />Ouvrir</ContextMenuItem>
        <ContextMenuItem onSelect={() => copyTitle(course.titre)}><Copy size={14} />Copier le titre</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

(importer `type ReactNode` de `react`). Même enveloppe `CourseMenu` autour de l'`<article aria-label={selected.titre}>` du cours ouvert (`onOpen={() => select(selected.id)}`).

(b) **Notes.** Envelopper le `<textarea aria-label="Mes notes" …>` dans :

```tsx
      <FieldContextMenu
        kind="text"
        extra={<ContextMenuItem onSelect={() => setNotesVisible(false)}><EyeOff size={14} />Masquer les notes</ContextMenuItem>}
      >
        <textarea /* … inchangé … */ />
      </FieldContextMenu>
```

(`ContextMenuItem` est importé pour (a) ; `EyeOff` l'est déjà.)

(c) **Vide du panneau.** Dans `CoursePanel`, envelopper la `<div>` racine :

```tsx
export function CoursePanel({ courses = COURSES }: { courses?: readonly Course[] }) {
  const notesVisible = useCoursesStore(s => s.notesVisible)
  useCommand('cours.search', () => useCoursesStore.getState().setSearchOpen(true))
  useCommand('notes.toggle', () => useCoursesStore.getState().setNotesVisible(!useCoursesStore.getState().notesVisible))
  const { setSearchOpen, setNotesVisible } = useCoursesStore.getState()
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div data-testid="cours-vide" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>
          <CoursesSection courses={courses} />
          {notesVisible && <NotesSection />}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => setSearchOpen(true)}><Search size={14} />Chercher un cours</ContextMenuItem>
        <ContextMenuItem onSelect={() => setNotesVisible(!notesVisible)}>
          {notesVisible ? <EyeOff size={14} /> : <Eye size={14} />}
          {notesVisible ? 'Masquer les notes' : 'Afficher les notes'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => void runCommand('view.toggleCourses')}><PanelRightClose size={14} />Ranger le panneau</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

(`Search` est déjà importé.)

- [ ] **Step 5: Vérifier** — `cd apps/zachart-maths && bunx vitest run && cd ../.. && bunx tsc --noEmit -p apps/zachart-maths` → PASS (les tests de `FieldContextMenu` du cycle 1 restent verts : `extra` est facultatif).

- [ ] **Step 6: Commit**

```bash
git add apps/zachart-maths/src/exercises/FieldContextMenu.tsx apps/zachart-maths/src/cours/CoursePanel.tsx apps/zachart-maths/src/cours/CoursePanel.test.tsx
git commit -m "feat(zachart-maths): right-click menus on the courses panel (blank area, course, notes)"
```

---

### Task 7: Documentation, vérification complète, revue de la branche, app réelle

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: `CLAUDE.md`.** Dans la liste des points d'entrée de `shared`, après la ligne `Math is KaTeX …` et ses lignes, ajouter :

```
- Shell panels fold: `usePanelCollapsed(key)` (remembered like the width), `CollapsedRail` (the 32px
  strip with the unfold button) and `CollapsiblePanel` (`ResizablePanel` + fold + the app's toggle
  command, registered before the folded early-return so the shortcut still unfolds). Maths uses it
  on both sides (`view.toggleTree` Mod+B, `view.toggleCourses` Mod+Shift+B); Mentale only reuses
  `usePanelCollapsed` (left) and `CollapsedRail` (right).
```

Dans « Zach'Math », à la fin de la puce `exercises/`, ajouter : `duplicateExercise` (library) copies a file right after the original; `moveExercise` / `insertExerciseAt` (sheet) reorder and insert inside a sheet; right-click menus of the tree, of the open sheet and of the courses panel stop propagation so the blank-area menu never opens over a row's.

- [ ] **Step 2: Vérification complète** — `bun run test:all && bunx tsc --noEmit -p apps/zachart-maths && bunx tsc --noEmit -p packages/shared && bunx tsc --noEmit -p apps/zachart-mentale && cargo test --workspace` → tout PASS. Un échec sans lien avec ce chantier : le dire tel quel.

- [ ] **Step 3: Revue de toute la branche** (`git diff 340a8a6..HEAD`) : sans outil de sous-agent, relecture complète par l'exécutant, notée « self-review » ; surveiller en particulier les ids/clefs `localStorage` (deux apps, jamais la même clé), les hooks placés avant les retours anticipés, et la propagation des menus.

- [ ] **Step 4: App réelle** (`bun run --filter zachart-maths tauri dev`, puis `bun run --filter zachart-mentale tauri dev`) — cocher à l'œil :
  1. Maths : Ctrl+B et Ctrl+Maj+B rangent chaque panneau ; la bande rouvre ; la largeur d'avant revient ; l'état survit à un redémarrage.
  2. Maths : clic droit sur le vide de l'arbre, un chapitre, un fichier, une ligne de la fiche, le vide du panneau des cours, un cours, les notes ; jamais deux menus à la fois.
  3. Maths : dupliquer un fichier ; monter/descendre/insérer/supprimer un exercice depuis la fiche ouverte.
  4. Mentale : Ctrl+B et Ctrl+Maj+B comme avant ; l'arborescence rangée le reste après redémarrage ; la bande du panneau des fiches est identique à l'ancienne.

- [ ] **Step 5: Commit puis push**

```bash
git add CLAUDE.md
git commit -m "docs: foldable shared panels and Zach'Math sidebar menus in CLAUDE.md"
git push origin main
```

---

## Self-review (spec ↔ plan)

- Rangement partagé (`usePanelCollapsed`, `CollapsedRail`, `CollapsiblePanel`) → tâche 1. Mentale (état gauche, bande droite) → tâche 2, avec écarts motivés en tête. Maths panneaux, commandes, boutons d'en-tête → tâche 3. Logique nouvelle (dupliquer, réordonner, insérer) → tâche 4. Arbre (vide, chapitre, fichier), fiche ouverte, « Ranger le panneau » → tâche 5. Panneau droit (vide, cours, notes) → tâche 6. Docs, revue, app → tâche 7.
- Types cohérents entre tâches : `duplicateExercise` (4 → 5), `reorder`/`insertAt`/`removeById` (4 → 5), `view.toggleTree`/`view.toggleCourses` (3 → 5, 6), `FieldContextMenu extra` (6).
- Points à vérifier par l'exécutant à la lecture du code réel (signalés dans les étapes) : noms exportés de `@suite/shared/commands` (`useCommandRegistry`, `runCommand`), libellés du bouton de `ConfirmDialog`, helper de rendu de `FileSidebar.test.tsx`, helpers de `SheetOutline.test.tsx`.
