import { describe, expect, it } from 'vitest'
import {
  ZWSP, caretBeside, ensureAnchors, hasInlineMath, hasRawFormula, insertChipAtCaret, insertTextAtCaret, isChip, placeCaret, positionAt, readValue,
  renderValue, splitInlineMath, valueOffsetOf,
} from './inlineText'

const chip = (latex: string) => {
  const span = document.createElement('span')
  span.contentEditable = 'false'
  span.dataset.chip = ''
  span.dataset.latex = latex
  span.append(document.createElement('span'))
  return span
}
const make = (value: string) => {
  const root = document.createElement('div')
  document.body.append(root)
  renderValue(root, value, chip)
  return root
}

describe('texte à formules en ligne', () => {
  it('découpe texte et formules ; un $ sans fermeture reste du texte', () => {
    expect(splitInlineMath('donc $\\vec{u}$ et $x^2$ ok').map(p => p.kind)).toEqual(['text', 'math', 'text', 'math', 'text'])
    expect(hasInlineMath('5 $ pièce')).toBe(false)
    expect(hasInlineMath('a $ b\nc $ d')).toBe(false)
  })

  it('rend puis relit la valeur sans rien changer, pastilles comprises', () => {
    for (const value of ['', 'Bonjour', 'donc $\\overrightarrow{AB}$ ok', '$x$', 'a $x$ b $y$ c', 'ligne 1\nligne 2', 'fin\n']) {
      expect(readValue(make(value))).toBe(value)
    }
  })

  it('donne un nœud texte de chaque côté d’une pastille', () => {
    const root = make('$x$')
    expect(root.childNodes).toHaveLength(3)
    expect(root.firstChild).toBeInstanceOf(Text)
    expect(isChip(root.childNodes[1])).toBe(true)
    expect(root.lastChild).toBeInstanceOf(Text)
  })

  it('une pastille vide n’écrit rien, un $ dans son LaTeX est retiré', () => {
    const root = make('avant ')
    insertChipAtCaret(root, chip(''))
    expect(readValue(root)).toBe('avant ')
    const full = make('')
    insertChipAtCaret(full, chip('a$b'))
    expect(readValue(full)).toBe('$ab$')
  })

  it('situe le curseur dans la valeur, et retrouve sa place', () => {
    const root = make('ab $xy$ cd')
    const at = positionAt(root, 2)!
    expect(at.node.data.slice(at.offset)).toBe(' ')
    expect(valueOffsetOf(root, at.node, at.offset)).toBe(2)
    // Dans la formule : juste après la pastille.
    const inside = positionAt(root, 5)!
    expect(inside.node.data.replace(ZWSP, '')).toBe(' cd')
    expect(valueOffsetOf(root, inside.node, inside.offset)).toBe(7)
    expect(positionAt(root, 99)!.node.data.endsWith('cd')).toBe(true)
  })

  it('écrit du texte au curseur, et un saut de ligne final garde sa ligne', () => {
    const root = make('ab')
    placeCaret(root, positionAt(root, 1)!)
    insertTextAtCaret(root, 'X')
    expect(readValue(root)).toBe('aXb')
    const end = make('fin')
    placeCaret(end, positionAt(end, 3)!)
    insertTextAtCaret(end, '\n')
    expect(readValue(end)).toBe('fin\n')
    expect(end.lastChild).toBeInstanceOf(Text)
  })

  it('une pastille posée dans le texte coupe le nœud en deux', () => {
    const root = make('ab')
    placeCaret(root, positionAt(root, 1)!)
    insertChipAtCaret(root, chip('z'))
    expect(readValue(root)).toBe('a$z$b')
  })

  it('détecte une formule tapée à la main dans un nœud texte, et pose le curseur à côté d’une pastille', () => {
    const root = make('')
    root.firstChild!.replaceWith(document.createTextNode('on a $x$'))
    expect(hasRawFormula(root)).toBe(true)
    const done = make('a $x$ b')
    expect(hasRawFormula(done)).toBe(false)
    const c = done.childNodes[1] as HTMLElement
    caretBeside(done, c, 'after')
    expect(document.getSelection()!.anchorNode).toBe(c.nextSibling)
    ensureAnchors(done)
  })
})
