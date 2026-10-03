import { describe, expect, it } from 'vitest'
import { SHEET_VERSION, newSheet, validateSheet } from './types'

const v1 = {
  version: 1, id: 'f', titre: 'Fractions', question: '3.b', enonce: 'Calcule', page: '45',
  blocs: [{ id: 'b', type: 'texte', contenu: 'x' }], reponse: '7', notes: 'n',
}

describe('validateSheet', () => {
  it('refuse ce qui n\'est pas une fiche, et un format plus récent', () => {
    expect(validateSheet(null)).toBeNull()
    expect(validateSheet({ titre: 'x' })).toBeNull()
    expect(validateSheet({ version: 3, id: 'a', titre: 'x', exercices: [] })).toBeNull()
  })

  it('lit un fichier v1 comme une fiche à un exercice (question → numero)', () => {
    const sheet = validateSheet(v1)!
    expect(sheet).toMatchObject({ version: SHEET_VERSION, id: 'f', titre: 'Fractions' })
    expect(sheet.exercices).toHaveLength(1)
    expect(sheet.exercices[0]).toMatchObject({ numero: '3.b', enonce: 'Calcule', page: '45', reponse: '7', notes: 'n', blocs: v1.blocs })
    expect(sheet.exercices[0]).not.toHaveProperty('question')
  })

  it('complète les champs manquants d\'un fichier v1', () => {
    expect(validateSheet({ version: 1, id: 'a', titre: 'x' })!.exercices[0]).toMatchObject({ numero: '', enonce: '', blocs: [], reponse: '', notes: '' })
  })

  it('lit un fichier v2, exercices dans l\'ordre', () => {
    const sheet = validateSheet({ version: 2, id: 'f', titre: 'T', exercices: [{ id: 'a', numero: '1' }, { id: 'b', numero: '2', page: '9' }] })!
    expect(sheet.exercices.map(e => [e.id, e.numero, e.page])).toEqual([['a', '1', ''], ['b', '2', '9']])
  })

  it('ouvre avec un exercice vierge une fiche sans exercice', () => {
    expect(validateSheet({ version: 2, id: 'f', titre: 'T', exercices: [] })!.exercices).toHaveLength(1)
    expect(validateSheet({ version: 2, id: 'f', titre: 'T' })!.exercices).toHaveLength(1)
    expect(validateSheet({ version: 2, id: 'f', titre: 'T', exercices: ['x', 3, null] })!.exercices).toHaveLength(1)
  })

  it('refait les id manquants ou en double', () => {
    const ids = validateSheet({ version: 2, id: 'f', titre: 'T', exercices: [{ id: 'a' }, { id: 'a' }, {}] })!.exercices.map(e => e.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe('a')
  })

  it('conserve les champs qu\'il ne connaît pas', () => {
    const sheet = validateSheet({ version: 2, id: 'f', titre: 'T', exercices: [{ id: 'a', futur: { x: 1 } }] })!
    expect(sheet.exercices[0]).toMatchObject({ futur: { x: 1 } })
  })
})

describe('newSheet', () => {
  it('crée une fiche v2 avec un exercice vierge', () => {
    const sheet = newSheet('Fractions p.45')
    expect(sheet).toMatchObject({ version: SHEET_VERSION, titre: 'Fractions p.45' })
    expect(sheet.exercices).toHaveLength(1)
  })
})

describe('blocsB à la lecture', () => {
  const file = (extra: object) => ({ version: 2, id: 's', titre: 'T', exercices: [{ id: 'e', blocs: [], ...extra }] })

  it("une fiche sans blocsB s'ouvre non scindée", () => {
    expect(validateSheet(file({}))!.exercices[0].blocsB).toBeUndefined()
  })
  it("un blocsB qui n'est pas un tableau est ignoré", () => {
    for (const bad of ['x', 3, null, {}]) {
      const e = validateSheet(file({ blocsB: bad }))!.exercices[0]
      expect('blocsB' in e).toBe(false)
    }
  })
  it("un blocsB vide garde l'exercice scindé, et chaque bloc reçoit un id", () => {
    const e = validateSheet(file({ blocs: [{ type: 'texte' }], blocsB: [{ type: 'calcul', id: 'k' }] }))!.exercices[0]
    expect(e.blocsB).toHaveLength(1)
    expect((e.blocs[0] as { id: string }).id).toMatch(/.+/)
    expect(validateSheet(file({ blocsB: [] }))!.exercices[0].blocsB).toEqual([])
  })
})
