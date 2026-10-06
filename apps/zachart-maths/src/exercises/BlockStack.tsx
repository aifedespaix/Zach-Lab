import { useContext, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { TableCellMenuItems, TableGrid, type BlockEdgeHandle } from '@suite/shared/equation'
import { motion, useReducedMotion } from 'motion/react'
import { Button, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from '@suite/shared/ui'
import { Columns3, Grid2x2X, Rows3 } from 'lucide-react'
import { BlockCard } from './BlockCard'
import { BLOCK_META } from './blockMeta'
import { BlockContextMenu } from './BlockContextMenu'
import { CalcEditor } from './CalcEditor'
import { EmptyAreaContextMenu } from './EmptyAreaContextMenu'
import { EquationEditor, type SubBlockContext } from './EquationEditor'
import { FieldContextMenu } from './FieldContextMenu'
import { HighlightedTextarea, UnitHuesContext } from './HighlightedTextarea'
import { borderOf, headerToneOf, toneOf } from './toolbarCatalog'
import { canRemoveRect, cellKeyAction, cellMove, clearRect, crossProduct, deleteShortcut, inRect, insertShortcut, pasteGrid, rectOf, rectToTsv, removeRect, type CellMove, type CellPoint } from './tableNav'
import { tableLayout } from './tableUnits'
import { spacing, useCompact } from './useCompact'
import { useUnitColors } from './useUnitColors'
import {
  BLOCK_TYPES, MAX_TABLE, newBlock, addColumn, addRow, canGrow, convertBlock, duplicateBlock, insertBlockAfter, isKnown, moveBlock, parseBlocks,
  removeBlock, removeColumn, removeRow, setCell, updateBlock, type Block, type BlockType, type EquationBlock, type KnownBlock, type TableBlock, type TextBlock,
} from './blocks'

const field = 'rounded border bg-background px-2 py-1 text-sm'

function TextEditor({ block, onChange }: { block: TextBlock; onChange: (patch: Partial<TextBlock>) => void }) {
  return (
    <FieldContextMenu kind="text">
      <HighlightedTextarea
        aria-label="Texte"
        value={block.contenu}
        rows={Math.max(2, block.contenu.split('\n').length)}
        onChange={e => onChange({ contenu: e.target.value })}
        className={`${field} hue-field w-full`}
      />
    </FieldContextMenu>
  )
}

/** Les flèches changent de case (voir `cellMove`) ; la case d'arrivée reçoit le focus et le curseur. */
function focusCell(scope: HTMLElement | null, move: CellMove): boolean {
  const target = scope?.querySelector<HTMLInputElement>(`input[aria-label="Ligne ${move.row + 1}, colonne ${move.column + 1}"]`)
  if (target === null || target === undefined) return false
  target.focus()
  const caret = move.caret === 'start' ? 0 : target.value.length
  target.setSelectionRange(caret, caret)
  return true
}

function moveBetweenCells(e: KeyboardEvent<HTMLInputElement>, row: number, column: number, rows: number, columns: number) {
  if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
  const input = e.currentTarget
  const move = cellMove(e.key, row, column, rows, columns, {
    start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0, length: input.value.length,
  })
  if (move === null) return
  if (focusCell(input.closest<HTMLElement>('[data-testid="table-scroll"]'), move)) e.preventDefault()
}

function TableEditor({ block, onChange, index }: { block: TableBlock; onChange: (patch: Partial<TableBlock>) => void; index: number }) {
  const cells = block.cellules
  const colorEnabled = useUnitColors(state => state.enabled)
  const hues = useContext(UnitHuesContext)
  // Réglage coupé : pas d'analyse du tout, le tableau est celui d'avant.
  const layout = colorEnabled ? tableLayout(cells) : null
  /**
   * Le fond d'une cellule : la teinte de l'unité de sa colonne (ou de sa ligne), un cran plus soutenu
   * sur la cellule d'en-tête. Rien quand l'en-tête n'est pas une unité, que l'exercice n'a pas de
   * teinte pour elle, ou que l'entrée de la colonne (ligne) est `null` (ex. un coin-titre).
   */
  const fillOf = (row: number, column: number): string | undefined => {
    if (layout === null) return undefined
    const unit = layout.axis === 'columns' ? layout.units[column] : layout.units[row]
    const hue = unit === null || unit === undefined ? undefined : hues.get(unit)
    if (hue === undefined) return undefined
    const isHeader = layout.axis === 'columns' ? row === 0 : column === 0
    return isHeader ? headerToneOf(hue) : toneOf(hue)
  }
  const set = (next: string[][]) => onChange({ cellules: next })
  const scrollRef = useRef<HTMLDivElement>(null)
  // La case à focaliser une fois le rendu fait (ligne tout juste ajoutée ou case d'après une suppression).
  const pendingFocus = useRef<CellMove | null>(null)
  useEffect(() => {
    if (pendingFocus.current === null) return
    const move = pendingFocus.current
    pendingFocus.current = null
    focusCell(scrollRef.current, move)
  }, [cells])
  // La sélection rectangulaire (Maj+flèches, Maj+clic) et la case qui a le focus (pour l'aide au calcul).
  const [selection, setSelection] = useState<{ anchor: CellPoint; head: CellPoint } | null>(null)
  const [focused, setFocusCell] = useState<CellPoint | null>(null)
  const rect = selection === null ? null : rectOf(selection.anchor, selection.head)
  const multi = rect !== null && (rect.top !== rect.bottom || rect.left !== rect.right)
  const rowTotal = cells.length
  const columnTotal = cells[0].length
  useEffect(() => setSelection(null), [rowTotal, columnTotal])

  /** La case d'où part un glisser à la souris, tant que le bouton est enfoncé. */
  const dragFrom = useRef<CellPoint | null>(null)
  useEffect(() => {
    const end = () => { dragFrom.current = null }
    window.addEventListener('mouseup', end)
    return () => window.removeEventListener('mouseup', end)
  }, [])
  /** Sélectionne un rectangle, le curseur restant (ou revenant) dans la case `at` pour que Suppr, Ctrl+C… agissent dessus. */
  const selectRect = (anchor: CellPoint, head: CellPoint, at: CellPoint) => {
    setSelection({ anchor, head })
    setTimeout(() => focusCell(scrollRef.current, { ...at, caret: 'end' }), 0)
  }
  const selectRow = (row: number, at: CellPoint = { row, column: 0 }) => selectRect({ row, column: 0 }, { row, column: columnTotal - 1 }, at)
  const selectColumn = (column: number, at: CellPoint = { row: 0, column }) => selectRect({ row: 0, column }, { row: rowTotal - 1, column }, at)
  const selectAll = (at: CellPoint = { row: 0, column: 0 }) => selectRect({ row: 0, column: 0 }, { row: rowTotal - 1, column: columnTotal - 1 }, at)

  const extendSelection = (from: CellPoint, to: CellPoint) => {
    setSelection({ anchor: selection?.anchor ?? from, head: to })
    focusCell(scrollRef.current, { row: to.row, column: to.column, caret: 'end' })
  }
  /** Retire les lignes et/ou colonnes que la sélection couvre ; le curseur revient sur la case qui prend leur place. */
  const removeSelected = (what: { rows: boolean; columns: boolean }) => {
    if (rect === null) return
    const can = canRemoveRect(cells, rect)
    const rows = what.rows && can.rows
    const columns = what.columns && can.columns
    if (!rows && !columns) return
    const next = removeRect(cells, rect, { rows, columns })
    pendingFocus.current = {
      row: Math.min(rows ? rect.top : (focused?.row ?? rect.top), next.length - 1),
      column: Math.min(columns ? rect.left : (focused?.column ?? rect.left), next[0].length - 1),
      caret: 'start',
    }
    set(next)
  }
  const onCellKeyDown = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const input = e.currentTarget
    if (e.nativeEvent.isComposing) return
    // Ctrl+Alt+flèche : une ligne ou une colonne de ce côté de la case.
    const insert = insertShortcut(e)
    if (insert !== null) {
      e.preventDefault()
      if (insert.axis === 'row') {
        if (!canGrow(cells, 'row')) return
        pendingFocus.current = { row: insert.side === 'before' ? r : r + 1, column: c, caret: 'start' }
        set(addRow(cells, insert.side === 'before' ? r - 1 : r))
      } else {
        if (!canGrow(cells, 'col')) return
        pendingFocus.current = { row: r, column: insert.side === 'before' ? c : c + 1, caret: 'start' }
        set(addColumn(cells, insert.side === 'before' ? c - 1 : c))
      }
      return
    }
    // Ctrl+Suppr : les colonnes de la sélection ; Ctrl+Maj+Suppr : ses lignes ; Ctrl+Alt+Maj+Suppr : les deux.
    const removal = multi ? deleteShortcut(e) : null
    if (removal !== null) {
      e.preventDefault()
      removeSelected(removal)
      return
    }
    // Ctrl+Espace : la colonne ; Ctrl+Maj+Espace : la ligne ; Ctrl+A quand tout le texte de la case est déjà sélectionné : tout le tableau.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const at = { row: r, column: c }
      if (e.key === ' ') {
        e.preventDefault()
        if (e.shiftKey) selectRow(r, at)
        else selectColumn(c, at)
        return
      }
      if (e.key.toLowerCase() === 'a' && !e.shiftKey && input.selectionStart === 0 && input.selectionEnd === input.value.length) {
        e.preventDefault()
        selectAll(at)
        return
      }
    }
    // Maj+flèches : étendre la sélection. Verticalement toujours ; horizontalement seulement quand le texte ne peut plus s'étendre.
    if (e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && e.key.startsWith('Arrow')) {
      const head = selection?.head ?? { row: r, column: c }
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0 || (input.selectionStart === 0 && selection !== null)
      const atEnd = input.selectionEnd === input.value.length && input.selectionStart === input.value.length || (input.selectionEnd === input.value.length && selection !== null)
      const to: CellPoint | null =
        e.key === 'ArrowUp' ? { row: Math.max(0, head.row - 1), column: head.column }
        : e.key === 'ArrowDown' ? { row: Math.min(rowTotal - 1, head.row + 1), column: head.column }
        : e.key === 'ArrowLeft' && atStart ? { row: head.row, column: Math.max(0, head.column - 1) }
        : e.key === 'ArrowRight' && atEnd ? { row: head.row, column: Math.min(columnTotal - 1, head.column + 1) }
        : null
      if (to !== null) {
        e.preventDefault()
        extendSelection({ row: r, column: c }, to)
      }
      return
    }
    if (multi && rect !== null && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        set(clearRect(cells, rect))
        return
      }
      // Toute autre touche abandonne la sélection et garde son effet.
      if (e.key !== 'Shift') setSelection(null)
    } else if (selection !== null && e.key === 'Escape') {
      setSelection(null)
    }
    moveBetweenCells(e, r, c, rowTotal, columnTotal)
    if (e.defaultPrevented) return
    const action = cellKeyAction(e.key, e.shiftKey, e.repeat, r, c, cells, canGrow(cells, 'row'), {
      mod: e.ctrlKey || e.metaKey, canAddColumn: canGrow(cells, 'col'),
    })
    if (action === null || e.altKey) return
    e.preventDefault()
    switch (action.kind) {
      case 'move': focusCell(scrollRef.current, action.to); break
      case 'focusAddRow':
        scrollRef.current?.querySelector<HTMLButtonElement>(`button[aria-label^="Insérer une ligne après la ligne ${rowTotal} "]`)?.focus()
        break
      case 'addRow':
        pendingFocus.current = { row: rowTotal, column: 0, caret: 'start' }
        set(addRow(cells))
        break
      case 'addColumn':
        pendingFocus.current = { row: r, column: action.after + 1, caret: 'start' }
        set(addColumn(cells, action.after))
        break
      case 'removeRow':
        pendingFocus.current = action.to
        set(removeRow(cells, action.row))
        break
    }
  }
  const onCellPaste = (e: ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const grid = pasteGrid(cells, r, c, e.clipboardData.getData('text'), MAX_TABLE)
    if (grid === null) return
    e.preventDefault()
    set(grid)
  }
  const onCellCopy = (e: ClipboardEvent<HTMLInputElement>, cut: boolean) => {
    if (!multi || rect === null) return
    e.preventDefault()
    e.clipboardData.setData('text/plain', rectToTsv(cells, rect))
    if (cut) set(clearRect(cells, rect))
  }
  const hint = focused === null || multi ? null : crossProduct(cells, focused.row, focused.column)
  const addRowAfter = (after: number) => set(addRow(cells, after))
  const addColumnAfter = (after: number) => set(addColumn(cells, after))
  const removeRowAt = (row: number) => set(removeRow(cells, row))
  const removeColumnAt = (column: number) => set(removeColumn(cells, column))
  return (
    // `overflow-x: auto` forces `overflow-y: auto`, which would clip the « + »
    // after the last column / row: they straddle the grid's right and bottom
    // edges by 13px (TableGrid's HANDLE_STRADDLE). 14px keeps them inside.
    <div
      ref={scrollRef}
      data-testid="table-scroll"
      onBlur={e => {
        if (!(e.relatedTarget instanceof Node && scrollRef.current?.contains(e.relatedTarget))) setFocusCell(null)
      }}
      style={{ overflowX: 'auto', paddingRight: 14, paddingBottom: 14 }}>
      <TableGrid
        tableLabel={String(index + 1)}
        handlesTabbable={false}
        rowCount={cells.length}
        columnCount={cells[0].length}
        renderCell={(r, c) => (
          <FieldContextMenu
            kind="text"
            selectAllLabel="Sélectionner la case"
            extra={
              <>
              {multi && rect !== null && inRect(rect, r, c) && (
                <>
                  <ContextMenuItem variant="destructive" disabled={!canRemoveRect(cells, rect).rows} onSelect={() => removeSelected({ rows: true, columns: false })}>
                    <Rows3 size={14} />Supprimer les lignes<ContextMenuShortcut>Ctrl + Maj + Suppr</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem variant="destructive" disabled={!canRemoveRect(cells, rect).columns} onSelect={() => removeSelected({ rows: false, columns: true })}>
                    <Columns3 size={14} />Supprimer les colonnes<ContextMenuShortcut>Ctrl + Suppr</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="destructive"
                    disabled={!canRemoveRect(cells, rect).rows || !canRemoveRect(cells, rect).columns}
                    onSelect={() => removeSelected({ rows: true, columns: true })}
                  >
                    <Grid2x2X size={14} />Supprimer les colonnes et les lignes<ContextMenuShortcut>Ctrl + Alt + Maj + Suppr</ContextMenuShortcut>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              <TableCellMenuItems
                row={r}
                column={c}
                rowCount={cells.length}
                columnCount={cells[0].length}
                canAddRow={canGrow(cells, 'row')}
                canAddColumn={canGrow(cells, 'col')}
                onAddRow={addRowAfter}
                onAddColumn={addColumnAfter}
                onRemoveRow={removeRowAt}
                onRemoveColumn={removeColumnAt}
                onSelectRow={row => selectRow(row, { row: r, column: c })}
                onSelectColumn={column => selectColumn(column, { row: r, column: c })}
                onSelectAll={() => selectAll({ row: r, column: c })}
                shortcuts={{ row: 'Ctrl + Maj + Espace', column: 'Ctrl + Espace', all: 'Ctrl + A ×2' }}
              />
              </>
            }
          >
            <input
              aria-label={`Ligne ${r + 1}, colonne ${c + 1}`}
              value={cells[r][c]}
              onChange={e => set(setCell(cells, r, c, e.target.value))}
              onKeyDown={e => onCellKeyDown(e, r, c)}
              onPaste={e => onCellPaste(e, r, c)}
              onCopy={e => onCellCopy(e, false)}
              onCut={e => onCellCopy(e, true)}
              onFocus={() => setFocusCell({ row: r, column: c })}
              onMouseDown={e => {
                if (e.button !== 0) return
                // Maj+clic : sélectionne le rectangle depuis la case qui avait le focus.
                if (e.shiftKey && focused !== null) {
                  e.preventDefault()
                  setSelection({ anchor: selection?.anchor ?? focused, head: { row: r, column: c } })
                  return
                }
                // Un clic simple lâche la sélection ; s'il glisse sur une autre case, `onMouseEnter` en fait une.
                if (!e.shiftKey) {
                  dragFrom.current = { row: r, column: c }
                  setSelection(null)
                }
              }}
              onMouseEnter={e => {
                const from = dragFrom.current
                if (from === null || e.buttons !== 1) return
                setSelection({ anchor: from, head: { row: r, column: c } })
              }}
              className="focus-cell-input w-full bg-background px-2 py-1 text-sm"
              style={{
                border: '1px solid var(--border)',
                background: fillOf(r, c),
                boxShadow: multi && rect !== null && inRect(rect, r, c) ? 'inset 0 0 0 2px var(--primary)' : undefined,
              }}
            />
          </FieldContextMenu>
        )}
        onAddRow={addRowAfter}
        onAddColumn={addColumnAfter}
        onRemoveRow={removeRowAt}
        onRemoveColumn={removeColumnAt}
        canAddRow={canGrow(cells, 'row')}
        canAddColumn={canGrow(cells, 'col')}
        addDisabledReason={{ row: '12 lignes au maximum', column: '12 colonnes au maximum' }}
      />
      {hint !== null && focused !== null && (
        <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.85 }}>
          Produit en croix : {hint.formula}{' '}
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={e => e.preventDefault()}
            onClick={() => set(setCell(cells, focused.row, focused.column, hint.value))}
            style={{ textDecoration: 'underline' }}
          >Remplir</button>
        </p>
      )}
    </div>
  )
}

