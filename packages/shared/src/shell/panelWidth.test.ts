import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPanelWidthStorage } from './panelWidth'

const options = { key: 'test:panel-width', min: 200, max: 500, fallback: 300 }

describe('createPanelWidthStorage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('expose ses bornes', () => {
    const storage = createPanelWidthStorage(options)
    expect([storage.MIN, storage.MAX, storage.DEFAULT]).toEqual([200, 500, 300])
  })

  it('reste dans les bornes et arrondit', () => {
    const { clamp } = createPanelWidthStorage(options)
    expect(clamp(100)).toBe(200)
    expect(clamp(9999)).toBe(500)
    expect(clamp(250.6)).toBe(251)
  })

  it.each([NaN, Infinity, -Infinity])('retombe sur la valeur par défaut pour %s', value => {
    expect(createPanelWidthStorage(options).clamp(value)).toBe(300)
  })

  it('renvoie la valeur par défaut au premier lancement', () => {
    expect(createPanelWidthStorage(options).load()).toBe(300)
  })

  it('relit ce qu\'il a enregistré', () => {
    const storage = createPanelWidthStorage(options)
    storage.save(420)
    expect(storage.load()).toBe(420)
  })

  it('borne une valeur enregistrée hors limites (fichier édité, bornes changées depuis)', () => {
    localStorage.setItem(options.key, '99999')
    expect(createPanelWidthStorage(options).load()).toBe(500)
    localStorage.setItem(options.key, '5')
    expect(createPanelWidthStorage(options).load()).toBe(200)
  })

  it.each(['', 'abc', 'NaN', 'null'])('retombe sur la valeur par défaut pour la valeur enregistrée %j', raw => {
    localStorage.setItem(options.key, raw)
    expect(createPanelWidthStorage(options).load()).toBe(300)
  })

  it('n\'enregistre jamais une valeur hors bornes', () => {
    createPanelWidthStorage(options).save(50)
    expect(localStorage.getItem(options.key)).toBe('200')
  })

  it('ne lève rien quand le stockage est refusé, en lecture comme en écriture', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const storage = createPanelWidthStorage(options)
    expect(storage.load()).toBe(300)
    expect(() => storage.save(400)).not.toThrow()
  })

  it('deux panneaux à clés différentes ne se marchent pas dessus', () => {
    const left = createPanelWidthStorage({ ...options, key: 'a' })
    const right = createPanelWidthStorage({ ...options, key: 'b' })
    left.save(210)
    right.save(480)
    expect([left.load(), right.load()]).toEqual([210, 480])
  })
})
