import { describe, expect, it } from 'vitest'
import { correctionStats, findNextToCorrect, NO_CORRECTION, summarizeSheet, toggleCorrected, toggleRate } from './correction'
import { newExercise, type ChapterNode, type Exercise, type Sheet } from './types'

const ex = (id: string, extra: Partial<Exercise> = {}): Exercise => ({ ...newExercise(), id, enonce: `Q ${id}`, creeLe: undefined, ...extra })
const sheet = (...exercices: Exercise[]): Sheet => ({ version: 2, id: 's', titre: 'T', exercices })
const entry = (path: string, s: Sheet) => ({ path, titre: path, exercices: s.exercices.length, corrompu: false, ...summarizeSheet(s) })
const tree = (...entries: ReturnType<typeof entry>[]): ChapterNode[] => [{ name: 'A', exercises: entries }]

describe('summarizeSheet', () => {
  it('compte à corriger, corrigés, à revoir, et garde les dates', () => {
    const s = sheet(
      ex('a'),
      ex('b', { corrige: true, corrigeLe: '2026-10-01T10:00:00Z' }),
      ex('c', { corrige: true, rate: true, corrigeLe: '2026-10-02T10:00:00Z' }),
      newExercise(),
    )
    expect(summarizeSheet(s)).toMatchObject({ aCorriger: 1, corriges: 2, aRevoir: 1, premierACorriger: 'a', corrigeLes: ['2026-10-01T10:00:00Z', '2026-10-02T10:00:00Z'] })
  })
  it('un exercice vierge ne compte pas', () => {
    expect(summarizeSheet(sheet(newExercise()))).toMatchObject({ aCorriger: 0, premierACorriger: null })
  })
})

describe('toggleCorrected / toggleRate', () => {
  it('marque avec la date, démarque en effaçant date et « à revoir »', () => {
    const now = new Date('2026-10-05T08:00:00Z')
    expect(toggleCorrected(ex('a'), now)).toEqual({ corrige: true, corrigeLe: now.toISOString(), rate: undefined })
    expect(toggleCorrected(ex('a', { corrige: true, rate: true, corrigeLe: 'x' }))).toEqual({ corrige: undefined, corrigeLe: undefined, rate: undefined })
  })
  it('bascule « à revoir »', () => {
    expect(toggleRate(ex('a'))).toEqual({ rate: true })
    expect(toggleRate(ex('a', { rate: true }))).toEqual({ rate: undefined })
  })
})

describe('findNextToCorrect', () => {
  const s1 = sheet(ex('a'), ex('b', { corrige: true }), ex('c'))
  const s2 = sheet(ex('d', { corrige: true }), ex('e'))
  const t = tree(entry('A/1.json', s1), entry('A/2.json', s2))
  it('prend le suivant dans la fiche ouverte', () => {
    expect(findNextToCorrect(t, 'A/1.json', s1, 'a')).toEqual({ path: 'A/1.json', exerciseId: 'c' })
  })
  it('passe à la fiche suivante quand la fiche est finie', () => {
    expect(findNextToCorrect(t, 'A/1.json', s1, 'c')).toEqual({ path: 'A/2.json', exerciseId: 'e' })
  })
  it('boucle vers le début, puis rend null quand tout est corrigé', () => {
    expect(findNextToCorrect(t, 'A/2.json', s2, 'e')).toEqual({ path: 'A/1.json', exerciseId: 'a' })
    const done = sheet(ex('a', { corrige: true }), ex('b', { corrige: true }))
    expect(findNextToCorrect(tree(entry('A/1.json', done)), 'A/1.json', done, 'a')).toBeNull()
  })
  it('sans fiche ouverte, prend la première qui attend', () => {
    expect(findNextToCorrect(t, null, null, null)).toEqual({ path: 'A/1.json', exerciseId: 'a' })
  })
  it('revient en arrière dans la fiche s’il n’y a rien ailleurs', () => {
    const s = sheet(ex('a'), ex('b', { corrige: true }))
    expect(findNextToCorrect(tree(entry('A/1.json', s)), 'A/1.json', s, 'b')).toEqual({ path: 'A/1.json', exerciseId: 'a' })
  })
})

describe('correctionStats', () => {
  // Lundi 5 octobre 2026 à midi (heure locale).
  const now = new Date(2026, 9, 5, 12)
  const at = (day: number) => new Date(2026, 9, day, 9).toISOString()
  it('série de jours, corrigés de la semaine', () => {
    const s = sheet(ex('a', { corrige: true, corrigeLe: at(5) }), ex('b', { corrige: true, corrigeLe: at(4) }), ex('c', { corrige: true, corrigeLe: at(3) }), ex('d', { corrige: true, corrigeLe: at(1) }))
    const stats = correctionStats(tree(entry('A/1.json', s)), now)
    expect(stats.streak).toBe(3)
    expect(stats.thisWeek).toBe(1)
  })
  it('la série tient encore si la dernière correction date d’hier', () => {
    const s = sheet(ex('a', { corrige: true, corrigeLe: at(4) }))
    expect(correctionStats(tree(entry('A/1.json', s)), now).streak).toBe(1)
    expect(correctionStats(tree(entry('A/1.json', s)), new Date(2026, 9, 7)).streak).toBe(0)
  })
  it('relance les exercices qui attendent depuis plus de 10 jours', () => {
    const s = sheet(ex('a', { creeLe: new Date(2026, 8, 20).toISOString() }), ex('b', { creeLe: new Date(2026, 9, 3).toISOString() }))
    const stats = correctionStats(tree(entry('A/1.json', s)), now)
    expect(stats.stale).toEqual({ count: 1, oldestDays: 15 })
    expect(stats.toCorrect).toBe(2)
  })
  it('un arbre vide ne donne rien', () => {
    expect(correctionStats([{ name: 'A', exercises: [{ path: 'A/x.json', titre: 'x', exercices: 0, corrompu: true, ...NO_CORRECTION }] }], now)).toMatchObject({ streak: 0, thisWeek: 0, toCorrect: 0 })
  })
})