function editorFor(block: KnownBlock, onChange: (patch: Partial<KnownBlock>) => void, ctx: SubBlockContext, index: number) {
  switch (block.type) {
    case 'texte': return <TextEditor block={block} onChange={onChange} />
    case 'calcul': return <CalcEditor block={block} onChange={onChange} ctx={ctx} />
    case 'tableau': return <TableEditor block={block} onChange={onChange} index={index} />
    case 'equation': return <EquationEditor block={block} onChange={onChange as (patch: Partial<EquationBlock>) => void} ctx={ctx} />
  }
}

/** La pile de blocs de la zone de travail : chaque bloc se déplace d'un cran et se supprime, et les boutons d'ajout sont au bout. */
export function BlockStack({ value, onChange, label = "Blocs de l'exercice", onSend, sendTo, split = false, onToggleSplit, arrivedId = null }: {
  value: readonly unknown[]
  onChange: (blocs: Block[]) => void
  label?: string
  /** Présent quand l'exercice est scindé : envoie un bloc dans l'autre zone (câblé au clic droit). */
  onSend?: (id: string) => void
  /** De quel côté est l'autre zone : sens de la flèche du bouton d'envoi de chaque bloc. */
  sendTo?: 'left' | 'right'
  /** L'exercice est-il scindé ? Dit au clic droit sur le vide s'il faut proposer de scinder ou de réunir. */
  split?: boolean
  /** Scinder ou réunir les zones ; absent, le clic droit sur le vide ne le propose pas. */
  onToggleSplit?: () => void
  /** Le bloc qui vient de l'autre zone : fondu d'entrée, halo et curseur. */
  arrivedId?: string | null
}) {
  const compact = useCompact(state => state.enabled)
  const blocks = useMemo(() => parseBlocks(value), [value])
  const toFocus = useRef<string | null>(arrivedId)
  const reduced = useReducedMotion()
  /** Le bloc qui porte le halo : celui qu'on vient de déplacer ou de recevoir. */
  const [halo, setHalo] = useState<string | null>(arrivedId)

  // Un bloc arrivé de l'autre zone : halo, et le curseur y entre pour qu'on continue d'écrire.
  useEffect(() => {
    if (arrivedId === null) return
    setHalo(arrivedId)
    toFocus.current = arrivedId
  }, [arrivedId])

  // Le bloc qu'on vient d'ajouter reçoit le curseur : on peut écrire sans cliquer une seconde fois.
  useEffect(() => {
    if (toFocus.current === null) return
    const target = document.querySelector<HTMLElement>(`[data-block-id="${toFocus.current}"]`)
    toFocus.current = null
    target?.querySelector<HTMLElement>('textarea, input, math-field')?.focus()
  }, [blocks, arrivedId])

  const move = (id: string, delta: -1 | 1) => {
    setHalo(id)
    onChange(moveBlock(blocks, id, delta))
  }

  const add = (type: BlockType) => {
    const block = newBlock(type)
    toFocus.current = block.id
    onChange([...blocks, block])
  }
  /** Un bloc juste sous `id` (le calcul fini appelle le suivant) ; il reçoit le curseur. */
  const insertAfter = (id: string, type: BlockType) => {
    const r = insertBlockAfter(blocks, id, type)
    toFocus.current = r.added.id
    onChange(r.blocks)
  }

  /** Ce que chaque bloc expose pour qu'on y ENTRE au clavier (équation, calcul). */
  const edges = useRef(new Map<string, BlockEdgeHandle | null>())
  /** Le curseur au bord d'un bloc : son handle s'il en a un, sinon son premier ou dernier champ. */
  const enterBlock = (id: string, at: 'start' | 'end') => {
    const edge = edges.current.get(id)
    if (edge) return edge.focusEdge(at)
    const fields = document.querySelectorAll<HTMLElement>(`[data-block-id="${id}"] textarea, [data-block-id="${id}"] input, [data-block-id="${id}"] math-field`)
    fields[at === 'start' ? 0 : fields.length - 1]?.focus()
  }
  /** Un bloc vide qui demande à disparaître : le curseur passe à son voisin. */
  const removeAndFocus = (index: number, side: 'before' | 'after') => {
    const neighbour = blocks[side === 'before' ? index - 1 : index + 1]
    onChange(removeBlock(blocks, blocks[index].id))
    if (neighbour !== undefined) queueMicrotask(() => enterBlock(neighbour.id, side === 'before' ? 'end' : 'start'))
  }

  return (
    <EmptyAreaContextMenu onAdd={add} split={split} onToggleSplit={onToggleSplit}>
    {/* `minHeight: 100%` : le clic droit sur le blanc sous les blocs, jusqu'au bas de la zone, ouvre le menu du vide. */}
    <div data-testid="zone-vide" style={{ minHeight: '100%' }}>
      <ul aria-label={label} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing(compact).stackGap }}>
        {blocks.map((block, i) => (
          <motion.li
            key={block.id}
            // `position` : seule la place anime, jamais la taille — une carte qui s'agrandit ne s'étire pas.
            layout={reduced ? false : 'position'}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            initial={block.id === arrivedId ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            data-slide={reduced ? 'off' : 'on'}
          >
            <BlockContextMenu
              index={i}
              count={blocks.length}
              kind={isKnown(block) ? block.type : null}
              onMove={delta => move(block.id, delta)}
              onDuplicate={() => {
                const r = duplicateBlock(blocks, block.id)
                setHalo(r.added.id)
                onChange(r.blocks)
              }}
              onRemove={() => onChange(removeBlock(blocks, block.id))}
              onChangeKind={type => {
                if (isKnown(block)) onChange(blocks.map(b => (b.id === block.id ? convertBlock(block, type) : b)))
              }}
              onSend={onSend === undefined ? undefined : () => onSend(block.id)}
            >
              <div>
                <BlockCard
                  block={block}
                  index={i}
                  count={blocks.length}
                  halo={halo === block.id}
                  onHaloEnd={() => setHalo(null)}
                  onMove={delta => move(block.id, delta)}
                  onRemove={() => onChange(removeBlock(blocks, block.id))}
                  onSend={onSend === undefined ? undefined : () => onSend(block.id)}
                  sendTo={sendTo}
                >
                  {isKnown(block)
                    ? editorFor(block, patch => onChange(updateBlock(blocks, block.id, patch)), {
                        index: i,
                        edge: handle => { edges.current.set(block.id, handle) },
                        // Entrée crée un sous-bloc ; Ctrl/Cmd+Entrée un BLOC, du même type (c'est ce qu'on écrit ensuite).
                        onEnterBlock: () => insertAfter(block.id, block.type),
                        onExitBlock: side => {
                          const target = blocks[side === 'before' ? i - 1 : i + 1]
                          if (target !== undefined) enterBlock(target.id, side === 'before' ? 'end' : 'start')
                        },
                        onDeleteEmpty: () => removeAndFocus(i, 'before'),
                        onDeleteForward: () => removeAndFocus(i, 'after'),
                        // La barre de symboles suit le champ par `onFocus` de la zone de travail.
                        onFieldChange: () => {},
                      }, i)
                    : <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Ce type de bloc n'est pas encore pris en charge ; il est conservé tel quel.</p>}
                </BlockCard>
              </div>
            </BlockContextMenu>
          </motion.li>
        ))}
      </ul>

      {blocks.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Par quoi veux-tu commencer ?</p>
      )}
      <div role="group" aria-label="Ajouter un bloc" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {BLOCK_TYPES.map(({ type }) => {
          const { label: name, icon: Icon, hue } = BLOCK_META[type]
          return (
            <Button
              key={type}
              variant="outline"
              size="sm"
              aria-label={`Ajouter un bloc ${name}`}
              onClick={() => add(type)}
              style={{ borderColor: borderOf(hue), background: toneOf(hue) }}
            >
              <Icon />{name}
            </Button>
          )
        })}
      </div>
    </div>
    </EmptyAreaContextMenu>
  )
}
