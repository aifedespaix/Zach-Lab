import type { LatexHighlight } from '@suite/shared/equation'
import { findQuantities, type Quantity } from './quantities'
import { background, type Theme } from './termColors'

/** Le LaTeX lu comme du texte, avec, pour chaque caractère lu, sa place (`[start, end)`) dans le LaTeX. */
interface Plain {
  text: string
  start: number[]
  end: number[]
}

// `\text{ km}`, `\mathrm{km}` : seul le contenu compte. Les espaces de LaTeX (`\,` `\ ` `~`) valent une espace, `^{2}` vaut `^2`.
const TOKEN = /\\(?:text|textrm|mathrm|operatorname)\{([^{}]*)\}|\\[,;: !]|~|\^\{(\d)\}/y

/**
 * Le LaTeX d'une formule aplati en texte que `findQuantities` sait lire : `16\text{ km}` devient `16 km`,
 * `3\,\mathrm{km/h}` devient `3 km/h`. On garde la trace des indices pour peindre au bon endroit du LaTeX.
 */
function toPlain(latex: string): Plain {
  const plain: Plain = { text: '', start: [], end: [] }
  const push = (char: string, start: number, end: number) => {
    plain.text += char
    plain.start.push(start)
    plain.end.push(end)
  }
  let at = 0
  while (at < latex.length) {
    TOKEN.lastIndex = at
    const match = TOKEN.exec(latex)
    if (match === null) {
      push(latex[at], at, at + 1)
      at++
      continue
    }
    const to = at + match[0].length
    if (match[1] !== undefined) {
      const from = at + match[0].indexOf('{') + 1
      // Le dernier caractère emporte l'accolade fermante : la couleur couvre tout `\text{ km}`, pas `\text{ km`.
      for (let i = 0; i < match[1].length; i++) push(match[1][i], from + i, i === match[1].length - 1 ? to : from + i + 1)
    } else if (match[2] !== undefined) {
      push('^', at, at + 1)
      push(match[2], at + 2, to)
    } else {
      push(' ', at, to)
    }
    at = to
  }
  return plain
}

/** Les grandeurs d'une formule (`16\text{ km}`, `x\,\mathrm{km/h}`), avec leur place dans le LaTeX. */
export function findLatexQuantities(latex: string): (Quantity & { from: number; to: number })[] {
  const plain = toPlain(latex)
  return findQuantities(plain.text).map(quantity => ({
    ...quantity,
    from: plain.start[quantity.start],
    to: plain.end[quantity.end - 1],
  }))
}

/** Les lettres que l'on prend pour des inconnues quand elles sont seules dans une formule, et leur teinte. */
const UNKNOWN_HUES: Readonly<Record<string, number>> = { x: 215, y: 340, z: 150 }

/**
 * La coloration d'une formule, à peindre DANS le champ MathLive : les grandeurs prennent la teinte de leur
 * unité (`hues`, celle de tout l'exercice, la même que dans l'énoncé), et, avec `unknowns`, une inconnue
 * seule (`x`, `y`, `z`) a sa propre teinte. Un `x` collé à une unité (`x km/h`) est une grandeur, pas une inconnue.
 */
export function latexQuantityHighlights(
  latex: string,
  hues: ReadonlyMap<string, number>,
  theme: Theme,
  unknowns = false,
): LatexHighlight[] {
  const plain = toPlain(latex)
  const highlights: LatexHighlight[] = []
  const covered: [number, number][] = []
  for (const quantity of findQuantities(plain.text)) {
    covered.push([quantity.start, quantity.end])
    const hue = hues.get(quantity.unit)
    if (hue !== undefined) {
      highlights.push({ from: plain.start[quantity.start], to: plain.end[quantity.end - 1], color: background(hue, theme, false) })
    }
  }
  if (unknowns) {
    for (const match of plain.text.matchAll(/(?<![\p{L}\\])[xyz](?![\p{L}])/gu)) {
      const index = match.index
      if (covered.some(([start, end]) => index >= start && index < end)) continue
      // Le terme entier, comme dans une équation : le coefficient (`3x`) et l'exposant (`x^2`) sont peints avec la lettre.
      let from = index
      while (from > 0 && /[\d.,]/.test(plain.text[from - 1]) && !covered.some(([start, end]) => from - 1 >= start && from - 1 < end)) from--
      if (!/\d/.test(plain.text[from])) from = index
      const power = /^\^\d/.exec(plain.text.slice(index + 1))
      const last = power === null ? index : index + power[0].length
      highlights.push({ from: plain.start[from], to: plain.end[last], color: background(UNKNOWN_HUES[match[0]], theme, false) })
    }
  }
  return highlights.sort((a, b) => a.from - b.from)
}
