// apps/zachart-maths/src/exercises/likeTerms.test.ts
import { describe, expect, it } from 'vitest'
import { colorTerms } from './likeTerms'

/** Les termes colorés seulement, sous la forme [texte, groupe] : plus lisible que tous les segments. */
const colored = (latex: string) => colorTerms(latex).filter(s => s.group !== null).map(s => [s.text, s.group])

describe('colorTerms', () => {
  it('découpe aux signes de premier niveau et groupe par partie littérale', () => {
    expect(colored('3x+2y+1')).toEqual([['3x', 'x'], ['+2y', 'y'], ['+1', '']])
    expect(colored('5x-3y-4')).toEqual([['5x', 'x'], ['-3y', 'y'], ['-4', '']])
  })

  it('garde le signe avec son terme et les espaces hors des termes', () => {
    expect(colored('3x + 2y + 1')).toEqual([['3x', 'x'], ['+ 2y', 'y'], ['+ 1', '']])
    const spaces = colorTerms('3x + 2').filter(s => s.group === null).map(s => s.text)
    expect(spaces).toEqual([' '])
  })

  it('lit un signe en tête comme celui du premier terme', () => {
    expect(colored('-x+2')).toEqual([['-x', 'x'], ['+2', '']])
    expect(colored('-4')).toEqual([['-4', '']])
    expect(colored('−4')).toEqual([['−4', '']])
  })

  it('distingue les exposants et ignore l\'ordre des lettres', () => {
    expect(colored('x^2 + x')).toEqual([['x^2', 'x^2'], ['+ x', 'x']])
    expect(colored('x^{2}+3x')).toEqual([['x^{2}', 'x^2'], ['+3x', 'x']])
    expect(colored('2xy + 3yx')).toEqual([['2xy', 'xy'], ['+ 3yx', 'xy']])
    expect(colored('x \\cdot x')).toEqual([['x \\cdot x', 'x^2']])
  })

  it('lit les produits écrits avec \\cdot ou \\times et les décimales', () => {
    expect(colored('3\\cdot x + 2')).toEqual([['3\\cdot x', 'x'], ['+ 2', '']])
    expect(colored('2\\times y')).toEqual([['2\\times y', 'y']])
    expect(colored('1,5x + 2.5')).toEqual([['1,5x', 'x'], ['+ 2.5', '']])
  })

  it('ne colore jamais un terme qu\'il ne sait pas lire sûrement', () => {
    expect(colored('2(x+1) + 3')).toEqual([['+ 3', '']])
    expect(colored('\\frac{1}{2}x + 1')).toEqual([['+ 1', '']])
    expect(colored('x/2 + 1')).toEqual([['+ 1', '']])
    expect(colored('\\sqrt{2} + 1')).toEqual([['+ 1', '']])
    expect(colored('\\pi + 1')).toEqual([['+ 1', '']])
    expect(colored('x = 3')).toEqual([])
  })

  it('ne lève rien sur un LaTeX cassé ou tronqué', () => {
    expect(colored('3x+')).toEqual([['3x', 'x']])
    expect(colored('{3x')).toEqual([])
    expect(colored('\\frac{')).toEqual([])
    expect(colored('(3x')).toEqual([])
    expect(colored('+')).toEqual([])
    expect(colorTerms('')).toEqual([])
  })

  it('redonne exactement le LaTeX d\'entrée en recollant les segments', () => {
    for (const latex of ['3x+2y+1', ' 3x  +  2y -1 ', '-x+2', '2(x+1) + 3', '\\frac{1}{2}x + 1', '3x+', '{3x', '+', 'x^{2}+3x', '  ']) {
      expect(colorTerms(latex).map(s => s.text).join('')).toBe(latex)
    }
  })
})
