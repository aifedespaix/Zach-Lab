import { create, type StoreApi, type UseBoundStore } from 'zustand'

export interface HistoryOptions {
  /** Most steps kept; the oldest is dropped beyond it. */
  limit?: number
  /** Edits with the same group key closer than this are one undo step. */
  groupMs?: number
  /** The clock; tests inject theirs. */
  now?: () => number
}

export interface HistoryState<T> {
  /** The current value; `null` until `reset`. */
  present: T | null
  past: readonly T[]
  future: readonly T[]
  /** Starts over from `initial`: no past, no future. */
  reset: (initial: T | null) => void
  /** A new value. With a `groupKey` equal to the previous edit's and within `groupMs`, it joins that step. Clears the redo. */
  commit: (next: T, groupKey?: string) => void
  undo: () => void
  redo: () => void
}

export type HistoryStore<T> = UseBoundStore<StoreApi<HistoryState<T>>>

/**
 * Snapshot history of a whole document: `commit` pushes the previous value, `undo`/`redo` travel.
 * Pure (no React, no Tauri). Maths groups keystrokes per exercise and field (`groupKey`); Mentale's
 * actions are discrete and pass none.
 */
export function createHistoryStore<T>({ limit = 200, groupMs = 700, now = Date.now }: HistoryOptions = {}): HistoryStore<T> {
  let lastGroup: { key: string; at: number } | null = null

  return create<HistoryState<T>>((set, get) => ({
    present: null,
    past: [],
    future: [],
    reset(initial) {
      lastGroup = null
      set({ present: initial, past: [], future: [] })
    },
    commit(next, groupKey) {
      const { present, past } = get()
      if (present === null) return set({ present: next })
      const at = now()
      const grouped = groupKey !== undefined && lastGroup !== null && lastGroup.key === groupKey && at - lastGroup.at < groupMs
      lastGroup = groupKey === undefined ? null : { key: groupKey, at }
      // A grouped edit keeps the snapshot from before the group's first edit.
      const kept = grouped ? past : [...past, present].slice(-limit)
      set({ present: next, past: kept, future: [] })
    },
    undo() {
      const { present, past, future } = get()
      if (past.length === 0 || present === null) return
      lastGroup = null
      set({ present: past[past.length - 1], past: past.slice(0, -1), future: [present, ...future] })
    },
    redo() {
      const { present, past, future } = get()
      if (future.length === 0 || present === null) return
      lastGroup = null
      set({ present: future[0], past: [...past, present], future: future.slice(1) })
    },
  }))
}
