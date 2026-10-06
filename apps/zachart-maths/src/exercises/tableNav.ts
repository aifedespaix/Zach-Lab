export type CellMove = { row: number; column: number; caret: 'start' | 'end' }

/**
 * La case où mènent les flèches depuis (`row`, `column`), ou `null` si la flèche reste dans la case.
 * Haut/bas : la case voisine de la même colonne. Gauche/droite : la case voisine de la même ligne,
 * seulement quand le curseur n'a plus de caractère à franchir (début pour gauche, fin pour droite) ;
 * on arrive de l'autre côté du texte. Aucun retour à la ligne : au bord du tableau, rien ne bouge.
 */
export function cellMove(
  key: string, row: number, column: number, rows: number, columns: number,
  caret: { start: number; end: number; length: number },
): CellMove | null {
  const collapsed = caret.start === caret.end
  switch (key) {
    case 'ArrowUp': return row > 0 ? { row: row - 1, column, caret: 'end' } : null
    case 'ArrowDown': return row < rows - 1 ? { row: row + 1, column, caret: 'end' } : null
    case 'ArrowLeft': return collapsed && caret.start === 0 && column > 0 ? { row, column: column - 1, caret: 'end' } : null
    case 'ArrowRight': return collapsed && caret.end === caret.length && column < columns - 1 ? { row, column: column + 1, caret: 'start' } : null
    default: return null
  }
}

export type InsertShortcut = { axis: 'row' | 'column'; side: 'before' | 'after' }

/**
 * Ctrl/Cmd+Alt+flèche : insère une ligne (haut/bas) ou une colonne (gauche/droite) de ce côté de la case,
 * sans rien d'autre sur la touche (Maj à part, pour ne pas voler la sélection).
 */
export function insertShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): InsertShortcut | null {
  if (!(e.ctrlKey || e.metaKey) || !e.altKey || e.shiftKey) return null
  switch (e.key) {
    case 'ArrowUp': return { axis: 'row', side: 'before' }
    case 'ArrowDown': return { axis: 'row', side: 'after' }
    case 'ArrowLeft': return { axis: 'column', side: 'before' }
    case 'ArrowRight': return { axis: 'column', side: 'after' }
    default: return null
  }
}

export type CellKeyAction =
  | { kind: 'move'; to: CellMove }
  | { kind: 'addColumn'; after: number }
  | { kind: 'focusAddRow' }
  | { kind: 'addRow' }
  | { kind: 'removeRow'; row: number; to: CellMove }

/**
 * Tab, Entrée et Retour arrière dans une case (`null` : la touche garde son effet natif).
 * - Tab : natif, sauf dans la toute dernière case, où il mène au « + » qui ajoute une ligne dessous.
 * - Entrée : case suivante (la ligne d'après au bout d'une ligne) ; dans la dernière case, une nouvelle ligne.
 *   Maj+Entrée : case précédente. Ctrl/Cmd+Entrée : nouvelle colonne après celle de la case.
 * - Retour arrière dans une case VIDE : case précédente (fin de la ligne d'avant depuis la première) ;
 *   depuis la première case d'une ligne entièrement vide, supprime la ligne. Jamais en répétition de
 *   touche, pour qu'une touche maintenue n'efface pas tout le tableau.
 */
export function cellKeyAction(
  key: string, shift: boolean, repeat: boolean, row: number, column: number,
  cells: readonly (readonly string[])[], canAddRow: boolean,
  { mod = false, canAddColumn = false }: { mod?: boolean; canAddColumn?: boolean } = {},
): CellKeyAction | null {
  if (mod) return key === 'Enter' && canAddColumn ? { kind: 'addColumn', after: column } : null
  const rows = cells.length
  const columns = cells[0].length
  const last = row === rows - 1 && column === columns - 1
  switch (key) {
    case 'Tab': return !shift && last && canAddRow ? { kind: 'focusAddRow' } : null
    case 'Enter':
      if (shift) {
        if (column > 0) return { kind: 'move', to: { row, column: column - 1, caret: 'end' } }
        return row > 0 ? { kind: 'move', to: { row: row - 1, column: columns - 1, caret: 'end' } } : null
      }
      if (!last) return { kind: 'move', to: column < columns - 1 ? { row, column: column + 1, caret: 'end' } : { row: row + 1, column: 0, caret: 'end' } }
      return canAddRow ? { kind: 'addRow' } : null
    case 'Backspace': {
      if (cells[row][column] !== '') return null
      if (column > 0) return { kind: 'move', to: { row, column: column - 1, caret: 'end' } }
      if (row === 0) return null
      if (!repeat && rows > 1 && cells[row].every(cell => cell === '')) {
        return { kind: 'removeRow', row, to: { row: row - 1, column: columns - 1, caret: 'end' } }
      }
      return { kind: 'move', to: { row: row - 1, column: columns - 1, caret: 'end' } }
    }
    default: return null
  }
}

