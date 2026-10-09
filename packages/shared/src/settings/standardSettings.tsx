import { Download, Keyboard } from 'lucide-react'
import { useShortcutSettingsStore } from '../commands/useShortcutSettingsStore'
import { UpdateSettingsSection, type UpdateCheckHandle } from '../update'
import { ShortcutSettingsPanel } from './ShortcutSettingsPanel'
import type { SettingsPanelDef, SettingsSource } from './SettingsDialog'

/** The panels and sources of a settings window. */
export interface SettingsParts {
  panels: readonly SettingsPanelDef[]
  sources: readonly SettingsSource<any>[]
}

export interface StandardSettingsOptions {
  /** The « Raccourcis » panel. Default: on. */
  shortcuts?: boolean
  /** The « Mises à jour » panel, fed by the app's updater. Left out, no panel. */
  updates?: UpdateCheckHandle
}

/** The shortcuts store as a source of the window: previewed live, saved on « Enregistrer ». */
const shortcutsSource: SettingsSource<ReturnType<ReturnType<typeof useShortcutSettingsStore.getState>['snapshot']>> = {
  snapshot: () => useShortcutSettingsStore.getState().snapshot(),
  restore: snapshot => useShortcutSettingsStore.getState().applyDraft(snapshot),
  commit: () => useShortcutSettingsStore.getState().commit(),
  changedSince: {
    subscribe: listener => useShortcutSettingsStore.subscribe(() => listener()),
    isChanged: snapshot =>
      JSON.stringify(useShortcutSettingsStore.getState().overrides) !== JSON.stringify(snapshot.bindings),
  },
}

/**
 * The panels every app of the suite has: « Raccourcis » first and « Mises à jour » last
 * (`mergeSettings` puts the app's own between them). L5 adds « Apparence ».
 */
export function standardSettings({ shortcuts = true, updates }: StandardSettingsOptions = {}): SettingsParts & {
  /** Where `mergeSettings` places each standard panel. */
  placement: Readonly<Record<string, 'start' | 'end'>>
} {
  const panels: SettingsPanelDef[] = []
  const placement: Record<string, 'start' | 'end'> = {}
  if (shortcuts) {
    panels.push({
      id: 'shortcuts',
      label: 'Raccourcis',
      hint: 'Toutes les actions',
      icon: Keyboard,
      render: () => <ShortcutSettingsPanel />,
    })
    placement.shortcuts = 'start'
  }
  if (updates !== undefined) {
    panels.push({
      id: 'updates',
      label: 'Mises à jour',
      hint: 'Nouvelle version',
      icon: Download,
      render: () => (
        <UpdateSettingsSection
          status={updates.status}
          checkNow={updates.checkNow}
          updateReady={updates.updateReady}
          applyUpdate={updates.applyUpdate}
        />
      ),
    })
    placement.updates = 'end'
  }
  return { panels, sources: shortcuts ? [shortcutsSource] : [], placement }
}

/**
 * The window's content: standard « start » panels, then the app's, then the standard « end » ones.
 * An app panel with a standard id replaces it. Sources: the app's first, then the standard ones.
 */
export function mergeSettings(
  standard: ReturnType<typeof standardSettings>,
  app: Partial<SettingsParts> = {},
): SettingsParts {
  const own = app.panels ?? []
  const ownIds = new Set(own.map(panel => panel.id))
  const kept = standard.panels.filter(panel => !ownIds.has(panel.id))
  const at = (panel: SettingsPanelDef) => standard.placement[panel.id]
  return {
    panels: [...kept.filter(panel => at(panel) === 'start'), ...own, ...kept.filter(panel => at(panel) === 'end')],
    sources: [...(app.sources ?? []), ...standard.sources],
  }
}
