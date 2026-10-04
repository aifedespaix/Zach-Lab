/**
 * Une grandeur trouvée dans un texte : une valeur et son unité (`16 km`, `x km/h`) ou une unité
 * composée toute seule (`km/h`). `unit` est la forme canonique, celle qui sert de clé de couleur :
 * `16 km` et `4km` partagent `km`, `4 m^2` devient `m²`, `2 l` devient `L`.
 */
export interface Quantity {
  start: number
  /** Exclu, comme pour `String.slice`. */
  end: number
  unit: string
  /** `valeur` : un nombre ou une inconnue précède l'unité ; `unite` : l'unité est seule. */
  kind: 'valeur' | 'unite'
}

const BASE_CANON: Record<string, string> = { l: 'L', dl: 'dL', cl: 'cL', ml: 'mL' }

// Les unités à plusieurs lettres passent avant celles d'une lettre : `min` avant `m`, `km` avant `m`.
const LONG_BASES = 'km|dm|cm|mm|kg|mg|min|ms|dL|dl|cL|cl|mL|ml'
const SHORT_BASES = 'm|g|t|h|s|L|l|€|°|%'
// Pour BARE, exclure « t » de la correspondance sans puissance (jamais seule, avec ou sans puissance).
const SHORT_BASES_NO_T = 'm|g|h|s|L|l|€|°|%'
const BASE = `(?:${LONG_BASES}|${SHORT_BASES})`
const POWER = '(?:²|³|\\^2|\\^3)'
const OPT_POWER = `${POWER}?`
/** Une unité, composée ou non : `km`, `m²`, `km/h`, `kg/m³`. */
const UNIT = `${BASE}${OPT_POWER}(?:/${BASE}${OPT_POWER})?`

const SPACE = '[\\u0020\\u00a0\\u202f]'
const NUMBER = `\\d+(?:${SPACE}\\d{3})*(?:[.,]\\d+)?`
const VARIABLE = '[xyztvdn]'

// Ni lettre ni chiffre avant, pas de lettre après : « 16 kilos », « 3 solutions » et « max km » n'en sont pas.
const START = '(?<![\\p{L}\\d])'
const END = '(?![\\p{L}])'

const VALUE = new RegExp(`${START}(?:${NUMBER}|${VARIABLE})${SPACE}?(${UNIT})${END}`, 'gu')

// Une unité seule n'est colorée que si rien ne la confond avec une lettre ou un mot : composée,
// longue, ou portant une puissance. La lettre « t » n'est jamais colorée seule : exclue du match final.
const BARE = new RegExp(
  `${START}(?:${BASE}${OPT_POWER}/${BASE}${OPT_POWER}|(?:${LONG_BASES})${OPT_POWER}|(?:${SHORT_BASES_NO_T})${POWER})${END}`,
  'gu',
)

function canonical(raw: string): string {
  return raw
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .split('/')
    .map(part => {
      const power = /[²³]$/.exec(part)?.[0] ?? ''
      const base = part.slice(0, part.length - power.length)
      return (BASE_CANON[base] ?? base) + power
    })
    .join('/')
}

/** Les grandeurs d'un texte, dans l'ordre, sans chevauchement. */
export function findQuantities(text: string): Quantity[] {
  const found: Quantity[] = []
  for (const match of text.matchAll(VALUE)) {
    const unit = canonical(match[1])
    // Une inconnue (« t ») devant une unité d'un caractère (« s ») n'est presque jamais une grandeur.
    if (!/\d/.test(match[0][0]) && unit.length < 2) continue
    // La lettre « t » (tonne), seule ou en puissance, n'est reconnue qu'avec une espace entre le nombre
    // et l'unité : « 2 t » est colorée, « 2t », « 4,9t² » (chute libre) et « 2t² + 3t » (polynôme) non.
    // On regarde le caractère juste avant l'unité, pas tout le match : « 1 000t » a une espace dans le nombre.
    if (/^t[²³]?$/.test(unit) && !/[   ]/.test(match[0][match[0].length - match[1].length - 1])) continue
    found.push({ start: match.index, end: match.index + match[0].length, unit, kind: 'valeur' })
  }
  for (const match of text.matchAll(BARE)) {
    const start = match.index
    const end = start + match[0].length
    if (found.some(q => start < q.end && end > q.start)) continue
    found.push({ start, end, unit: canonical(match[0]), kind: 'unite' })
  }
  return found.sort((a, b) => a.start - b.start)
}

const WHOLE_UNIT = new RegExp(`^(${UNIT})$`, 'u')

/**
 * L'unité canonique d'un texte qui est TOUT ENTIER une unité (`km`, `h`, `km/h`, `m²`), ou `null`.
 * Sert aux en-têtes de tableau, où le contexte lève l'ambiguïté des unités d'une lettre (`h`, `s`) que
 * `findQuantities` refuse dans un texte libre. La lettre `t` seule reste refusée, comme dans un texte :
 * tonne ou temps ? (`t (s)` donne `s` par ailleurs.)
 */
export function parseUnit(text: string): string | null {
  const match = WHOLE_UNIT.exec(text.trim())
  if (match === null) return null
  const unit = canonical(match[1])
  return /^t[²³]?$/.test(unit) ? null : unit
}
