import { persistedSet, type PersistedStore } from '../storage'

/**
 * The bar's items nobody may hide: new/close, undo, redo, settings (the way back to this very choice)
 * and the « Fichier » menu, which carries locked actions.
 */
export const LOCKED_TOOLBAR_ITEMS = ['file.newOrClose', 'file.menu', 'edit.undo', 'edit.redo', 'app.settings'] as const

/** Hidden until the user turns them on: the theme lives in the « Apparence » panel already. */
export const DEFAULT_HIDDEN_TOOLBAR_ITEMS: readonly string[] = ['app.toggleTheme']

export function isToolbarItemLocked(id: string): boolean {
  return (LOCKED_TOOLBAR_ITEMS as readonly string[]).includes(id)
}

/**
 * The items still drawn: a hidden id is dropped unless the item is locked (a corrupt file cannot take
 * the settings button away), an unknown id is ignored. A hidden item stays a command.
 */
export function visibleToolbarItems<T extends { id: string }>(items: readonly T[], hidden: ReadonlySet<string>): T[] {
  return items.filter(item => isToolbarItemLocked(item.id) || !hidden.has(item.id))
}

const stores = new Map<string, PersistedStore<readonly string[]>>()

/** The ids hidden from the bar, one store per app id, read once. Key `<id>:toolbar-hidden`. */
export function toolbarHiddenStore(appId: string): PersistedStore<readonly string[]> {
  let found = stores.get(appId)
  if (found === undefined) {
    found = persistedSet({ key: `${appId}:toolbar-hidden`, fallback: DEFAULT_HIDDEN_TOOLBAR_ITEMS })
    stores.set(appId, found)
  }
  return found
}
