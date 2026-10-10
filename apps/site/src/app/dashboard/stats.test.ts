import { describe, it, expect } from 'vitest'
import { adminStats, formatRelative, profStats } from './stats'
import type { UserRow, CodeView } from '../gestion/summaries'

const eleve = (username: string): UserRow => ({ id: username, username, role: 'eleve', teacher: 'p', invite_code: '', created: '' })

describe('profStats', () => {
  const eleves = [eleve('lea'), eleve('tom')]
  it('prend la dernière synchronisation de chaque élève', () => {
    const stats = profStats(eleves, [
      { username: 'lea', level: 'info', created: '2026-10-09 10:00:00.000Z' },
      { username: 'lea', level: 'error', created: '2026-10-10 08:00:00.000Z' },
    ], [])
    const lea = stats.perEleve.find(e => e.username === 'lea')!
    expect(lea.lastSyncAt).toBe('2026-10-10 08:00:00.000Z')
    expect(lea.lastLevel).toBe('error')
    expect(stats.perEleve.find(e => e.username === 'tom')).toMatchObject({ lastSyncAt: null, lastLevel: null })
  })
  it('ne compte que les conflits ouverts de SES élèves', () => {
    const stats = profStats(eleves, [], [
      { username: 'lea', status: 'open' }, { username: 'lea', status: 'resolved' }, { username: 'autre', status: 'open' },
    ])
    expect(stats.openConflicts).toBe(1)
    expect(stats.perEleve.find(e => e.username === 'lea')!.openConflicts).toBe(1)
  })
  it('gère zéro élève', () => {
    expect(profStats([], [], [])).toEqual({ eleveCount: 0, openConflicts: 0, perEleve: [] })
  })
})

describe('adminStats', () => {
  it('compte profs, élèves et codes actifs', () => {
    const users: UserRow[] = [{ ...eleve('a') }, { ...eleve('b') }, { ...eleve('p'), role: 'prof' }]
    const codes = [{ state: 'actif' }, { state: 'utilise' }] as CodeView[]
    expect(adminStats(users, codes)).toEqual({ profCount: 1, eleveCount: 2, activeCodes: 1 })
  })
})

describe('formatRelative', () => {
  const now = Date.parse('2026-10-10T12:00:00.000Z')
  it('à l’instant sous une minute', () => {
    expect(formatRelative('2026-10-10 11:59:30.000Z', now)).toBe('à l’instant')
  })
  it('minutes', () => {
    expect(formatRelative('2026-10-10 11:55:00.000Z', now)).toBe('il y a 5 min')
  })
  it('heures', () => {
    expect(formatRelative('2026-10-10T09:00:00.000Z', now)).toBe('il y a 3 h')
  })
  it('jours', () => {
    expect(formatRelative('2026-10-08 12:00:00.000Z', now)).toBe('il y a 2 j')
  })
  it('jamais pour null', () => {
    expect(formatRelative(null, now)).toBe('jamais')
  })
  it('date illisible : jamais plutôt que NaN', () => {
    expect(formatRelative('n’importe quoi', now)).toBe('jamais')
  })
})
