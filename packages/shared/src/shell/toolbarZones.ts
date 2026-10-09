import type { ReactNode } from 'react'

/** The seven zones of the top bar, left to right. The order is the suite's, not the app's. */
export const TOOLBAR_ZONES = ['file', 'edit', 'title', 'app', 'panels', 'view', 'system'] as const
export type ToolbarZone = (typeof TOOLBAR_ZONES)[number]

/**
 * Who leaves the bar first when the window narrows (higher stays longer). The file and system
 * zones are the last to go; the title, which can always be read in the window, is the first.
 */
export const ZONE_PRIORITY: Record<ToolbarZone, number> = {
  file: 100,
  system: 100,
  edit: 80,
  panels: 60,
  view: 50,
  app: 40,
  title: 30,
}

export interface ToolbarItem {
  /** Unique on the bar. */
  id: string
  zone: ToolbarZone
  /** What the bar shows when there is room. */
  node: ReactNode
  /** What the « … » menu shows instead (usually `CommandDropdownItem`s). Left out, the item can only be on the bar. */
  menu?: ReactNode
  /** Overrides the zone's priority. */
  priority?: number
}

/**
 * Ids of the items the suite puts on the bar itself, when the catalogue has the command behind them:
 * `file.newOrClose` (« Nouveau » with no file open, « Fermer » with one), `file.menu`, `edit.undo`,
 * `edit.redo`, `title`, `app.palette`, `app.toggleTheme`, `app.settings`.
 */
export type StandardToolbarItemId =
  | 'file.newOrClose'
  | 'file.menu'
  | 'edit.undo'
  | 'edit.redo'
  | 'title'
  | 'app.palette'
  | 'app.toggleTheme'
  | 'app.settings'

export interface ToolbarConfig {
  /** The app's own items, usually in the `app` zone. */
  items?: readonly ToolbarItem[]
  /** Standard items this app does without. */
  hide?: readonly StandardToolbarItemId[]
}

export type ToolbarDefinition = Readonly<ToolbarConfig>

/** Declares an app's part of the bar: inert data, `<AppToolbar>` reads it. Throws on a duplicate id. */
export function defineToolbar(config: ToolbarConfig = {}): ToolbarDefinition {
  const seen = new Set<string>()
  for (const item of config.items ?? []) {
    if (seen.has(item.id)) throw new Error(`defineToolbar : id « ${item.id} » en double.`)
    seen.add(item.id)
  }
  return Object.freeze({ items: config.items ?? [], hide: config.hide ?? [] })
}

/**
 * The bar's items in their fixed order: by zone, then as given (the suite's own first), each with its
 * priority settled. Pure, so the order is testable without a layout engine.
 */
export function arrangeToolbar(items: readonly ToolbarItem[]): (ToolbarItem & { priority: number })[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => TOOLBAR_ZONES.indexOf(a.item.zone) - TOOLBAR_ZONES.indexOf(b.item.zone) || a.index - b.index)
    .map(({ item }) => ({ ...item, priority: item.priority ?? ZONE_PRIORITY[item.zone] }))
}
