import { create, type StoreApi, type UseBoundStore } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

/** Where the mode is kept between launches. Namespaced: the webview's storage is per app, but not per feature. */
export const THEME_STORAGE_KEY = 'suite.theme-mode'

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']

/** The mode for `value`, or `undefined` when it is not one — a hand-edited file, an older version. */
export function parseThemeMode(value: unknown): ThemeMode | undefined {
  return THEME_MODES.find(mode => mode === value)
}

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export type ThemeStore = UseBoundStore<StoreApi<ThemeState>>

/**
 * `localStorage` when the webview lets us touch it. Reading the property itself
 * can throw (storage disabled, sandboxed frame), so even asking is guarded.
 */
function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readMode(storage: Storage | null): ThemeMode {
  try {
    return parseThemeMode(storage?.getItem(THEME_STORAGE_KEY)) ?? 'system'
  } catch {
    return 'system'
  }
}

/**
 * The light / dark / system choice, remembered across launches.
 *
 * A theme that cannot be remembered must still WORK: every storage access is
 * guarded, and a failed write leaves the choice applied for this session.
 * Anything that is not a known mode — a stale value, another version's format —
 * reads as « system », the neutral default.
 */
export function createThemeStore(storage: Storage | null = defaultStorage()): ThemeStore {
  return create<ThemeState>(set => ({
    mode: readMode(storage),
    setMode: mode => {
      // Typed callers cannot pass anything else, but a value read from JSON can.
      if (parseThemeMode(mode) === undefined) return
      set({ mode })
      try {
        storage?.setItem(THEME_STORAGE_KEY, mode)
      } catch {
        // Best-effort, like every settings write: the mode is already live.
      }
    },
  }))
}

export const useThemeStore = createThemeStore()
