import type { SymbolEntry } from './toolbarCatalog'

/**
 * Les formules dans un texte libre (énoncé, bloc texte, réponse) : un fragment de LaTeX entre `$…$`,
 * comme dans une phrase de manuel (« donc $\overrightarrow{AB} = \overrightarrow{DC}$ »). Un `$` seul,
 * sans fermeture sur la même ligne, reste un `$` ordinaire.
 */
const INLINE = /\$([^$\n]+)\$/g

export type TextPart = { kind: 'text'; value: string } | { kind: 'math'; value: string }

/** Le texte découpé en morceaux de texte et de formules ; les morceaux recollés (avec `$`) redonnent l'entrée. */
export function splitInlineMath(text: string): TextPart[] {
  const parts: TextPart[] = []
  let cursor = 0
  for (const match of text.matchAll(INLINE)) {
    const start = match.index
    if (start > cursor) parts.push({ kind: 'text', value: text.slice(cursor, start) })
    parts.push({ kind: 'math', value: match[1] })
    cursor = start + match[0].length
  }
  if (cursor < text.length) parts.push({ kind: 'text', value: text.slice(cursor) })
  return parts
}

export const hasInlineMath = (text: string) => splitInlineMath(text).some(p => p.kind === 'math')

/** Le curseur est-il déjà dans une formule ? (nombre impair de `$` avant lui sur sa ligne) */
export function insideInlineMath(text: string, caret: number): boolean {
  const line = text.slice(0, caret).split('\n').pop() ?? ''
  return (line.match(/\$/g)?.length ?? 0) % 2 === 1
}

/**
 * Ce qu'on écrit dans un champ de texte pour un signe de la barre, et où va le curseur ensuite (décalage
 * dans `text`). Un signe sans structure (≤, π, α) s'écrit tel quel ; une structure (fraction, vecteur, arc…) s'écrit en
 * LaTeX entre `$…$`, sauf si le curseur est déjà dans une formule. La sélection devient le contenu de la
 * structure (`#0`) ; le curseur se pose sur le premier trou à remplir.
 */
export function textInsertion(symbol: SymbolEntry, selected: string, inMath: boolean): { text: string; caret: number } {
  if (symbol.mathOnly !== true) return { text: symbol.glyph, caret: symbol.glyph.length }
  const template = symbol.latex
  const wantsHole = selected !== '' || !template.includes('#0')
  let out = ''
  let caret: number | null = null
  for (let i = 0; i < template.length; ) {
    if (template.startsWith('#0', i)) {
      if (caret === null && !wantsHole) caret = out.length
      out += selected
      i += 2
    } else if (template.startsWith('#?', i)) {
      if (caret === null) caret = out.length
      i += 2
    } else {
      out += template[i]
      i += 1
    }
  }
  const body = caret ?? out.length
  return inMath ? { text: out, caret: body } : { text: `$${out}$`, caret: body + 1 }
}
