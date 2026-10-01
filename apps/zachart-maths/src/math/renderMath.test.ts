import { describe, expect, it } from 'vitest'
import { renderMathToHtml } from './renderMath'

describe('renderMathToHtml', () => {
  it('compose une formule et ignore le vide', () => {
    expect(renderMathToHtml('\\frac{1}{2}')).toContain('katex')
    expect(renderMathToHtml('  ')).toBe('')
  })
  it('ne lève jamais : une formule invalide ou démesurée donne un repli lisible', () => {
    expect(() => renderMathToHtml('\\frac{')).not.toThrow()
    expect(() => renderMathToHtml('\\sqrt{'.repeat(2000))).not.toThrow()
    expect(renderMathToHtml('x'.repeat(6000))).toContain('katex-fallback')
  })
  it('refuse ce qui sortirait du texte (trust: false)', () => {
    expect(renderMathToHtml('\\href{javascript:alert(1)}{x}')).not.toContain('<a ')
  })
})
