import { create } from 'zustand'

/** One line of the banner stack at the top of the work area. */
export interface StatusEntry {
  id: string
  kind: 'error' | 'info'
  text: string
  /** A button beside the text. */
  action?: { label: string; run: () => void }
  /** Present = the banner has a « × »; called when it is pressed (the entry is removed afterwards). */
  dismiss?: () => void
  dismissLabel?: string
}

interface AppStatusState {
  entries: readonly StatusEntry[]
  /** Adds an entry; one with the same `id` is replaced in place, keeping its rank. */
  push: (entry: StatusEntry) => void
  remove: (id: string) => void
}

export const useAppStatusStore = create<AppStatusState>(set => ({
  entries: [],
  push: entry =>
    set(state =>
      state.entries.some(existing => existing.id === entry.id)
        ? { entries: state.entries.map(existing => (existing.id === entry.id ? entry : existing)) }
        : { entries: [...state.entries, entry] },
    ),
  remove: id => set(state => ({ entries: state.entries.filter(entry => entry.id !== id) })),
}))

/** The banner stack of the app: `push({ id, kind, text, dismiss })`, `remove(id)`. */
export function useAppStatus(): Pick<AppStatusState, 'push' | 'remove'> {
  const push = useAppStatusStore(state => state.push)
  const remove = useAppStatusStore(state => state.remove)
  return { push, remove }
}
