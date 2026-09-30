import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY, createThemeStore, parseThemeMode } from './useThemeStore'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

function brokenStorage(): Storage {
  const fail = () => {
    throw new DOMException('denied', 'SecurityError')
  }
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail }
}

describe('parseThemeMode', () => {
  it.each(['light', 'dark', 'system'])('accepte %s', mode => {
    expect(parseThemeMode(mode)).toBe(mode)
  })

  it.each([undefined, null, '', 'Dark', 'auto', 0, {}, ['dark']])('refuse %j', value => {
    expect(parseThemeMode(value)).toBeUndefined()
  })
})

describe('useThemeStore', () => {
  beforeEach(() => localStorage.clear())

  it('démarre en « system » quand rien n\'est enregistré (premier lancement)', () => {
    expect(createThemeStore(memoryStorage()).getState().mode).toBe('system')
  })

  it('retrouve le mode enregistré', () => {
    const store = createThemeStore(memoryStorage({ [THEME_STORAGE_KEY]: 'dark' }))
    expect(store.getState().mode).toBe('dark')
  })

  it.each(['', 'sombre', 'null', '{"mode":"dark"}', 'DARK'])('retombe sur « system » pour la valeur enregistrée %j', stored => {
    const store = createThemeStore(memoryStorage({ [THEME_STORAGE_KEY]: stored }))
    expect(store.getState().mode).toBe('system')
  })

  it('enregistre le mode choisi, et un autre store le relit', () => {
    const storage = memoryStorage()
    createThemeStore(storage).getState().setMode('light')
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(createThemeStore(storage).getState().mode).toBe('light')
  })

  it('ignore un mode invalide venu d\'un fichier ou d\'un JSON, sans rien écrire', () => {
    const storage = memoryStorage()
    const store = createThemeStore(storage)
    store.getState().setMode('dark')
    store.getState().setMode('bleu' as never)
    expect(store.getState().mode).toBe('dark')
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('fonctionne quand le stockage est refusé : lecture et écriture ne lèvent rien', () => {
    const store = createThemeStore(brokenStorage())
    expect(store.getState().mode).toBe('system')
    expect(() => store.getState().setMode('dark')).not.toThrow()
    expect(store.getState().mode).toBe('dark')
  })

  it('fonctionne sans stockage du tout', () => {
    const store = createThemeStore(null)
    store.getState().setMode('dark')
    expect(store.getState().mode).toBe('dark')
  })
})
