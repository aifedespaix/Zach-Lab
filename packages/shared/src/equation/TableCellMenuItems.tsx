import { ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, BoxSelect, Columns3, Rows3, Trash2 } from 'lucide-react'
import {
  ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger,
} from '../ui'

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
  /** Selection of the table's cells: the « Sélection » submenu appears when at least one is given. The app owns the selection. */
  onSelectRow?: (row: number) => void
  onSelectColumn?: (column: number) => void
  onSelectAll?: () => void
  /** The keys bound to each selection entry by the app, printed on the right (indicative only). */
  shortcuts?: {
    row?: string
    column?: string
    all?: string
    addRowAbove?: string
    addRowBelow?: string
    addColumnLeft?: string
    addColumnRight?: string
  }
}

/**
 * The table entries of a cell's right-click menu, in three submenus so the menu stays short:
 * « Sélection » (the row, the column or the whole table — apart from selecting the cell's own text),
 * « Ligne » (insert above / below, delete) and « Colonne » (insert left / right, delete). Items only —
 * the app puts them in its own menu (after cut / copy / paste) and gives the same callbacks it gives `TableGrid`.
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
  onSelectRow,
  onSelectColumn,
  onSelectAll,
  shortcuts = {},
}: TableCellMenuItemsProps) {
  const canSelect = onSelectRow !== undefined || onSelectColumn !== undefined || onSelectAll !== undefined
  return (
    <>
      {canSelect && (
        <ContextMenuSub>
          <ContextMenuSubTrigger><BoxSelect size={14} />Sélection</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {onSelectRow !== undefined && (
              <ContextMenuItem onSelect={() => onSelectRow(row)}>
                <Rows3 size={14} />Sélectionner la ligne<ContextMenuShortcut>{shortcuts.row}</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {onSelectColumn !== undefined && (
              <ContextMenuItem onSelect={() => onSelectColumn(column)}>
                <Columns3 size={14} />Sélectionner la colonne<ContextMenuShortcut>{shortcuts.column}</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {onSelectAll !== undefined && (
              <ContextMenuItem onSelect={onSelectAll}>
                <BoxSelect size={14} />Sélectionner tout le tableau<ContextMenuShortcut>{shortcuts.all}</ContextMenuShortcut>
              </ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      <ContextMenuSub>
        <ContextMenuSubTrigger><Rows3 size={14} />Ligne</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem disabled={!canAddRow} onSelect={() => onAddRow(row - 1)}>
            <ArrowUpToLine size={14} />Insérer une ligne au-dessus
          </ContextMenuItem>
          <ContextMenuItem disabled={!canAddRow} onSelect={() => onAddRow(row)}>
            <ArrowDownToLine size={14} />Insérer une ligne en dessous
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" disabled={rowCount <= 1} onSelect={() => onRemoveRow(row)}>
            <Trash2 size={14} />Supprimer la ligne
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSub>
        <ContextMenuSubTrigger><Columns3 size={14} />Colonne</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem disabled={!canAddColumn} onSelect={() => onAddColumn(column - 1)}>
            <ArrowLeftToLine size={14} />Insérer une colonne à gauche
          </ContextMenuItem>
          <ContextMenuItem disabled={!canAddColumn} onSelect={() => onAddColumn(column)}>
            <ArrowRightToLine size={14} />Insérer une colonne à droite
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" disabled={columnCount <= 1} onSelect={() => onRemoveColumn(column)}>
            <Trash2 size={14} />Supprimer la colonne
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
    </>
  )
}
