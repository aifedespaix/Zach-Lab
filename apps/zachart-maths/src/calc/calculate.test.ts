import { describe, expect, it } from 'vitest'
import { calculate, formatNumber, normalize } from './calculate'

const text = (e: string, ans = 0) => {
  const r = calculate(e, ans)
  return r.ok ? r.text : r.error
}

describe('calculate', () => {
  it('les quatre opérations, avec priorités et parenthèses', () => {
    expect(text('2+3×4')).toBe('14')
    expect(text('(2+3)×4')).toBe('20')
    expect(text('10 ÷ 4 − 1')).toBe('1,5')
  })
  it('virgule décimale en entrée comme en sortie, sans erreur d\'arrondi', () => {
    expect(text('0,1+0,2')).toBe('0,3')
    expect(text('1÷3')).toBe('0,333333333333')
  })
  it('racine, carré, puissance, π, pourcentage, multiplication implicite', () => {
    expect(text('√16')).toBe('4')
    expect(text('√(9+16)')).toBe('5')
    expect(text('5^2')).toBe('25')
    expect(text('2π')).toBe('6,28318530718')
    expect(text('50%')).toBe('0,5')
    expect(text('200×15%')).toBe('30')
    expect(text('2(3+4)')).toBe('14')
  })
  it('« Rép » reprend le dernier résultat', () => {
    expect(text('ans×2', 21)).toBe('42')
    expect(text('Rép+1', 41)).toBe('42')
  })
  it('dit quand c\'est impossible ou incomplet, sans lever', () => {
    expect(text('1÷0')).toBe('Calcul impossible')
    expect(text('2+')).toBe('Calcul incomplet')
    expect(text('')).toBe('')
  })
  it('refuse ce qui sort du calcul', () => {
    expect(calculate('import({a: 1})').ok).toBe(false)
    expect(calculate('evaluate("1+1")').ok).toBe(false)
  })
  it('formate', () => {
    expect(formatNumber(-0)).toBe('0')
    expect(formatNumber(1234567.891)).toBe('1234567,891')
    expect(normalize('3 × 2')).toBe('3 * 2')
  })
})
