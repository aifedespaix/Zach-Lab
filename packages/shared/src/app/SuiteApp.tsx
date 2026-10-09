import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Moon, Search, Settings as SettingsIcon } from 'lucide-react'
import { CommandButton, CommandPalette, useCommand, useGlobalShortcuts, useShortcutSettingsStore } from '../commands'
import { SettingsDialog, mergeSettings, standardSettings } from '../settings'
import { AnimatedMark, AppBoot, AppShell, ResizablePanel, createPanelWidthStorage } from '../shell'
import { useThemeDomSync, useToggleTheme } from '../theme'
import { TooltipProvider } from '../ui'
import { useAppUpdater } from '../update'
import type { AppDefinition } from './defineApp'
import { StatusBannerStack } from './StatusBannerStack'
import { useAppStatus } from './useAppStatus'

const LEFT_BOUNDS = { min: 180, max: 520, fallback: 240 }
const RIGHT_BOUNDS = { min: 300, max: 640, fallback: 400 }
const UPDATE_BANNER_ID = 'update-ready'

interface SuiteAppProps {
  app: AppDefinition
  /** Replaces the empty left panel; `null` = no left panel. */
  left?: ReactNode
  /** Replaces the empty right panel; `null` = no right panel. */
  right?: ReactNode
  /** The app's own toolbar items, before the system ones. */
  toolbar?: ReactNode
  /** The palette, theme and settings buttons. Default: shown. */
  systemButtons?: boolean
  /** The app is done loading; the loading screen waits for it (and for the floor). Default: ready. */
  ready?: boolean
  /** Covers and dialogs of the app, over the frame. */
  overlays?: ReactNode
  /** The work area. */
  children: ReactNode
}

/**
 * The frame of every app of the suite, wired: theme, shortcuts, updates, palette, settings window,
 * loading screen, banners, and the standard commands `app.palette`, `app.settings`, `app.shortcuts`,
 * `app.toggleTheme`. The app brings its work area, and what is its own.
 */
export function SuiteApp({
  app,
  left,
  right,
  toolbar,
  systemButtons = true,
  ready = true,
  overlays,
  children,
}: SuiteAppProps) {
  useThemeDomSync()
  useGlobalShortcuts(app.shortcuts)

  const updater = useAppUpdater()
  const { updateReady, dismissed } = updater
  const { push, remove } = useAppStatus()
  const toggleTheme = useToggleTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsPanel, setSettingsPanel] = useState<string | undefined>()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void useShortcutSettingsStore.getState().init()
  }, [])
  // Read once: the app's stores must be initialised once, whatever re-renders the frame.
  const onReady = app.onReady
  useEffect(() => onReady?.(), [onReady])

  // The updater's callbacks change on every render: read through a ref so the banner is pushed once.
  const updaterRef = useRef(updater)
  updaterRef.current = updater
  // The « update ready » banner is one case of the stack.
  useEffect(() => {
    if (!updateReady || dismissed) {
      remove(UPDATE_BANNER_ID)
      return
    }
    push({
      id: UPDATE_BANNER_ID,
      kind: 'info',
      text: 'Mise à jour prête',
      action: { label: 'Redémarrer', run: () => void updaterRef.current.applyUpdate() },
      dismiss: () => updaterRef.current.dismissUpdate(),
      dismissLabel: 'Masquer le message de mise à jour',
    })
    return () => remove(UPDATE_BANNER_ID)
  }, [updateReady, dismissed, push, remove])

  const openSettings = (panel?: string) => {
    setSettingsPanel(panel)
    setSettingsOpen(true)
  }
  useCommand('app.palette', () => setPaletteOpen(true))
  useCommand('app.settings', () => openSettings())
  useCommand('app.shortcuts', () => openSettings('shortcuts'))
  useCommand('app.toggleTheme', () => toggleTheme())

  const settings = useMemo(
    () => mergeSettings(standardSettings({ updates: updater }), app.settings),
    // `updater` changes on every status tick: the panels read it when rendered, not here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.settings, updater.status, updater.updateReady, updater.checkNow, updater.applyUpdate],
  )

  const leftBounds = app.panels?.left ?? LEFT_BOUNDS
  const rightBounds = app.panels?.right ?? RIGHT_BOUNDS
  const leftStorage = useMemo(() => createPanelWidthStorage({ key: `${app.id}:left-width`, ...leftBounds }), [app.id, leftBounds])
  const rightStorage = useMemo(() => createPanelWidthStorage({ key: `${app.id}:right-width`, ...rightBounds }), [app.id, rightBounds])

  return (
    <TooltipProvider>
      <AppShell
        left={
          left === undefined ? (
            <ResizablePanel
              side="left"
              label="Panneau gauche"
              resizeLabel="Redimensionner le panneau de gauche"
              storage={leftStorage}
            />
          ) : (
            left
          )
        }
        right={
          right === undefined ? (
            <ResizablePanel
              side="right"
              label="Panneau droit"
              resizeLabel="Redimensionner le panneau de droite"
              storage={rightStorage}
            />
          ) : (
            right
          )
        }
        toolbar={
          <>
            {toolbar}
            {systemButtons && (
              <>
                <CommandButton command="app.palette" icon={Search} variant="ghost" size="icon-sm" />
                <CommandButton command="app.toggleTheme" icon={Moon} variant="ghost" size="icon-sm" />
                <CommandButton command="app.settings" icon={SettingsIcon} variant="ghost" size="icon-sm" />
              </>
            )}
          </>
        }
        overlays={
          <>
            <AppBoot ready={ready} floorMs={app.bootFloorMs ?? 1300}>
              <AnimatedMark mark={app.mark} mode="draw-fade" size={120} />
            </AppBoot>
            {overlays}
            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
            <SettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              initialPanel={settingsPanel}
              panels={settings.panels}
              sources={settings.sources}
            />
          </>
        }
      >
        <StatusBannerStack />
        {children}
      </AppShell>
    </TooltipProvider>
  )
}
