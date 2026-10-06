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

export type CellKeyAction =
  | { kind: 'move'; to: CellMove }
  | { kind: 'focusAddRow' }
  | { kind: 'addRow' }
  | { kind: 'removeRow'; row: number; to: CellMove }

/**
 * Tab, Entrée et Retour arrière dans une case (`null` : la touche garde son effet natif).
 * - Tab : natif, sauf dans la toute dernière case, où il mène au « + » qui ajoute une ligne dessous.
 * - Entrée : case suivante (la ligne d'après au bout d'une ligne) ; dans la dernière case, une nouvelle ligne.
 * - Retour arrière dans une case VIDE : case précédente (fin de la ligne d'avant depuis la première) ;
 *   depuis la première case d'une ligne entièrement vide, supprime la ligne. Jamais en répétition de
 *   touche, pour qu'une touche maintenue n'efface pas tout le tableau.
 */
export function cellKeyAction(
  key: string, shift: boolean, repeat: boolean, row: number, column: number,
  cells: readonly (readonly string[])[], canAddRow: boolean,
): CellKeyAction | null {
  const rows = cells.length
  const columns = cells[0].length
  const last = row === rows - 1 && column === columns - 1
  switch (key) {
    case 'Tab': return !shift && last && canAddRow ? { kind: 'focusAddRow' } : null
    case 'Enter':
      if (shift) return null
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
