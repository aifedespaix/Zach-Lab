import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineAppStorage } from './appStorage'
import { createPersisted, persistedEnum, persistedFlag, persistedJson, persistedNumber, persistedSet } from './persisted'
import { readStored, resetStorageMemory, writeStored } from './safeStorage'

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  resetStorageMemory()
})

describe('defineAppStorage', () => {
  it('préfixe par l\'id de l\'app, comme les clés déjà écrites', () => {
    expect(defineAppStorage('zachart-maths').key('zoom')).toBe('zachart-maths:zoom')
    expect(defineAppStorage('zachart-mentale').key('session')).toBe('zachart-mentale:session')
  })
  it('refuse un id qui ne ferait pas une clé propre', () => {
    expect(() => defineAppStorage('Mon App')).toThrow()
  })
})

describe('clés historiques relues à l\'identique', () => {
  const zoom = () => persistedNumber({ key: 'zachart-maths:zoom', fallback: 100, min: 50, max: 150, step: 10 })
  const onOff = (key: string, fallback: boolean) => () => persistedFlag({ key, fallback, on: 'on', off: 'off' })
  const cases: [string, string, () => { getState(): { value: unknown } }, string, unknown][] = [
    ['zoom', 'zachart-maths:zoom', zoom, '120', 120],
    ['zoom hors bornes', 'zachart-maths:zoom', zoom, '400', 150],
    ['zoom arrondi au pas', 'zachart-maths:zoom', zoom, '93', 90],
    ['compact', 'zachart-maths:compact', onOff('zachart-maths:compact', false), 'on', true],
    ['only-to-correct', 'zachart-maths:only-to-correct', onOff('zachart-maths:only-to-correct', false), 'off', false],
    ['unit-colors (activé par défaut)', 'zachart-maths:unit-colors', onOff('zachart-maths:unit-colors', true), 'off', false],
    ['unit-colors illisible', 'zachart-maths:unit-colors', onOff('zachart-maths:unit-colors', true), 'peut-être', true],
    ['courses-visible', 'zachart-maths:courses-visible', () => persistedFlag({ key: 'zachart-maths:courses-visible', fallback: true }), 'false', false],
    ['bottom-tab', 'zachart-maths:bottom-tab', () => persistedEnum({ key: 'zachart-maths:bottom-tab', fallback: 'notes', values: ['notes', 'calculatrice'] }), 'calculatrice', 'calculatrice'],
    ['toolbar-hidden', 'zachart-maths:toolbar-hidden', () => persistedSet({ key: 'zachart-maths:toolbar-hidden' }), '["Grec",3,"Ensembles"]', ['Grec', 'Ensembles']],
  ]
  it.each(cases)('%s', (_name, key, make, stored, expected) => {
    localStorage.setItem(key, stored)
    expect(make().getState().value).toEqual(expected)
  })
})

describe('createPersisted', () => {
  it('donne le repli quand rien n\'est stocké, et quand la valeur est illisible', () => {
    expect(persistedNumber({ key: 'k', fallback: 100, min: 50, max: 150, step: 10 }).getState().value).toBe(100)
    localStorage.setItem('k', 'abc')
    expect(persistedNumber({ key: 'k', fallback: 100, min: 50, max: 150, step: 10 }).getState().value).toBe(100)
    localStorage.setItem('e', 'inconnu')
    expect(persistedEnum({ key: 'e', fallback: 'notes', values: ['notes', 'calculatrice'] }).getState().value).toBe('notes')
    localStorage.setItem('j', '{pas du json')
    expect(persistedSet({ key: 'j' }).getState().value).toEqual([])
  })

  it('écrit à chaque set dans le format de la clé, et reset revient au repli', () => {
    const flag = persistedFlag({ key: 'f', fallback: false, on: 'on', off: 'off' })
    flag.getState().set(true)
    expect(localStorage.getItem('f')).toBe('on')
    flag.getState().set(current => !current)
    expect(localStorage.getItem('f')).toBe('off')
    flag.getState().set(true)
    flag.getState().reset()
    expect(flag.getState().value).toBe(false)
  })

  it('borne aussi ce que l\'app écrit', () => {
    const zoom = persistedNumber({ key: 'z', fallback: 100, min: 50, max: 150, step: 10 })
    zoom.getState().set(500)
    expect(zoom.getState().value).toBe(150)
    zoom.getState().set(current => current - 100)
    expect(zoom.getState().value).toBe(50)
    expect(localStorage.getItem('z')).toBe('50')
  })

  it('migre une ancienne valeur avant de la lire', () => {
    localStorage.setItem('m', '1')
    const store = createPersisted<boolean>({
      key: 'm',
      fallback: false,
      migrate: raw => (raw === '1' ? 'true' : raw === '0' ? 'false' : raw),
      parse: raw => (raw === 'true' ? true : raw === 'false' ? false : undefined),
    })
    expect(store.getState().value).toBe(true)
  })

  it('garde null comme valeur (bandTab : « aucun onglet » est un choix)', () => {
    const store = persistedJson<string | null>({
      key: 't',
      fallback: 'main',
      validate: raw => (raw === null || typeof raw === 'string' ? raw : undefined),
    })
    expect(store.getState().value).toBe('main')
    store.getState().set(null)
    expect(localStorage.getItem('t')).toBe('null')
    expect(persistedJson<string | null>({ key: 't', fallback: 'main', validate: raw => (raw === null ? null : undefined) }).getState().value).toBeNull()
  })
})

describe('stockage refusé', () => {
  it('ne lève jamais en lecture : repli', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(persistedFlag({ key: 'f', fallback: true }).getState().value).toBe(true)
    expect(readStored('f')).toBeNull()
  })

  it('ne lève jamais en écriture : la valeur vaut pour la session et se relit', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const flag = persistedFlag({ key: 'f', fallback: false })
    expect(() => flag.getState().set(true)).not.toThrow()
    expect(flag.getState().value).toBe(true)
    expect(readStored('f')).toBe('true')
    expect(writeStored('g', 'x')).toBe(false)
    expect(readStored('g')).toBe('x')
  })
})
