import { beforeEach, describe, expect, it } from 'vitest'
import { createSessionStore, parseSession, pushRecent, RECENT_LIMIT } from './session'

beforeEach(() => localStorage.clear())

describe('parseSession', () => {
  it('lit l\'ancien format de Maths (récents seuls)', () => {
    const raw = JSON.stringify({ recentFiles: [{ path: 'a/b.json', openedAt: '2026-01-01T00:00:00.000Z' }] })
    expect(parseSession(raw)).toEqual({ currentFilePath: null, expandedPaths: [], recentFiles: [{ path: 'a/b.json', openedAt: '2026-01-01T00:00:00.000Z' }] })
  })

  it('lit l\'ancien format de Mentale', () => {
    const raw = JSON.stringify({ currentFilePath: 'c.zmap', expandedPaths: ['d'], recentFiles: [] })
    expect(parseSession(raw)).toEqual({ currentFilePath: 'c.zmap', expandedPaths: ['d'], recentFiles: [] })
  })

  it('une valeur absente, corrompue ou mal typée donne une session vide', () => {
    const empty = { currentFilePath: null, expandedPaths: [], recentFiles: [] }
    expect(parseSession(null)).toEqual(empty)
    expect(parseSession('{pas du json')).toEqual(empty)
    expect(parseSession('null')).toEqual(empty)
    expect(parseSession(JSON.stringify({ recentFiles: [{ path: 1 }, 'x'], expandedPaths: [1, 'ok'] }))).toEqual({ ...empty, expandedPaths: ['ok'] })
  })
})

describe('createSessionStore', () => {
  it('relit une session déjà écrite sous <id>:session', () => {
    localStorage.setItem('zachart-maths:session', JSON.stringify({ recentFiles: [{ path: 'x', openedAt: '2026-01-01T00:00:00.000Z' }] }))
    expect(createSessionStore('zachart-maths').getState().recentFiles.map(f => f.path)).toEqual(['x'])
  })

  it('note un fichier ouvert : en tête, sans doublon, 10 au plus, et écrit le sur-ensemble', () => {
    const store = createSessionStore('t')
    for (let i = 0; i < 12; i++) store.getState().opened(`f${i}`)
    store.getState().opened('f5')
    const { recentFiles, currentFilePath } = store.getState()
    expect(recentFiles).toHaveLength(RECENT_LIMIT)
    expect(recentFiles[0].path).toBe('f5')
    expect(new Set(recentFiles.map(f => f.path)).size).toBe(RECENT_LIMIT)
    expect(currentFilePath).toBe('f5')
    expect(Object.keys(JSON.parse(localStorage.getItem('t:session')!)).sort()).toEqual(['currentFilePath', 'expandedPaths', 'recentFiles'])
  })

  it('un fichier déplacé garde sa place', () => {
    const store = createSessionStore('t')
    store.getState().opened('a')
    store.getState().opened('b')
    store.getState().moved('a', 'c')
    expect(store.getState().recentFiles.map(f => f.path)).toEqual(['b', 'c'])
  })

  it('pushRecent met le plus récent en tête', () => {
    expect(pushRecent([{ path: 'a', openedAt: 'x' }], 'b').map(f => f.path)).toEqual(['b', 'a'])
  })
})
