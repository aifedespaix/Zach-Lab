import { describe, it, expect } from 'vitest'
import { filterEleves, summarizeCodes, teacherCounts, type CodeRow, type UserRow } from './summaries'

const user = (over: Partial<UserRow>): UserRow => ({
  id: 'u', username: 'u', role: 'eleve', teacher: '', invite_code: '', created: '2026-10-01 00:00:00.000Z', ...over,
})
const code = (over: Partial<CodeRow>): CodeRow => ({
  id: 'c', code: 'ABCDEFGHJK', kind: 'unique', expires_at: '', revoked: false, note: '', created: '2026-10-01 00:00:00.000Z', ...over,
})
const NOW = Date.parse('2026-10-10T12:00:00Z')

describe('teacherCounts', () => {
  it('compte les élèves par prof et ignore les profs', () => {
    const counts = teacherCounts([
      user({ id: '1', teacher: 'A' }), user({ id: '2', teacher: 'A' }), user({ id: '3', teacher: 'B' }),
      user({ id: 'A', role: 'prof' }),
    ])
    expect(counts.get('A')).toBe(2)
    expect(counts.get('B')).toBe(1)
    expect(counts.has('')).toBe(false)
  })
})

describe('summarizeCodes', () => {
  it('calcule l’état et liste les inscrits de chaque code', () => {
    const views = summarizeCodes(
      [code({ id: '1', code: 'AAAAAAAAAA' }), code({ id: '2', code: 'BBBBBBBBBB', kind: 'duree', expires_at: '2026-10-20 00:00:00.000Z' })],
      [user({ id: 'p1', role: 'prof', username: 'dupont', invite_code: 'AAAAAAAAAA' }),
       user({ id: 'p2', role: 'prof', username: 'martin', invite_code: 'BBBBBBBBBB' }),
       user({ id: 'p3', role: 'prof', username: 'durand', invite_code: 'BBBBBBBBBB' })],
      NOW
    )
    // Le tri met l'actif avant l'utilisé : on retrouve chaque vue par son id.
    expect(views.find(view => view.id === '1')).toMatchObject({ state: 'utilise', inscrits: ['dupont'] })
    expect(views.find(view => view.id === '2')).toMatchObject({ state: 'actif', inscrits: ['martin', 'durand'] })
  })
  it('un élève portant le code compte : un code unique passe à « utilisé »', () => {
    const [view] = summarizeCodes(
      [code({ id: '1', code: 'AAAAAAAAAA' })],
      [user({ id: 'e1', role: 'eleve', username: 'alice', invite_code: 'AAAAAAAAAA' })],
      NOW
    )
    expect(view).toMatchObject({ state: 'utilise', inscrits: ['alice'] })
  })
  it('met les codes actifs avant les autres, puis du plus récent au plus ancien', () => {
    const views = summarizeCodes(
      [code({ id: 'old', code: 'AAAAAAAAAA', revoked: true, created: '2026-10-09 00:00:00.000Z' }),
       code({ id: 'new', code: 'BBBBBBBBBB', created: '2026-10-08 00:00:00.000Z' })],
      [], NOW
    )
    expect(views.map(view => view.id)).toEqual(['new', 'old'])
  })
})

describe('filterEleves', () => {
  const users = [user({ id: '1', teacher: 'A' }), user({ id: '2', teacher: 'B' }), user({ id: 'A', role: 'prof' })]
  it('ne garde que les élèves', () => expect(filterEleves(users, 'all').map(u => u.id)).toEqual(['1', '2']))
  it('filtre par prof', () => expect(filterEleves(users, 'B').map(u => u.id)).toEqual(['2']))
})
