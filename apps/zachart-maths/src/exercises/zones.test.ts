import { describe, expect, it } from 'vitest'
import { isSplit, mergeZones, sendBlock, splitZones } from './zones'
import { newExercise, type Exercise } from './types'

const b = (id: string) => ({ id, type: 'texte', contenu: id })
const ex = (blocs: unknown[], blocsB?: unknown[]): Exercise => ({ ...newExercise(), blocs, ...(blocsB === undefined ? {} : { blocsB }) })

describe('zones', () => {
  it('un exercice est scindé si et seulement si blocsB existe, même vide', () => {
    expect(isSplit(ex([]))).toBe(false)
    expect(isSplit(ex([], []))).toBe(true)
    expect(splitZones()).toEqual({ blocsB: [] })
  })

  it('réunir met la zone de droite à la suite de celle de gauche et retire blocsB', () => {
    const e = ex([b('1'), b('2')], [b('3')])
    const merged = { ...e, ...mergeZones(e) }
    expect(merged.blocs.map(x => (x as { id: string }).id)).toEqual(['1', '2', '3'])
    expect(isSplit(merged)).toBe(false)
    expect('blocsB' in JSON.parse(JSON.stringify(merged))).toBe(false)
  })

  it('réunir une zone vide, ou depuis une gauche vide, ne laisse aucun bloc fantôme', () => {
    expect(mergeZones(ex([b('1')], [])).blocs).toEqual([b('1')])
    expect(mergeZones(ex([], [b('9')])).blocs).toEqual([b('9')])
    expect(mergeZones(ex([], [])).blocs).toEqual([])
  })

  it("envoie un bloc à la fin de l'autre zone, dans les deux sens", () => {
    const e = ex([b('1'), b('2')], [b('3')])
    expect(sendBlock(e, '1', 'a')).toEqual({ blocs: [b('2')], blocsB: [b('3'), b('1')] })
    expect(sendBlock(e, '3', 'b')).toEqual({ blocs: [b('1'), b('2'), b('3')], blocsB: [] })
  })

  it('envoyer à droite depuis un exercice non scindé le scinde', () => {
    expect(sendBlock(ex([b('1'), b('2')]), '1', 'a')).toEqual({ blocs: [b('2')], blocsB: [b('1')] })
  })

  it("n'envoie rien : zone de droite d'un exercice non scindé, ou bloc absent de la zone indiquée", () => {
    expect(sendBlock(ex([b('1')]), '1', 'b')).toBeNull()
    expect(sendBlock(ex([b('1')], []), '1', 'b')).toBeNull()
    expect(sendBlock(ex([b('1')], []), 'inconnu', 'a')).toBeNull()
  })

  it('envoie un bloc de type inconnu sans rien lui retirer', () => {
    const unknown = { id: 'u', type: 'futur', extra: { n: 1 } }
    expect(sendBlock(ex([unknown], []), 'u', 'a')!.blocsB).toEqual([unknown])
  })
})
