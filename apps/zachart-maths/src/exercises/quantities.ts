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
// longue, ou portant une puissance. `m`, `h` ou `s` tout seuls ne le sont jamais.
const BARE = new RegExp(
  `${START}(?:${BASE}${OPT_POWER}/${BASE}${OPT_POWER}|(?:${LONG_BASES})${OPT_POWER}|${BASE}${POWER})${END}`,
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
