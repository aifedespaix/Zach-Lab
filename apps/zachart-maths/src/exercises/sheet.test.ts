import { describe, expect, it } from 'vitest'
import { dropExercise, insertExercise, isBlank, neighbour, patchExercise } from './sheet'
import { newExercise, type Sheet } from './types'

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
    expect(isBlank({ ...blank, numero: '1' })).toBe(false)
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
