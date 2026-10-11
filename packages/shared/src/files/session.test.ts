import { beforeEach, describe, expect, it } from 'vitest'
import { readStored, writeStored } from '../storage'
import { loadSession, parseSession, pushRecent, renameRecent, RECENT_LIMIT, saveSession } from './session'

const at = new Date('2026-10-11T10:00:00.000Z')

describe('parseSession', () => {
  it('lit l\'ancien format de Maths (récents seuls)', () => {
    const raw = JSON.stringify({ recentFiles: [{ path: 'a.json', openedAt: '2026-01-01T00:00:00.000Z' }] })
    expect(parseSession(raw)).toEqual({
      currentFilePath: null,
      expandedPaths: [],
      recentFiles: [{ path: 'a.json', openedAt: '2026-01-01T00:00:00.000Z' }],
    })
  })

  it('lit l\'ancien format de Mentale (superset)', () => {
    const state = { currentFilePath: 'c.zmap', expandedPaths: ['d'], recentFiles: [{ path: 'c.zmap', openedAt: 'x' }] }
    expect(parseSession(JSON.stringify(state))).toEqual(state)
  })

  it.each([null, '', 'pas du json', '[]', '{"recentFiles":3}'])('donne une session vide pour %j', raw => {
    expect(parseSession(raw)).toEqual({ currentFilePath: null, expandedPaths: [], recentFiles: [] })
  })

  it('écarte les récents mal formés et plafonne la liste', () => {
    const many = Array.from({ length: RECENT_LIMIT + 5 }, (_, i) => ({ path: `f${i}`, openedAt: 'x' }))
    const parsed = parseSession(JSON.stringify({ recentFiles: [{ path: 3 }, null, ...many], expandedPaths: ['a', 4] }))
    expect(parsed.recentFiles).toHaveLength(RECENT_LIMIT)
    expect(parsed.expandedPaths).toEqual(['a'])
  })
})

describe('récents', () => {
  it('pushRecent met le plus récent d\'abord, sans doublon, plafonné', () => {
    let files = [{ path: 'a', openedAt: 'x' }, { path: 'b', openedAt: 'x' }]
    files = pushRecent(files, 'b', at)
    expect(files.map(f => f.path)).toEqual(['b', 'a'])
    expect(files[0].openedAt).toBe(at.toISOString())
    for (let i = 0; i < 20; i++) files = pushRecent(files, `n${i}`, at)
    expect(files).toHaveLength(RECENT_LIMIT)
  })

  it('renameRecent change le chemin en gardant l\'ordre', () => {
    expect(renameRecent([{ path: 'a', openedAt: 'x' }, { path: 'b', openedAt: 'y' }], 'a', 'z').map(f => f.path)).toEqual(['z', 'b'])
  })
})

describe('stockage', () => {
  beforeEach(() => { writeStored('app:session', '') })

  it('écrit le superset sous la clé de l\'app et le relit', () => {
    const state = { currentFilePath: 'a', expandedPaths: ['d'], recentFiles: [{ path: 'a', openedAt: 'x' }] }
    saveSession('app', state)
    expect(JSON.parse(readStored('app:session')!)).toEqual(state)
    expect(loadSession('app')).toEqual(state)
  })
})
