import { describe, expect, it } from 'vitest'
import { createHistoryStore } from './createHistoryStore'

function setup(options = {}) {
  let clock = 0
  const store = createHistoryStore<string>({ now: () => clock, ...options })
  store.getState().reset('a')
  return { store, tick: (ms: number) => (clock += ms) }
}

describe('createHistoryStore', () => {
  it('annule et rétablit des clichés entiers', () => {
    const { store } = setup()
    store.getState().commit('b')
    store.getState().commit('c')
    store.getState().undo()
    expect(store.getState().present).toBe('b')
    store.getState().redo()
    expect(store.getState().present).toBe('c')
  })

  it('une nouvelle modification vide le rétablissement', () => {
    const { store } = setup()
    store.getState().commit('b')
    store.getState().undo()
    store.getState().commit('x')
    expect(store.getState().future).toEqual([])
  })

  it('groupe les modifications de même clé à moins de groupMs, pas les autres', () => {
    const { store, tick } = setup()
    store.getState().commit('b', 'k')
    tick(100)
    store.getState().commit('c', 'k')
    expect(store.getState().past).toEqual(['a'])
    tick(100)
    store.getState().commit('d', 'autre')
    expect(store.getState().past).toEqual(['a', 'c'])
    tick(800)
    store.getState().commit('e', 'autre')
    expect(store.getState().past).toEqual(['a', 'c', 'd'])
  })

  it('sans clé, chaque modification est un pas', () => {
    const { store } = setup()
    store.getState().commit('b')
    store.getState().commit('c')
    expect(store.getState().past).toEqual(['a', 'b'])
  })

  it('plafonne à `limit` pas', () => {
    const { store } = setup({ limit: 3 })
    for (const v of 'bcdef') store.getState().commit(v)
    expect(store.getState().past).toEqual(['c', 'd', 'e'])
  })

  it('reset repart de zéro, sans annuler au-delà', () => {
    const { store } = setup()
    store.getState().commit('b')
    store.getState().reset('z')
    store.getState().undo()
    expect(store.getState().present).toBe('z')
  })
})
