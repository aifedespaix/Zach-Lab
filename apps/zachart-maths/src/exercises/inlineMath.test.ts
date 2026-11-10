import { describe, expect, it } from 'vitest'
import { hasInlineMath, insideInlineMath, splitInlineMath, textInsertion } from './inlineMath'
import { SYMBOL_FAMILIES } from './toolbarCatalog'

const symbol = (label: string) => SYMBOL_FAMILIES.flatMap(f => f.symbols).find(s => s.label === label)!

describe('formules dans un texte', () => {
  it('découpe texte et formules, un $ isolé reste du texte', () => {
    expect(splitInlineMath('donc $\\vec{u}$ et $x^2$ ok')).toEqual([
      { kind: 'text', value: 'donc ' }, { kind: 'math', value: '\\vec{u}' },
      { kind: 'text', value: ' et ' }, { kind: 'math', value: 'x^2' }, { kind: 'text', value: ' ok' },
    ])
    expect(hasInlineMath('coûte 5 $ pièce')).toBe(false)
    expect(hasInlineMath('a $ b\n c $ d')).toBe(false)
  })

  it('sait si le curseur est dans une formule', () => {
    expect(insideInlineMath('on a $x', 7)).toBe(true)
    expect(insideInlineMath('on a $x$ puis', 13)).toBe(false)
  })

  it('une structure s’écrit entre $, curseur dans le premier trou', () => {
    const r = textInsertion(symbol('Vecteur AB'), '', false)
    expect(r).toEqual({ text: '$\\overrightarrow{}$', caret: 17 })
    const frac = textInsertion(symbol('Fraction'), '', false)
    expect(frac.text).toBe('$\\frac{}{}$')
    expect(frac.text.slice(0, frac.caret)).toBe('$\\frac{')
  })

  it('la sélection devient le contenu, le curseur passe au trou suivant', () => {
    const frac = textInsertion(symbol('Fraction'), '3', false)
    expect(frac.text).toBe('$\\frac{3}{}$')
    expect(frac.text.slice(0, frac.caret)).toBe('$\\frac{3}{')
  })

  it('dans une formule déjà ouverte, pas de nouveaux $ ; un signe simple reste du texte', () => {
    expect(textInsertion(symbol('Vecteur AB'), '', true).text).toBe('\\overrightarrow{}')
    expect(textInsertion(symbol('Inférieur ou égal'), '', false)).toEqual({ text: '≤', caret: 1 })
  })
})
