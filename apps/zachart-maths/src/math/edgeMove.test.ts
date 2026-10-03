import { describe, expect, it } from 'vitest'
import { edgeMove, isFlatLatex } from './edgeMove'

const caret = (over: object = {}) => ({ atStart: false, atEnd: false, collapsed: true, flat: true, ...over })

describe('edgeMove', () => {
  it('quitte à gauche seulement caret au début et sans sélection', () => {
    expect(edgeMove('ArrowLeft', caret({ atStart: true }))).toBe('left')
    expect(edgeMove('ArrowLeft', caret())).toBeNull()
    expect(edgeMove('ArrowLeft', caret({ atStart: true, collapsed: false }))).toBeNull()
  })
  it('quitte à droite seulement caret à la fin', () => {
    expect(edgeMove('ArrowRight', caret({ atEnd: true }))).toBe('right')
    expect(edgeMove('ArrowRight', caret())).toBeNull()
  })
  it('haut et bas quittent un champ à plat, pas une fraction', () => {
    expect(edgeMove('ArrowUp', caret())).toBe('up')
    expect(edgeMove('ArrowDown', caret({ flat: false }))).toBeNull()
  })
  it('ignore les autres touches', () => expect(edgeMove('a', caret({ atStart: true }))).toBeNull())
  it("isFlatLatex : faux dès qu'une structure 2D est ouverte", () => {
    expect(isFlatLatex('2x+5')).toBe(true)
    expect(isFlatLatex('\\frac{1}{2}')).toBe(false)
    expect(isFlatLatex('x^{2}')).toBe(false)
    expect(isFlatLatex('\\sqrt{x}')).toBe(false)
  })
})
