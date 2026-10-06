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
