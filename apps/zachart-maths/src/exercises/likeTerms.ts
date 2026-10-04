// apps/zachart-maths/src/exercises/likeTerms.ts

/**
 * Un morceau d'un membre d'équation. `group` est la partie littérale du terme (`x`, `xy`, `x^2`),
 * `''` pour une constante, `null` quand le morceau n'est pas coloré (opérateur, espace, terme que
 * l'on ne sait pas lire sûrement). Les `text` mis bout à bout redonnent exactement le LaTeX lu.
 */
export interface TermSegment {
  text: string
  group: string | null
}

const SIGN = /^[+\-−]\s*/
// Ce qu'on refuse de lire : regrouper `2(x+1)` ou `\frac{1}{2}x` demanderait de développer.
const UNREADABLE = /[()[\]/]|\\(?:left|right|frac|dfrac|tfrac|sqrt|div|over)/
const NOISE = /\\cdot|\\times|\\,|\\ |[×·*\s]/g
const FACTOR = '(\\d+(?:[.,]\\d+)?)|([A-Za-z])(?:\\^(?:\\{(\\d+)\\}|(\\d+)))?'

/** La partie littérale d'un terme, ou `null` si on ne sait pas le lire. */
function groupOf(term: string): string | null {
  const body = term.replace(SIGN, '')
  if (UNREADABLE.test(body)) return null
  const flat = body.replace(NOISE, '')
  if (flat === '') return null
  const letters = new Map<string, number>()
  const factor = new RegExp(FACTOR, 'y')
  let at = 0
  while (at < flat.length) {
    factor.lastIndex = at
    const match = factor.exec(flat)
    if (match === null) return null // un caractère inattendu : on ne colore pas
    if (match[2] !== undefined) letters.set(match[2], (letters.get(match[2]) ?? 0) + Number(match[3] ?? match[4] ?? 1))
    at = factor.lastIndex
  }
  if (letters.size === 0) return '' // que des nombres : une constante
  return [...letters]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([letter, power]) => (power === 1 ? letter : `${letter}^${power}`))
    .join('')
}

/**
 * Découpe un membre aux `+` et `−` de premier niveau (hors accolades, parenthèses et crochets).
 * Le signe reste avec le terme qu'il précède ; les espaces autour d'un terme sont des segments à
 * part, pour ne jamais finir dans une boîte colorée.
 */
export function colorTerms(latex: string): TermSegment[] {
  if (latex === '') return []
  const cuts = [0]
  let depth = 0
  for (let i = 0; i < latex.length; i++) {
    const char = latex[i]
    if (char === '{' || char === '(' || char === '[') depth++
    else if (char === '}' || char === ')' || char === ']') depth = Math.max(0, depth - 1)
    // Un signe en tête n'est pas une coupure : il appartient au premier terme.
    else if (depth === 0 && (char === '+' || char === '-' || char === '−') && latex.slice(cuts[cuts.length - 1], i).trim() !== '') cuts.push(i)
  }
  cuts.push(latex.length)

  const segments: TermSegment[] = []
  for (let k = 0; k < cuts.length - 1; k++) {
    const raw = latex.slice(cuts[k], cuts[k + 1])
    if (raw.trim() === '') {
      segments.push({ text: raw, group: null })
      continue
    }
    const lead = /^\s*/.exec(raw)![0]
    const trail = /\s*$/.exec(raw)![0]
    const core = raw.slice(lead.length, raw.length - trail.length)
    if (lead !== '') segments.push({ text: lead, group: null })
    segments.push({ text: core, group: groupOf(core) })
    if (trail !== '') segments.push({ text: trail, group: null })
  }
  return segments
}
