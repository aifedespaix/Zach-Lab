import { describe, expect, it } from 'vitest'
import { addStepAfter, patchStep, removeStep } from './equation'
import type { EquationStep } from './blocks'

const s = (id: string, left = '', right = '', operation = ''): EquationStep => ({ id, left, right, operation })

describe('equation', () => {
  it("ajoute une étape vide juste après l'index", () => {
    const { steps, added } = addStepAfter([s('a'), s('b')], 0)
    expect(steps.map(x => x.id)).toEqual(['a', added.id, 'b'])
    expect(added).toMatchObject({ left: '', right: '', operation: '' })
  })
  it('retire une étape, jamais la dernière restante', () => {
    expect(removeStep([s('a'), s('b')], 'a').map(x => x.id)).toEqual(['b'])
    expect(removeStep([s('a')], 'a')).toHaveLength(1)
    expect(removeStep([s('a'), s('b')], 'zz')).toHaveLength(2)
  })
  it("retirer la dernière étape efface l'opération de la nouvelle dernière : elle ne mène plus nulle part", () => {
    const next = removeStep([s('a', '', '', 'op'), s('b')], 'b')
    expect(next[0].operation).toBe('')
  })
  it("modifie un membre ou l'opération", () => {
    expect(patchStep([s('a')], 'a', { left: 'x' })[0].left).toBe('x')
    expect(patchStep([s('a')], 'a', { operation: '+1' })[0].operation).toBe('+1')
  })
})
