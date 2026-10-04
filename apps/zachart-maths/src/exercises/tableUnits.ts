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
 * celle de la ligne `r`). Le coin ne décide pas de l'axe, mais une fois l'axe retenu, il en fait partie :
 * `units[0]` = unité du coin si elle existe, sinon `null` (titre sans unité).
 */
export interface TableLayout {
  axis: 'columns' | 'rows'
  units: (string | null)[]
}

/**
 * La première ligne d'abord ; à défaut, la première colonne ; quand les deux ont des unités, la première
 * ligne l'emporte. Le coin ne vote pas : c'est l'axe retenu (hors coin) qui décide. `null` quand aucun
 * en-tête en dehors du coin n'est une unité (tableau vide, 1×1, nombres, mots, coin seul).
 * Une unité d'un seul caractère lue seule ne compte que si TOUTES les autres cellules d'en-tête
 * non vides du même axe (hors coin) sont aussi des unités.
 */
export function tableLayout(cells: readonly (readonly string[])[]): TableLayout | null {
  const corner = cells[0]?.[0] ?? ''
  const firstRow = cells[0] ?? []

  // Construit les unités de colonnes avec la garde appliquée
  const columns = firstRow.map((cell, c) =>
    c === 0 ? null : applyColumnGuard(cell, firstRow, c),
  )

  // Vérifie s'il y a au moins une unité valide (non null) en dehors du coin
  if (columns.some((u, i) => i > 0 && u !== null)) {
    const cornerUnit = applyColumnGuard(corner, firstRow, 0)
    return cornerUnit !== null || headerUnit(corner) === null
      ? { axis: 'columns', units: [cornerUnit, ...columns.slice(1)] }
      : null
  }

  // Construit les unités de lignes avec la garde appliquée
  const rows = cells.map((row, r) =>
    r === 0 ? null : applyRowGuard(row[0] ?? '', cells, r),
  )

  // Vérifie s'il y a au moins une unité valide en dehors du coin
  if (rows.some((u, i) => i > 0 && u !== null)) {
    const cornerUnit = applyRowGuard(corner, cells, 0)
    return cornerUnit !== null || headerUnit(corner) === null
      ? { axis: 'rows', units: [cornerUnit, ...rows.slice(1)] }
      : null
  }

  return null
}

/** Applique la garde à une cellule de colonne : une unité d'un seul caractère lue seule ne compte que
 * si tous les autres en-têtes non vides de la première ligne (excl. coin) sont aussi des unités. */
function applyColumnGuard(cell: string, firstRow: readonly string[], cellIndex: number): string | null {
  const unit = headerUnit(cell)
  if (unit === null) return null

  // Si l'unité n'est pas lue seule (c-à-d via parseUnit directement), pas de garde
  if (parseUnit(cell.trim()) !== unit) return unit

  // Si l'unité n'est pas d'un seul caractère, pas de garde
  if (unit.length !== 1) return unit

  // Unité d'un caractère lue seule : vérifie que tous les autres en-têtes de la ligne sont des unités
  for (let i = 1; i < firstRow.length; i++) {
    if (i === cellIndex) continue // Exclut la cellule elle-même
    const neighbor = firstRow[i]
    if (neighbor.trim() === '') continue // Ignore les cellules vides
    if (headerUnit(neighbor) === null) return null // Une voisine non vide n'est pas une unité
  }

  return unit
}

/** Applique la garde à une cellule de ligne : une unité d'un seul caractère lue seule ne compte que
 * si tous les autres en-têtes non vides de la première colonne (excl. coin) sont aussi des unités. */
function applyRowGuard(cell: string, cells: readonly (readonly string[])[], cellIndex: number): string | null {
  const unit = headerUnit(cell)
  if (unit === null) return null

  // Si l'unité n'est pas lue seule (c-à-d via parseUnit directement), pas de garde
  if (parseUnit(cell.trim()) !== unit) return unit

  // Si l'unité n'est pas d'un seul caractère, pas de garde
  if (unit.length !== 1) return unit

  // Unité d'un caractère lue seule : vérifie que tous les autres en-têtes de la colonne sont des unités
  for (let i = 1; i < cells.length; i++) {
    if (i === cellIndex) continue // Exclut la cellule elle-même
    const neighbor = cells[i]?.[0] ?? ''
    if (neighbor.trim() === '') continue // Ignore les cellules vides
    if (headerUnit(neighbor) === null) return null // Une voisine non vide n'est pas une unité
  }

  return unit
}