/** Un rectangle de cases, bornes comprises. */
export type CellRect = { top: number; left: number; bottom: number; right: number }
export type CellPoint = { row: number; column: number }

export const rectOf = (a: CellPoint, b: CellPoint): CellRect => ({
  top: Math.min(a.row, b.row), bottom: Math.max(a.row, b.row),
  left: Math.min(a.column, b.column), right: Math.max(a.column, b.column),
})
export const inRect = (rect: CellRect, row: number, column: number) =>
  row >= rect.top && row <= rect.bottom && column >= rect.left && column <= rect.right

/** Les cases du rectangle vidées. */
export const clearRect = (cells: readonly (readonly string[])[], rect: CellRect): string[][] =>
  cells.map((line, r) => line.map((cell, c) => (inRect(rect, r, c) ? '' : cell)))

/** Le rectangle en texte tabulé, comme un tableur le copie. */
export const rectToTsv = (cells: readonly (readonly string[])[], rect: CellRect): string =>
  cells.slice(rect.top, rect.bottom + 1).map(line => line.slice(rect.left, rect.right + 1).join('\t')).join('\n')

/**
 * Le texte d'un tableur (tabulations, retours à la ligne) posé à partir de (`row`, `column`) ; le tableau
 * grandit jusqu'à `max` lignes/colonnes, le reste est ignoré. `null` : ce n'est pas une grille (une seule
 * valeur), le collage reste celui du champ.
 */
export function pasteGrid(
  cells: readonly (readonly string[])[], row: number, column: number, text: string, max: number,
): string[][] | null {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(line => line.split('\t'))
  if (lines.length === 1 && lines[0].length === 1) return null
  const width = Math.min(max, Math.max(cells[0].length, column + Math.max(...lines.map(line => line.length))))
  const height = Math.min(max, Math.max(cells.length, row + lines.length))
  const next = Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => cells[r]?.[c] ?? ''))
  lines.forEach((line, i) => line.forEach((value, j) => {
    if (row + i < height && column + j < width) next[row + i][column + j] = value.trim()
  }))
  return next
}

const NUMBER = /^-?\d+(?:[.,]\d+)?$/
const toNumber = (cell: string | undefined): number | null => {
  const text = (cell ?? '').trim()
  return NUMBER.test(text) ? Number(text.replace(',', '.')) : null
}

export type CrossProduct = { value: string; formula: string }

/**
 * Le produit en croix qui remplirait la case vide (`row`, `column`) : un rectangle dont les trois autres
 * coins sont des nombres (le coin opposé non nul). On prend le rectangle le plus proche de la case.
 */
export function crossProduct(cells: readonly (readonly string[])[], row: number, column: number): CrossProduct | null {
  // La case a pu disparaître (ligne supprimée) depuis que le focus s'y est posé.
  if (cells[row] === undefined || column >= cells[0].length || cells[row][column].trim() !== '') return null
  const rowsByDistance = cells.map((_, r) => r).filter(r => r !== row).sort((a, b) => Math.abs(a - row) - Math.abs(b - row))
  const columnsByDistance = cells[0].map((_, c) => c).filter(c => c !== column).sort((a, b) => Math.abs(a - column) - Math.abs(b - column))
  for (const r2 of rowsByDistance) {
    for (const c2 of columnsByDistance) {
      const a = toNumber(cells[row][c2]), b = toNumber(cells[r2][column]), d = toNumber(cells[r2][c2])
      if (a === null || b === null || d === null || d === 0) continue
      const value = Number(((a * b) / d).toPrecision(10))
      const text = String(value).replace('.', ',')
      return { value: text, formula: `${cells[row][c2].trim()} × ${cells[r2][column].trim()} ÷ ${cells[r2][c2].trim()} = ${text}` }
    }
  }
  return null
}
