import { parseUnit } from './quantities'

// Une unité entre parenthèses ou crochets, en fin de cellule : « Distance (km) », « Prix [€] ».
const IN_BRACKETS = /[([]\s*([^()[\]]+?)\s*[)\]]\s*$/
// « … en km/h » : « en » isolé suivi d'un mot, en fin de texte.
const AFTER_EN = /(?:^|\s)en\s+(\S+)\s*$/i

function afterEn(text: string): string | null {
  const match = AFTER_EN.exec(text)
  return match === null ? null : parseUnit(match[1])
}

/**
 * L'unité d'une cellule d'en-tête, ou `null` : la cellule est tout entière une unité (`km`), ou finit
 * par une unité entre parenthèses ou crochets (`Distance (km)`), ou par « en » et une unité
 * (`Vitesse en km/h`). Une donnée comme `16 km` n'est pas un en-tête.
 */
export function headerUnit(cell: string): string | null {
  const text = cell.trim()
  if (text === '') return null
  const whole = parseUnit(text)
  if (whole !== null) return whole
  const bracket = IN_BRACKETS.exec(text)
  if (bracket !== null) return parseUnit(bracket[1]) ?? afterEn(bracket[1])
  return afterEn(text)
}

/**
 * Ce que les en-têtes d'un tableau disent de ses unités : `columns` (les unités sont sur la première
 * ligne, `units[c]` est celle de la colonne `c`) ou `rows` (sur la première colonne, `units[r]` est
 * celle de la ligne `r`). `units[0]` est toujours `null` : le coin est souvent le titre du tableau.
 */
export interface TableLayout {
  axis: 'columns' | 'rows'
  units: (string | null)[]
}

/**
 * La première ligne d'abord ; à défaut, la première colonne ; quand les deux ont des unités, la première
 * ligne l'emporte. `null` quand aucun en-tête n'est une unité (tableau vide, 1×1, nombres, mots).
 */
export function tableLayout(cells: readonly (readonly string[])[]): TableLayout | null {
  const columns = (cells[0] ?? []).map((cell, c) => (c === 0 ? null : headerUnit(cell)))
  if (columns.some(unit => unit !== null)) return { axis: 'columns', units: columns }
  const rows = cells.map((row, r) => (r === 0 ? null : headerUnit(row[0] ?? '')))
  if (rows.some(unit => unit !== null)) return { axis: 'rows', units: rows }
  return null
}
