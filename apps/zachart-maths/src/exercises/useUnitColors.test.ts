import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const load = async () => (await import('./useUnitColors')).useUnitColors

describe('useUnitColors', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })
  afterEach(() => vi.restoreAllMocks())

  it('est activé par défaut', async () => {
    expect((await load()).getState().enabled).toBe(true)
  })

  it('relit un réglage coupé', async () => {
    localStorage.setItem('zachart-maths:unit-colors', 'off')
    expect((await load()).getState().enabled).toBe(false)
  })

  it('bascule et mémorise le choix', async () => {
    const store = await load()
    store.getState().toggle()
    expect(store.getState().enabled).toBe(false)
    expect(localStorage.getItem('zachart-maths:unit-colors')).toBe('off')
    store.getState().toggle()
    expect(store.getState().enabled).toBe(true)
    expect(localStorage.getItem('zachart-maths:unit-colors')).toBe('on')
  })

  it('retombe sur « activé » si le stockage est indisponible, et bascule quand même', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage indisponible')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('stockage indisponible')
    })
    const store = await load()
    expect(store.getState().enabled).toBe(true)
    expect(() => store.getState().toggle()).not.toThrow()
    expect(store.getState().enabled).toBe(false)
  })
})
