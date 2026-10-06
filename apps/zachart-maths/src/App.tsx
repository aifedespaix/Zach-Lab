import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { BookOpen, ClipboardCheck, Download, ChevronsDownUp, Redo2, Undo2, ListChecks, ListFilter, FolderPlus, Highlighter, Keyboard, Minus, Moon, Plus, Rows3, NotebookPen, Search, Settings as SettingsIcon, Shapes } from 'lucide-react'
import {
  CommandButton,
  CommandDropdownItem,
  CommandPalette,
  useCommand,
  useGlobalShortcuts,
  useShortcutSettingsStore,
} from '@suite/shared/commands'
import { SettingsDialog, ShortcutSettingsPanel } from '@suite/shared/settings'
import { AppShell, BootScreen, CollapsiblePanel, OverflowToolbar, createPanelWidthStorage, type OverflowItem } from '@suite/shared/shell'
import { startCircularThemeTransition, useResolvedTheme, useThemeDomSync, useThemeStore } from '@suite/shared/theme'
import { TooltipProvider } from '@suite/shared/ui'
import { UpdateReadyBanner, UpdateSettingsSection, useAppUpdater } from '@suite/shared/update'
import { AnimatedLogo } from './AnimatedLogo'
import './commands'
import { CoursePanel } from './cours/CoursePanel'
import { ExerciseTree } from './exercises/ExerciseTree'
import { ExerciseWorkspace } from './exercises/ExerciseWorkspace'
import { AdvancedSearchDialog } from './exercises/AdvancedSearchDialog'
import { ReviewDialog } from './exercises/ReviewDialog'
import { useCorrectionView } from './exercises/useCorrectionView'
import { SheetOutline } from './exercises/SheetOutline'
import { TreeRailLabel } from './exercises/TreeRailLabel'
import { ToolbarSettingsPanel } from './exercises/ToolbarSettingsPanel'
import { useCompact } from './exercises/useCompact'
import { useZoom } from './exercises/useZoom'
import { useUnitColors } from './exercises/useUnitColors'
import { useToolbarFamilies } from './exercises/useToolbarFamilies'
import { useOpenExercise } from './exercises/useOpenExercise'
import { createTauriFs, defaultExercisesRoot } from './exercises/tauriFs'
import { useExerciseStore } from './exercises/useExerciseStore'

// Each app picks its own bounds and its own storage keys: two apps of the suite
// share a machine, but never a webview.
/** Durée minimale de l'écran de chargement : en dessous, l'animation clignoterait sans rien dire. */
const BOOT_FLOOR_MS = 1300

const leftPanel = createPanelWidthStorage({ key: 'zachart-maths:left-width', min: 180, max: 520, fallback: 240 })
const rightPanel = createPanelWidthStorage({ key: 'zachart-maths:right-width', min: 300, max: 640, fallback: 400 })

/**
 * The starting point of every app of the suite: the shared shell with two empty
 * side panels, a toolbar, the command palette, a settings window that holds the
 * shortcuts, and the update banner.
 *
 * To make an app of it: put the file tree (or whatever navigates) in `left`,
 * the details in `right`, the work area in the `<main>`, and add the settings
 * panels the app needs to `panels`.
 */
