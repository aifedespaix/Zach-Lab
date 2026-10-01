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
  it('n\'injecte jamais de HTML venu du texte', () => {
    const { container } = render(<Markdown source={'<img src=x onerror=alert(1)> <script>alert(1)</script>'} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container).toHaveTextContent('<script>')
  })
})
