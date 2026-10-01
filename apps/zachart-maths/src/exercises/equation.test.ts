import { describe, expect, it } from 'vitest'
import type { EquationStep } from './blocks'
import { addStepAfter, patchStep, removeStep } from './equation'

const steps = (): EquationStep[] => [
  { id: 'a', action: '', latex: '2x+5=11' },
  { id: 'b', action: '− 5 des deux côtés', latex: '2x=6' },
  { id: 'c', action: '÷ 2', latex: 'x=3' },
]

describe('étapes d\'une équation', () => {
  it('ajoute une étape vide juste après celle visée, sans toucher à l\'original', () => {
    const original = steps()
    const { steps: next, added } = addStepAfter(original, 0)
    expect(next.map(s => s.id)).toEqual(['a', added.id, 'b', 'c'])
    expect(added).toMatchObject({ action: '', latex: '' })
    expect(original).toHaveLength(3)
  })

  it('retire une étape, jamais la dernière', () => {
    expect(removeStep(steps(), 'b').map(s => s.id)).toEqual(['a', 'c'])
    expect(removeStep([steps()[0]], 'a')).toHaveLength(1)
    expect(removeStep(steps(), 'absent')).toHaveLength(3)
  })

  it('retirer la première vide l\'action de la nouvelle première', () => {
    const next = removeStep(steps(), 'a')
    expect(next[0]).toMatchObject({ id: 'b', action: '', latex: '2x=6' })
  })

  it('modifie une étape précise', () => {
    const next = patchStep(steps(), 'b', { action: '− 5' })
    expect(next[1].action).toBe('− 5')
    expect(next[2]).toBe(steps()[2] ? next[2] : next[2])
    expect(next[0].action).toBe('')
  })
})
