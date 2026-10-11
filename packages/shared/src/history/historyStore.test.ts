import { describe, expect, it, vi } from 'vitest'
import { createHistoryStore } from './historyStore'

function clocked(options: { limit?: number; groupMs?: number } = {}) {
  let t = 0
  const store = createHistoryStore('a', { ...options, now: () => t })
  return { store, at: (ms: number) => void (t = ms) }
}

describe('createHistoryStore', () => {
  it('undoes and redoes whole snapshots', () => {
    const { store } = clocked()
    store.commit('b')
    store.commit('c')
    expect(store.undo()).toBe('b')
    expect(store.undo()).toBe('a')
    expect(store.undo()).toBeNull()
    expect(store.redo()).toBe('b')
    expect(store.get()).toEqual({ present: 'b', undoDepth: 1, redoDepth: 1 })
  })

  it('a new commit clears the redo stack', () => {
    const { store } = clocked()
    store.commit('b')
    store.undo()
    store.commit('c')
    expect(store.canRedo()).toBe(false)
    expect(store.redo()).toBeNull()
  })

  it('groups commits with the same key within groupMs and keeps the snapshot before the first one', () => {
    const { store, at } = clocked({ groupMs: 700 })
    store.commit('b', 'k')
    at(300)
    store.commit('c', 'k')
    at(600)
    store.commit('d', 'k')
    expect(store.get().undoDepth).toBe(1)
    expect(store.undo()).toBe('a')
  })

  it('does not group across keys, past the delay, or without a key', () => {
    const { store, at } = clocked({ groupMs: 700 })
    store.commit('b', 'k')
    at(100)
    store.commit('c', 'other')
    at(900)
    store.commit('d', 'other')
    store.commit('e')
    store.commit('f')
    expect(store.get().undoDepth).toBe(5)
  })

  it('undo/redo end a group: typing after an undo is a new step', () => {
    const { store, at } = clocked()
    store.commit('b', 'k')
    store.undo()
    at(10)
    store.commit('c', 'k')
    expect(store.undo()).toBe('a')
  })

  it('drops the oldest snapshot past the limit', () => {
    const { store } = clocked({ limit: 3 })
    for (const v of ['b', 'c', 'd', 'e', 'f']) store.commit(v)
    expect(store.get().undoDepth).toBe(3)
    store.undo(); store.undo(); store.undo()
    expect(store.get().present).toBe('c')
  })

  it('reset starts over', () => {
    const { store } = clocked()
    store.commit('b')
    store.undo()
    store.reset('z')
    expect(store.get()).toEqual({ present: 'z', undoDepth: 0, redoDepth: 0 })
  })

  it('notifies subscribers until they unsubscribe', () => {
    const { store } = clocked()
    const listener = vi.fn()
    const off = store.subscribe(listener)
    store.commit('b')
    store.undo()
    off()
    store.redo()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('returns a stable snapshot between changes (useSyncExternalStore)', () => {
    const { store } = clocked()
    expect(store.get()).toBe(store.get())
  })
})
