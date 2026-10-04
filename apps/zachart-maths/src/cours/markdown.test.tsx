import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Markdown, parseMarkdown } from './markdown'

describe('parseMarkdown', () => {
  it('reconnaît titres, paragraphes (lignes jointes) et listes', () => {
    expect(parseMarkdown('# Titre\n\nUne ligne\nsuite\n\n- a\n- b\n\n1. un\n2. deux')).toEqual([
      { t: 'h', level: 1, text: 'Titre' },
      { t: 'p', text: 'Une ligne suite' },
      { t: 'ul', items: ['a', 'b'] },
      { t: 'ol', items: ['un', 'deux'] },
    ])
  })
  it('lit une formule en bloc, sur une ou plusieurs lignes', () => {
    expect(parseMarkdown('$$a+b$$')).toEqual([{ t: 'math', latex: 'a+b' }])
    expect(parseMarkdown('$$\na+b\n=c\n$$\n\nAprès')).toEqual([{ t: 'math', latex: 'a+b\n=c' }, { t: 'p', text: 'Après' }])
  })
  it('lit un tableau', () => {
    expect(parseMarkdown('| A | B |\n|---|---|\n| 1 | 2 |')).toEqual([{ t: 'table', header: ['A', 'B'], rows: [['1', '2']] }])
  })
  it('lit un encadré, son titre et son corps en Markdown', () => {
    expect(parseMarkdown('> [!methode] Les étapes\n> 1. un\n> 2. deux\n>\n> Fin')).toEqual([
      { t: 'callout', kind: 'methode', title: 'Les étapes', body: [{ t: 'ol', items: ['un', 'deux'] }, { t: 'p', text: 'Fin' }] },
    ])
  })
  it('accepte l\'étiquette accentuée ou en majuscules, et garde la citation simple et l\'étiquette inconnue', () => {
    expect(parseMarkdown('> [!Propriété]\n> Texte')[0]).toMatchObject({ t: 'callout', kind: 'propriete', title: '' })
    expect(parseMarkdown('> simple')).toEqual([{ t: 'quote', text: 'simple' }])
    expect(parseMarkdown('> [!inconnu]\n> x')[0]).toMatchObject({ t: 'quote' })
    expect(parseMarkdown('> [!constructor]\n> x')[0]).toMatchObject({ t: 'quote' })
  })
  it('ne boucle pas sur une entrée étrange', () => {
    expect(() => parseMarkdown('$$\nnon fermé\n\n- ?\n>\n|')).not.toThrow()
    expect(parseMarkdown('')).toEqual([])
  })
})

describe('Markdown', () => {
  it('compose les formules, le gras et l\'italique', () => {
    const { container } = render(<Markdown source={'Un **gras**, un *italique* et $x^2$.\n\n$$\\frac{1}{2}$$'} />)
    expect(container.querySelector('strong')).toHaveTextContent('gras')
    expect(container.querySelector('em')).toHaveTextContent('italique')
    expect(container.querySelectorAll('.katex').length).toBe(2)
    expect(container.querySelector('.katex-display')).not.toBeNull()
  })
  it('rend un encadré avec son libellé, son titre et ses formules', () => {
    const { container } = render(<Markdown source={'> [!definition] Hypoténuse\n> Le côté **opposé** à $\\widehat{A}$.'} />)
    const box = container.querySelector('[data-callout="definition"]')
    expect(box).toHaveTextContent('Définition — Hypoténuse')
    expect(box?.querySelector('strong')).toHaveTextContent('opposé')
    expect(box?.querySelector('.katex')).not.toBeNull()
  })
  it('n\'injecte jamais de HTML venu du texte', () => {
    const { container } = render(<Markdown source={'<img src=x onerror=alert(1)> <script>alert(1)</script>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container).toHaveTextContent('<script>')
  })
})
