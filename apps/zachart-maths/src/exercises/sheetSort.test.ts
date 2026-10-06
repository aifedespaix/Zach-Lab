import { describe, expect, it } from 'vitest'
import { sortedIndices } from './sheetSort'
import { newExercise, type Exercise } from './types'

const ex = (numero: string, extra: Partial<Exercise> = {}): Exercise => ({ ...newExercise(), numero, creeLe: undefined, ...extra })
const labels = (list: Exercise[], sort: Parameters<typeof sortedIndices>[1]) => sortedIndices(list, sort).map(i => list[i].numero)

describe('sortedIndices', () => {
  const list = [ex('10'), ex('2'), ex('1b'), ex('1a'), ex('5a'), ex('5')]

  it("garde l'ordre de la fiche par défaut", () => {
    expect(labels(list, 'ordre')).toEqual(['10', '2', '1b', '1a', '5a', '5'])
  })

  it('trie les numéros comme un humain, dans les deux sens', () => {
    expect(labels(list, 'numero-asc')).toEqual(['1a', '1b', '2', '5', '5a', '10'])
    expect(labels(list, 'numero-desc')).toEqual(['10', '5a', '5', '2', '1b', '1a'])
  })

  it('utilise la position quand le numéro est vide', () => {
    const l = [ex(''), ex('0'), ex('')]
    expect(sortedIndices(l, 'numero-asc')).toEqual([1, 0, 2])
  })

  it('trie par date de création, les sans-date en dernier', () => {
    const l = [ex('a', { creeLe: '2026-02-01' }), ex('b'), ex('c', { creeLe: '2026-01-01' })]
    expect(labels(l, 'date-asc')).toEqual(['c', 'a', 'b'])
    expect(labels(l, 'date-desc')).toEqual(['a', 'c', 'b'])
  })

  it("met un état en tête, le reste garde l'ordre de la fiche", () => {
    const l = [ex('1', { corrige: true }), ex('2'), ex('3', { corrige: true, rate: true }), ex('4')]
    expect(labels(l, 'a-corriger')).toEqual(['2', '4', '1', '3'])
    expect(labels(l, 'a-revoir')).toEqual(['3', '1', '2', '4'])
    expect(labels(l, 'corriges')).toEqual(['1', '2', '3', '4'])
  })
})
