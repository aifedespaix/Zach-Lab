import { useEffect, useState } from 'react'
import { Keyboard, Moon, Search, Settings as SettingsIcon } from 'lucide-react'
import {
  CommandButton,
  CommandPalette,
  useCommand,
  useGlobalShortcuts,
  useShortcutSettingsStore,
} from '@suite/shared/commands'
import { SettingsDialog, ShortcutSettingsPanel } from '@suite/shared/settings'
import { AppShell, ResizablePanel, createPanelWidthStorage } from '@suite/shared/shell'
import { startCircularThemeTransition, useResolvedTheme, useThemeDomSync, useThemeStore } from '@suite/shared/theme'
import { TooltipProvider } from '@suite/shared/ui'
import { UpdateReadyBanner, useAppUpdater } from '@suite/shared/update'
import './commands'

// Each app picks its own bounds and its own storage keys: two apps of the suite
// share a machine, but never a webview.
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

  const { updateReady, dismissed, applyUpdate, dismissUpdate } = useAppUpdater()
  const resolvedTheme = useResolvedTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void useShortcutSettingsStore.getState().init()
  }, [])

  useCommand('app.palette', () => setPaletteOpen(true))
  useCommand('app.settings', () => setSettingsOpen(true))
  useCommand('app.toggleTheme', () => {
    startCircularThemeTransition({
      x: window.innerWidth / 2,
      y: 0,
      apply: () => useThemeStore.getState().setMode(resolvedTheme === 'dark' ? 'light' : 'dark'),
    })
  })

  return (
    <TooltipProvider>
      <AppShell
        left={
          <ResizablePanel
            side="left"
            label="Panneau gauche"
            resizeLabel="Redimensionner le panneau de gauche"
            storage={leftPanel}
          />
        }
        right={
          <ResizablePanel
            side="right"
            label="Panneau droit"
            resizeLabel="Redimensionner le panneau de droite"
            storage={rightPanel}
          />
        }
        toolbar={
          <>
            <CommandButton command="app.palette" icon={Search} variant="ghost" size="icon-sm" />
            <CommandButton command="app.toggleTheme" icon={Moon} variant="ghost" size="icon-sm" />
            <CommandButton command="app.settings" icon={SettingsIcon} variant="ghost" size="icon-sm" />
          </>
        }
        overlays={
          <>
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
              ]}
              sources={[
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
        <main style={{ flex: 1, padding: 16 }}>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
            Zone de travail vide. Remplace ce texte par le contenu de ton logiciel.
          </p>
        </main>
      </AppShell>
    </TooltipProvider>
  )
}
