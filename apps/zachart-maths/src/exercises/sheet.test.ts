import { describe, expect, it } from 'vitest'
import { countToCorrect, needsCorrection, dropExercise, insertExercise, insertExerciseAt, isBlank, moveExercise, neighbour, patchExercise } from './sheet'
import { newExercise, newSheet, type Sheet } from './types'

const sheet = (...ids: string[]): Sheet => ({ version: 2, id: 'f', titre: 'T', exercices: ids.map(id => ({ ...newExercise(), id })) })
const ids = (s: Sheet) => s.exercices.map(e => e.id)

describe('insertExercise', () => {
  it('ajoute un exercice vierge à la fin ou au début, sans toucher l\'original', () => {
    const base = sheet('a', 'b')
    const end = insertExercise(base, 'end')
    expect(ids(end.sheet)).toEqual(['a', 'b', end.added.id])
    const start = insertExercise(base, 'start')
    expect(ids(start.sheet)).toEqual([start.added.id, 'a', 'b'])
    expect(ids(base)).toEqual(['a', 'b'])
    expect(isBlank(end.added)).toBe(true)
  })
  it('reprend la page du voisin et décale son numéro (« 1a » → « 1b »)', () => {
    const base = sheet('a', 'b')
    base.exercices[0] = { ...base.exercices[0], numero: '2', page: '14' }
    base.exercices[1] = { ...base.exercices[1], numero: '1a', page: '15' }
    const end = insertExercise(base, 'end').added
    expect([end.numero, end.page]).toEqual(['1b', '15'])
    const start = insertExercise(base, 'start').added
    expect([start.numero, start.page]).toEqual(['1', '14'])
    expect(insertExerciseAt(base, 'a', 'after').added.numero).toBe('3')
    expect(insertExerciseAt(sheet('a'), 'a', 'after').added.numero).toBe('')
  })
})

describe('neighbour', () => {
  it('donne l\'id voisin, et null au bord ou pour un id inconnu', () => {
    const s = sheet('a', 'b', 'c')
    expect(neighbour(s, 'b', 1)).toBe('c')
    expect(neighbour(s, 'b', -1)).toBe('a')
    expect(neighbour(s, 'a', -1)).toBeNull()
    expect(neighbour(s, 'c', 1)).toBeNull()
    expect(neighbour(s, 'zzz', 1)).toBeNull()
  })
})

describe('isBlank', () => {
  it('est faux dès qu\'un numéro, un énoncé, un bloc, une réponse ou une note existe', () => {
    const blank = newExercise()
    expect(isBlank(blank)).toBe(true)
    expect(isBlank({ ...blank, numero: ' ' })).toBe(true)
    expect(isBlank({ ...blank, numero: '1', page: '12' })).toBe(true)
    expect(isBlank({ ...blank, enonce: 'Calcule' })).toBe(false)
    expect(isBlank({ ...blank, blocs: [{}] })).toBe(false)
    expect(isBlank({ ...blank, reponse: '7' })).toBe(false)
    expect(isBlank({ ...blank, notes: 'n' })).toBe(false)
  })
})

describe('dropExercise', () => {
  it('retire un exercice du milieu et donne la main au suivant', () => {
    const out = dropExercise(sheet('a', 'b', 'c'), 'b')
    expect(ids(out.sheet)).toEqual(['a', 'c'])
    expect(out.focus).toBe('c')
  })
  it('retire le dernier et donne la main au précédent', () => {
    const out = dropExercise(sheet('a', 'b', 'c'), 'c')
    expect(ids(out.sheet)).toEqual(['a', 'b'])
    expect(out.focus).toBe('b')
  })
  it('garde toujours un exercice', () => {
    const only = sheet('a')
    const out = dropExercise(only, 'a')
    expect(ids(out.sheet)).toEqual(['a'])
    expect(out.focus).toBe('a')
  })
})

describe('patchExercise', () => {
  it('modifie seulement l\'exercice visé, et garde ses champs inconnus', () => {
    const base = sheet('a', 'b')
    base.exercices[0] = { ...base.exercices[0], futur: 1 } as never
    const out = patchExercise(base, 'a', { reponse: '7' })
    expect(out.exercices[0]).toMatchObject({ reponse: '7', futur: 1 })
    expect(out.exercices[1]).toBe(base.exercices[1])
  })
})

describe('moveExercise', () => {
  it("réordonne d'un cran, dans les deux sens", () => {
    expect(ids(moveExercise(sheet('a', 'b', 'c'), 'b', -1))).toEqual(['b', 'a', 'c'])
    expect(ids(moveExercise(sheet('a', 'b', 'c'), 'b', 1))).toEqual(['a', 'c', 'b'])
  })
  it('sans effet au premier et au dernier rang, ou sur un id inconnu (la même fiche est rendue)', () => {
    const s = sheet('a', 'b')
    expect(moveExercise(s, 'a', -1)).toBe(s)
    expect(moveExercise(s, 'b', 1)).toBe(s)
    expect(moveExercise(s, 'zz', 1)).toBe(s)
  })
})

describe('insertExerciseAt', () => {
  it('insère un exercice vierge avant ou après celui visé', () => {
    const before = insertExerciseAt(sheet('a', 'b'), 'b', 'before')
    expect(ids(before.sheet)).toEqual(['a', before.added.id, 'b'])
    const after = insertExerciseAt(sheet('a', 'b'), 'b', 'after')
    expect(ids(after.sheet)).toEqual(['a', 'b', after.added.id])
    expect(isBlank(after.added)).toBe(true)
  })
  it("un id inconnu : l'exercice est ajouté à la fin, jamais perdu", () => {
    const r = insertExerciseAt(sheet('a'), 'zz', 'before')
    expect(ids(r.sheet)).toEqual(['a', r.added.id])
  })
})

describe('needsCorrection', () => {
  const started = { ...newExercise(), enonce: 'Calcule 2+2' }
  it('compte un exercice commencé et non corrigé, pas un vierge ni un corrigé', () => {
    expect(needsCorrection(started)).toBe(true)
    expect(needsCorrection(newExercise())).toBe(false)
    expect(needsCorrection({ ...started, corrige: true })).toBe(false)
  })
  it('countToCorrect additionne sur la fiche', () => {
    const sheet = { ...newSheet('F'), exercices: [started, { ...started, id: 'b', corrige: true }, newExercise()] }
    expect(countToCorrect(sheet)).toBe(1)
  })
})
