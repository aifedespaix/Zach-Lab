import type { GlobalShortcutOptions } from '../commands'
import type { SettingsParts } from '../settings'
import type { MarkConfig, ToolbarDefinition } from '../shell'

/** Width bounds of a side panel, in px. */
export interface PanelBounds {
  min: number
  max: number
  fallback: number
}

export interface AppConfig {
  /** Prefix of the app's storage keys (`<id>:left-width`…). Lowercase, no spaces. */
  id: string
  /** Shown to people: window and dialogs. */
  name: string
  /** The animated mark of the loading screen. */
  mark: MarkConfig
  /** How long the loading screen stays at least, in ms. Default 1300. */
  bootFloorMs?: number
  /** Default panel widths; the defaults suit an empty app. */
  panels?: { left?: PanelBounds; right?: PanelBounds }
  /** The app's own settings panels and sources, merged with the standard ones. */
  settings?: Partial<SettingsParts>
  /** The app's own items on the top bar (`defineToolbar`), and the standard ones it hides. */
  toolbar?: ToolbarDefinition
  /** Options of the global shortcuts: a mode where nothing may change, the canvas selector. */
  shortcuts?: GlobalShortcutOptions
  /**
   * Runs once when the app mounts (init the stores that read the disk); what it returns runs at unmount.
   */
  onReady?: () => void | (() => void)
}

export type AppDefinition = Readonly<AppConfig>

/**
 * Declares an app: an inert object — it starts nothing. `<SuiteApp app={…}>` reads it.
 * This is the only thing that differs between `apps/base` and a real app, besides the work area.
 */
export function defineApp(config: AppConfig): AppDefinition {
  if (!/^[a-z][a-z0-9-]*$/.test(config.id)) {
    throw new Error(`defineApp : id invalide « ${config.id} » (minuscules, chiffres, tirets).`)
  }
  return Object.freeze({ ...config })
}