export default function App() {
  useThemeDomSync()
  useGlobalShortcuts()

  const { updateReady, dismissed, applyUpdate, dismissUpdate, status: updateStatus, checkNow } = useAppUpdater()
  const resolvedTheme = useResolvedTheme()
  const exercisesLoaded = useExerciseStore(state => state.loaded)
  // Le M a le temps de s'écrire une fois, même si le disque répond tout de suite.
  const [bootFloorElapsed, setBootFloorElapsed] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setBootFloorElapsed(true), BOOT_FLOOR_MS)
    return () => clearTimeout(timer)
  }, [])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void useShortcutSettingsStore.getState().init()
  }, [])

  useEffect(() => {
    void defaultExercisesRoot()
      .then(root => useExerciseStore.getState().init(createTauriFs(root)))
      .catch(e => useExerciseStore.setState({ loaded: true, error: e instanceof Error ? e.message : String(e) }))
  }, [])

  const unitColors = useUnitColors(state => state.enabled)
  useCommand('app.palette', () => setPaletteOpen(true))
  useCommand('app.settings', () => setSettingsOpen(true))
  const onlyToCorrect = useCorrectionView(state => state.onlyToCorrect)
  useCommand('review.open', () => useCorrectionView.getState().setReviewOpen(true))
  useCommand('correction.toggleHide', () => useCorrectionView.getState().toggleHideCorrected())
  const compact = useCompact(state => state.enabled)
  const zoom = useZoom(state => state.percent)
  useEffect(() => {
    const root = document.documentElement
    root.style.zoom = zoom === 100 ? '' : `${zoom}%`
    // `vh` n'est pas mis à l'échelle par `zoom` : sans cette division, dézoomé on laisse une bande vide
    // en bas, zoomé on dépasse la fenêtre et la page défile.
    root.style.setProperty('--app-height', `calc(100vh / ${zoom / 100})`)
  }, [zoom])
  const canUndo = useOpenExercise(state => state.undoDepth > 0)
  const canRedo = useOpenExercise(state => state.redoDepth > 0)
  useCommand('edit.undo', () => useOpenExercise.getState().undo(), canUndo)
  useCommand('edit.redo', () => useOpenExercise.getState().redo(), canRedo)
  useCommand('view.toggleCompact', () => useCompact.getState().toggle())
  useCommand('view.zoomOut', () => useZoom.getState().zoomOut())
  useCommand('view.zoomIn', () => useZoom.getState().zoomIn())
  useCommand('view.zoomReset', () => useZoom.getState().reset())
  useCommand('view.toggleUnitColors', () => useUnitColors.getState().toggle())
  useCommand('app.toggleTheme', () => {
    startCircularThemeTransition({
      x: window.innerWidth / 2,
      y: 0,
      apply: () => useThemeStore.getState().setMode(resolvedTheme === 'dark' ? 'light' : 'dark'),
    })
  })

  const button = (command: string, icon: LucideIcon, active?: boolean) => (
    <CommandButton command={command} icon={icon} variant={active ? 'secondary' : 'ghost'} size="icon-sm" />
  )
  // De gauche à droite ; `priority` : ce qui reste le plus longtemps quand la barre manque de place.
  const toolbarItems: OverflowItem[] = [
    { id: 'undo', node: button('edit.undo', Undo2), menu: <CommandDropdownItem command="edit.undo" icon={Undo2} />, priority: 9 },
    { id: 'redo', node: button('edit.redo', Redo2), menu: <CommandDropdownItem command="edit.redo" icon={Redo2} />, priority: 9 },
    { id: 'palette', node: button('app.palette', Search), menu: <CommandDropdownItem command="app.palette" icon={Search} />, priority: 8 },
    { id: 'cours', node: button('cours.search', BookOpen), menu: <CommandDropdownItem command="cours.search" icon={BookOpen} />, priority: 5 },
    { id: 'next', node: button('correction.next', ListChecks), menu: <CommandDropdownItem command="correction.next" icon={ListChecks} />, priority: 4 },
    { id: 'review', node: button('review.open', ClipboardCheck), menu: <CommandDropdownItem command="review.open" icon={ClipboardCheck} />, priority: 3 },
    { id: 'notes', node: button('notes.toggle', NotebookPen), menu: <CommandDropdownItem command="notes.toggle" icon={NotebookPen} />, priority: 3 },
    { id: 'colors', node: button('view.toggleUnitColors', Highlighter, unitColors), menu: <CommandDropdownItem command="view.toggleUnitColors" icon={Highlighter} />, priority: 2 },
    { id: 'compact', node: button('view.toggleCompact', Rows3, compact), menu: <CommandDropdownItem command="view.toggleCompact" icon={Rows3} />, priority: 2 },
    {
      id: 'zoom',
      node: (
        <div role="group" aria-label="Zoom" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CommandButton command="view.zoomOut" icon={Minus} variant="ghost" size="icon-sm" />
          <button
            type="button"
            aria-label="Zoom à 100 %"
            title="Remettre le zoom à 100 %"
            onClick={() => useZoom.getState().reset()}
            style={{ minWidth: 44, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
          >{zoom} %</button>
          <CommandButton command="view.zoomIn" icon={Plus} variant="ghost" size="icon-sm" />
        </div>
      ),
      menu: (
        <>
          <CommandDropdownItem command="view.zoomOut" icon={Minus} />
          <CommandDropdownItem command="view.zoomIn" icon={Plus} />
          <CommandDropdownItem command="view.zoomReset" />
        </>
      ),
      priority: 1,
    },
    { id: 'theme', node: button('app.toggleTheme', Moon), menu: <CommandDropdownItem command="app.toggleTheme" icon={Moon} />, priority: 6 },
    { id: 'settings', node: button('app.settings', SettingsIcon), menu: <CommandDropdownItem command="app.settings" icon={SettingsIcon} />, priority: 7 },
  ]

  return (
    <TooltipProvider>
      <AppShell
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
            railContent={<TreeRailLabel />}
            railWidth={40}
            footer={
              <>
                <CommandButton command="tree.newChapter" icon={FolderPlus} variant="ghost" size="icon-sm" />
                <CommandButton command="tree.toggleAll" icon={ChevronsDownUp} variant="ghost" size="icon-sm" />
                <CommandButton command="tree.onlyToCorrect" icon={ListFilter} variant={onlyToCorrect ? 'secondary' : 'ghost'} size="icon-sm" />
              </>
            }
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
            railContent="Afficher les cours"
          >
            <CoursePanel />
          </CollapsiblePanel>
        }
        toolbar={<OverflowToolbar items={toolbarItems} />}
        overlays={
          <>
            {(!exercisesLoaded || !bootFloorElapsed) && (
              <BootScreen>
                <AnimatedLogo mode="draw-fade" size={120} />
              </BootScreen>
            )}
            <ReviewDialog />
            <AdvancedSearchDialog />
            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
            <SettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              panels={[
                {
                  id: 'shortcuts',
                  label: 'Raccourcis',
                  hint: 'Toutes les actions',
                  icon: Keyboard,
                  render: () => <ShortcutSettingsPanel />,
                },
                {
                  id: 'toolbar',
                  label: 'Barre d\'outils',
                  hint: 'Familles de signes',
                  icon: Shapes,
                  render: () => <ToolbarSettingsPanel />,
                },
                {
                  id: 'updates',
                  label: 'Mises à jour',
                  hint: 'Nouvelle version',
                  icon: Download,
                  render: () => (
                    <UpdateSettingsSection
                      status={updateStatus}
                      checkNow={checkNow}
                      updateReady={updateReady}
                      applyUpdate={applyUpdate}
                    />
                  ),
                },
              ]}
              sources={[
                {
                  snapshot: () => useToolbarFamilies.getState().snapshot(),
                  restore: snapshot => useToolbarFamilies.getState().restore(snapshot),
                  commit: () => useToolbarFamilies.getState().commit(),
                  changedSince: {
                    subscribe: listener => useToolbarFamilies.subscribe(() => listener()),
                    isChanged: snapshot =>
                      JSON.stringify([...useToolbarFamilies.getState().hidden].sort()) !==
                      JSON.stringify([...snapshot].sort()),
                  },
                },
                {
                  snapshot: () => useShortcutSettingsStore.getState().snapshot(),
                  restore: snapshot => useShortcutSettingsStore.getState().applyDraft(snapshot),
                  commit: () => useShortcutSettingsStore.getState().commit(),
                  changedSince: {
                    subscribe: listener => useShortcutSettingsStore.subscribe(() => listener()),
                    isChanged: snapshot =>
                      JSON.stringify(useShortcutSettingsStore.getState().overrides) !==
                      JSON.stringify(snapshot.bindings),
                  },
                },
              ]}
            />
          </>
        }
      >
        {updateReady && !dismissed && <UpdateReadyBanner onApply={applyUpdate} onDismiss={dismissUpdate} />}
        <main style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}>
          <ExerciseWorkspace />
        </main>
      </AppShell>
    </TooltipProvider>
  )
}
