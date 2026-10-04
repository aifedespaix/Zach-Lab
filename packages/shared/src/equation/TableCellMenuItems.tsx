import { ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, Trash2 } from 'lucide-react'
import { ContextMenuItem, ContextMenuSeparator } from '../ui'

interface TableCellMenuItemsProps {
  /** The cell the menu was opened on. */
  row: number
  column: number
  rowCount: number
  columnCount: number
  /** `false` at the size cap of the app: the insertions of that axis are greyed out. Default true. */
  canAddRow?: boolean
  canAddColumn?: boolean
  /** Same contract as `TableGrid`: `after` is the index the new line goes after; `-1` = before the first. */
  onAddRow: (after: number) => void
  onAddColumn: (after: number) => void
  onRemoveRow: (row: number) => void
  onRemoveColumn: (column: number) => void
}

/**
 * The table entries of a cell's right-click menu: insert a row above / below, a column left / right,
 * delete the row / the column of that cell. Items only — the app puts them in its own menu (after
 * cut / copy / paste) and gives the same callbacks it gives `TableGrid`.
 *
 * A table keeps at least one row and one column, so the deletions are greyed out on the last one.
 */
export function TableCellMenuItems({
  row,
  column,
  rowCount,
  columnCount,
  canAddRow = true,
  canAddColumn = true,
  onAddRow,
  onAddColumn,
  onRemoveRow,
  onRemoveColumn,
}: TableCellMenuItemsProps) {
  return (
    <>
      <ContextMenuItem disabled={!canAddRow} onSelect={() => onAddRow(row - 1)}>
        <ArrowUpToLine size={14} />Insérer une ligne au-dessus
      </ContextMenuItem>
      <ContextMenuItem disabled={!canAddRow} onSelect={() => onAddRow(row)}>
        <ArrowDownToLine size={14} />Insérer une ligne en dessous
      </ContextMenuItem>
      <ContextMenuItem disabled={!canAddColumn} onSelect={() => onAddColumn(column - 1)}>
        <ArrowLeftToLine size={14} />Insérer une colonne à gauche
      </ContextMenuItem>
      <ContextMenuItem disabled={!canAddColumn} onSelect={() => onAddColumn(column)}>
        <ArrowRightToLine size={14} />Insérer une colonne à droite
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" disabled={rowCount <= 1} onSelect={() => onRemoveRow(row)}>
        <Trash2 size={14} />Supprimer la ligne
      </ContextMenuItem>
      <ContextMenuItem variant="destructive" disabled={columnCount <= 1} onSelect={() => onRemoveColumn(column)}>
        <Trash2 size={14} />Supprimer la colonne
      </ContextMenuItem>
    </>
  )
}
