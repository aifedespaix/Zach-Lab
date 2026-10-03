import { beforeEach, describe, expect, it } from 'vitest'
import { RECENT_LIMIT, loadRecent, pushRecent, renameRecent, saveRecent } from './recentFiles'

const at = (s: string) => new Date(s)

describe('recentFiles', () => {
  beforeEach(() => localStorage.clear())

  it('met le plus récent en premier et ne garde pas de doublon', () => {
    let files = pushRecent([], 'A/a.json', at('2026-01-01T10:00:00Z'))
    files = pushRecent(files, 'B/b.json', at('2026-01-01T11:00:00Z'))
    files = pushRecent(files, 'A/a.json', at('2026-01-01T12:00:00Z'))
    expect(files.map(f => f.path)).toEqual(['A/a.json', 'B/b.json'])
    expect(files[0].openedAt).toBe('2026-01-01T12:00:00.000Z')
  })

  it('plafonne à 10', () => {
    let files: ReturnType<typeof pushRecent> = []
    for (let i = 0; i < 14; i++) files = pushRecent(files, `C/${i}.json`)
    expect(files).toHaveLength(RECENT_LIMIT)
    expect(files[0].path).toBe('C/13.json')
  })

  it("relit ce qu'il a écrit", () => {
    saveRecent([{ path: 'A/a.json', openedAt: '2026-01-01T10:00:00.000Z' }])
    expect(loadRecent()).toEqual([{ path: 'A/a.json', openedAt: '2026-01-01T10:00:00.000Z' }])
  })

  it('ignore un stockage corrompu ou mal formé', () => {
    localStorage.setItem('zachart-maths:session', '{pas du json')
    expect(loadRecent()).toEqual([])
    localStorage.setItem('zachart-maths:session', JSON.stringify({ recentFiles: [1, null, { path: 3 }, { path: 'ok.json', openedAt: 'x' }] }))
    expect(loadRecent()).toEqual([{ path: 'ok.json', openedAt: 'x' }])
  })

  it('suit un renommage', () => {
    expect(renameRecent([{ path: 'A/a.json', openedAt: 'x' }], 'A/a.json', 'B/a.json')).toEqual([{ path: 'B/a.json', openedAt: 'x' }])
  })
})
