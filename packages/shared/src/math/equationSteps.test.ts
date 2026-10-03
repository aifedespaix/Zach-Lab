import { describe, expect, it } from 'vitest'
import { equationStepIsSolved, isBareVariable, type EquationStepLike as EquationStep } from './equationSteps'

describe('isBareVariable — la variable isolée qui déclenche le résultat', () => {
  it('reconnaît une lettre seule, avec ou sans indice', () => {
    expect(isBareVariable('x')).toBe(true)
    expect(isBareVariable(' x ')).toBe(true)
    expect(isBareVariable('x_1')).toBe(true)
    expect(isBareVariable('n_{max}')).toBe(true)
    expect(isBareVariable('\\alpha')).toBe(true)
  })

  it('refuse tout ce qui porte une opération ou plus d’un terme', () => {
    expect(isBareVariable('2x')).toBe(false)
    expect(isBareVariable('x + 1')).toBe(false)
    expect(isBareVariable('')).toBe(false)
    expect(isBareVariable('11')).toBe(false)
  })
})

describe('equationStepIsSolved — jamais saisi, toujours déduit', () => {
  it('ne marque que la DERNIÈRE étape, et seulement si un membre est une variable seule', () => {
    const steps: EquationStep[] = [
      { left: '2x + 3', right: '11', operation: '- 3' },
      { left: '2x', right: '8', operation: '\\div 2' },
      { left: 'x', right: '4' },
    ]
    expect(equationStepIsSolved(steps, 0)).toBe(false)
    expect(equationStepIsSolved(steps, 1)).toBe(false)
    expect(equationStepIsSolved(steps, 2)).toBe(true)
  })

  it('marque aussi quand la variable seule est à DROITE', () => {
    const steps: EquationStep[] = [{ left: '4', right: 'x' }]
    expect(equationStepIsSolved(steps, 0)).toBe(true)
  })

  it('une variable isolée qui n’est pas la dernière étape ne compte pas comme résultat', () => {
    const steps: EquationStep[] = [{ left: 'x', right: '4', operation: '\\times 2' }, { left: '2x', right: '8' }]
    expect(equationStepIsSolved(steps, 0)).toBe(false)
  })
})

describe('equationStepIsSolved — la variable est vraiment isolée', () => {
  const cases: [string, string, boolean][] = [
    ['x', '5', true],
    ['x', '\\frac{3}{2}', true],
    ['5', 'x', true],
    ['x', '2x + 3', false],
    ['x', '', false],
    ['x', '   ', false],
    ['x', '\\max(a, b)', true],
    ['\\alpha', '2\\alpha', false],
    ['x', '2ax', false],
    ['x', '\\frac{x}{2}', false],
    ['x_1', 'x_{1} + 2', false],
    ['x_1', 'x_2 + 2', true],
    ['x', 'x_1 + 2', true],
  ]
  it.each(cases)('%s = %s → %s', (left, right, expected) => {
    expect(equationStepIsSolved([{ left, right }], 0)).toBe(expected)
  })

  it('ne regarde que la DERNIÈRE étape', () => {
    expect(equationStepIsSolved([{ left: 'x', right: '5' }, { left: '2x', right: '10' }], 0)).toBe(false)
  })
})


