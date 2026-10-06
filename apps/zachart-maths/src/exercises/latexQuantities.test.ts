import { describe, expect, it } from 'vitest'
import { findLatexQuantities, latexQuantityHighlights } from './latexQuantities'

const hues = new Map([['km', 150], ['km/h', 30], ['m²', 280]])
const slice = (latex: string, h: { from: number; to: number }) => latex.slice(h.from, h.to)

describe('findLatexQuantities', () => {
  it('lit les unités écrites en \\text, \\mathrm ou avec une espace LaTeX', () => {
    const latex = '16\\text{ km} + 3\\,\\mathrm{km/h} + 5~m^{2}'
    expect(findLatexQuantities(latex).map(q => [q.unit, latex.slice(q.from, q.to)])).toEqual([
      ['km', '16\\text{ km}'],
      ['km/h', '3\\,\\mathrm{km/h}'],
      ['m²', '5~m^{2}'],
    ])
  })

  it('ne lit rien dans un LaTeX sans grandeur', () => {
    expect(findLatexQuantities('\\frac{x}{2} = 7')).toEqual([])
  })
})

describe('latexQuantityHighlights', () => {
  it('peint chaque grandeur de la teinte de son unité, et ignore une unité sans teinte', () => {
    const latex = '16\\text{ km} \\times 4\\text{ kg}'
    const found = latexQuantityHighlights(latex, hues, 'light')
    expect(found.map(h => slice(latex, h))).toEqual(['16\\text{ km}'])
    expect(found[0].color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('une inconnue seule a sa teinte avec `unknowns`, pas un x collé à une unité ni une lettre de commande', () => {
    const latex = 'x + 2y = \\max(3, z) + x\\,\\mathrm{km/h}'
    expect(latexQuantityHighlights(latex, hues, 'light').map(h => slice(latex, h))).toEqual(['x\\,\\mathrm{km/h}'])
    expect(latexQuantityHighlights(latex, hues, 'light', true).map(h => slice(latex, h))).toEqual(['x', '2y', 'z','x\\,\\mathrm{km/h}'])
  })

  it("une inconnue est peinte avec son coefficient et son exposant, comme un terme d'�quation", () => {
    const latex = '3x + 2.5y^2 = 4 + x'
    expect(latexQuantityHighlights(latex, hues, 'light', true).map(h => slice(latex, h))).toEqual(['3x', '2.5y^2', 'x'])
  })

  it("une formule vide n'a rien à peindre", () => {
    expect(latexQuantityHighlights('', hues, 'dark', true)).toEqual([])
  })
})
