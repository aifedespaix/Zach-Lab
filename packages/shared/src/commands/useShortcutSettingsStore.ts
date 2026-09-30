import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type { ShortcutSettings } from './shortcutSettingsTypes'
import { DEFAULT_SHORTCUT_SETTINGS } from './shortcutSettingsTypes'
import { loadShortcutSettings, saveShortcutSettings } from './shortcutSettingsPersistence'
import { commandList, defaultBindings, subscribeCatalog } from './catalog'
import { normalizeBinding } from './keys'

/** The effective binding of every command: the catalogue's default, then the user's overrides on top. */
export function resolveBindings(overrides: Record<string, string | null>): Record<string, string | null> {
  const resolved = defaultBindings()
  for (const [id, binding] of Object.entries(overrides)) {
    // `hasOwnProperty`, not `in`: `"constructor" in {}` is true.
    if (Object.prototype.hasOwnProperty.call(resolved, id)) resolved[id] = binding
  }
  return resolved
}

/**
 * Binding → command, for the dispatcher.
 *
 * Configured bindings are indexed first and aliases second, so an alias never
 * shadows a real binding: `Ctrl+Y` means "rétablir" only as long as nobody has
 * deliberately given `Ctrl+Y` to another command.
 *
 * Two commands CAN end up on the same binding (a hand-edited file, or an
 * override colliding with a default the user never touched). The first in
 * catalogue order wins the lookup, and `conflictsIn` below is what the
 * settings panel uses to show the collision rather than let it stay silent.
 */
export function buildLookup(bindings: Record<string, string | null>): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const command of commandList()) {
    const binding = bindings[command.id]
    if (binding !== null && binding !== undefined && !lookup.has(binding)) lookup.set(binding, command.id)
  }
  for (const command of commandList()) {
    for (const alias of command.aliases ?? []) {
      if (!lookup.has(alias)) lookup.set(alias, command.id)
    }
  }
  return lookup
}

/** Every command sharing its binding with another one, grouped by binding. */
export function conflictsIn(bindings: Record<string, string | null>): Map<string, string[]> {
  const byBinding = new Map<string, string[]>()
  for (const command of commandList()) {
    const binding = bindings[command.id]
    if (binding === null || binding === undefined) continue
    const group = byBinding.get(binding)
    if (group) group.push(command.id)
    else byBinding.set(binding, [command.id])
  }
  for (const [binding, group] of byBinding) {
    if (group.length < 2) byBinding.delete(binding)
  }
  return byBinding
}

interface ShortcutSettingsState {
  /** The user's differences from the catalogue — what gets written to disk. */
  overrides: Record<string, string | null>
  /** The effective table, recomputed on every change so components can read it directly. */
  bindings: Record<string, string | null>
  lookup: Map<string, string>
  init: () => Promise<void>
  /**
   * Assigns a binding (or `null` to unbind), in memory only.
   *
   * The chord is taken away from whichever command held it: two commands on
   * one key would make the loser silently dead, which is worse than telling
   * the user their old shortcut moved. The settings panel reports the
   * displacement; `conflictsIn` still exists for collisions that arrive from
   * a hand-edited file rather than through here.
   */
  setBinding: (id: string, binding: string | null) => void
  /** Drops the override for one command, so it goes back to the catalogue's default. */
  resetCommand: (id: string) => void
  /** Drops every override — the "tout réinitialiser" button. */
  resetAll: () => void
  applyDraft: (settings: ShortcutSettings) => void
  commit: () => Promise<void>
  snapshot: () => ShortcutSettings
  /** The command currently holding `binding`, ignoring `except`. */
  commandHolding: (binding: string, except?: string) => string | null
}

export type ShortcutSettingsStore = UseBoundStore<StoreApi<ShortcutSettingsState>>

function derive(overrides: Record<string, string | null>) {
  const bindings = resolveBindings(overrides)
  return { overrides, bindings, lookup: buildLookup(bindings) }
}

export function createShortcutSettingsStore(): ShortcutSettingsStore {
  const store = create<ShortcutSettingsState>((set, get) => ({
    ...derive(DEFAULT_SHORTCUT_SETTINGS.bindings),

    // Same contract as the other settings stores: an unreadable or corrupt
    // file degrades to the shipped defaults instead of surfacing as an
    // unhandled rejection from the `init()` App fires on mount. Losing your
    // customisations is bad; losing every shortcut in the app is worse.
    init: async () => {
      try {
        const settings = await loadShortcutSettings()
        set(derive(settings.bindings))
      } catch {
        set(derive(DEFAULT_SHORTCUT_SETTINGS.bindings))
      }
    },

    setBinding: (id, binding) => {
      const normalized = binding === null ? null : normalizeBinding(binding)
      if (binding !== null && normalized === null) return
      const next = { ...get().overrides }

      if (normalized !== null) {
        const holder = get().commandHolding(normalized, id)
        // Recorded as an explicit `null` override rather than deleted: the
        // displaced command must stay unbound even when the chord it lost was
        // its own catalogue default.
        if (holder !== null) next[holder] = null
      }

      // An override equal to the default is not stored: it would pin that
      // command to today's key forever, past any later change to the
      // catalogue. `resetCommand` and this branch converge on the same state.
      if (normalized === defaultBindings()[id]) delete next[id]
      else next[id] = normalized

      set(derive(next))
    },

    resetCommand: id => {
      const next = { ...get().overrides }
      delete next[id]
      set(derive(next))
    },

    resetAll: () => set(derive({})),

    applyDraft: settings => set(derive(settings.bindings)),

    commit: async () => {
      const settings = get().snapshot()
      try {
        await saveShortcutSettings(settings)
      } catch {
        // Best-effort, like every other settings store: the bindings are
        // already live in memory, and a failed write must not throw into the
        // click handler that caused it.
      }
    },

    snapshot: () => ({ bindings: { ...get().overrides } }),

    commandHolding: (binding, except) => {
      const bindings = get().bindings
      for (const command of commandList()) {
        if (command.id === except) continue
        if (bindings[command.id] === binding) return command.id
      }
      return null
    },
  }))

  // The store is created when this module loads, which can be BEFORE the app has
  // registered its catalogue: recompute the effective table when it does, or
  // every binding would stay empty until the user touched a setting.
  subscribeCatalog(() => store.setState(derive(store.getState().overrides)))

  return store
}

export const useShortcutSettingsStore = createShortcutSettingsStore()
