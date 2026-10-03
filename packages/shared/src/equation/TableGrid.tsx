import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Hint } from '../ui'

export interface TableGridProps {
  /** Identifies the table in accessible names (« …du tableau 2 »). */
  tableLabel: string
  rowCount: number
  columnCount: number
  /** An optional header row, drawn above the body: `renderHeader(c)` returns the cell's content. */
  renderHeader?: (column: number) => ReactNode
  /** Every cell's content; the grid wraps it in a `data-cell="r,c"` element. */
  renderCell: (row: number, column: number) => ReactNode
  /** `after` is the index the new line goes after; `-1` = before the first. */
  onAddRow: (after: number) => void
  onAddColumn: (after: number) => void
  onRemoveRow: (row: number) => void
  onRemoveColumn: (column: number) => void
  /** Put on the grid's root element (tests find the table by it). */
  'data-testid'?: string
}

/**
 * A table drawn as a CSS grid with a `+` on every row and column boundary and a
 * bin next to it. Purely presentational: it knows counts and render callbacks,
 * never the data. Needs a `TooltipProvider` above it (the handles' hints): every
 * app mounts one.
 *
 * A `+` sits on every boundary — above each column, left of each row — and a
 * bin next to it. That is the whole editing model: click where you want the new
 * cell to appear.
 *
 * The grid is CSS rather than a `<table>`: the handles live BETWEEN the cells
 * rather than in a cell of their own, and a `<td>` cannot sit between two rows.
 */
export function TableGrid({
  tableLabel,
  rowCount,
  columnCount,
  renderHeader,
  renderCell,
  onAddRow,
  onAddColumn,
  onRemoveRow,
  onRemoveColumn,
  'data-testid': testId,
}: TableGridProps) {
  // At least one track: `repeat(0, …)` is invalid CSS and would drop the whole template.
  const trackCount = Math.max(1, columnCount)
  const canRemoveColumn = columnCount > 1
  const canRemoveRow = rowCount > 1

  /**
   * La ligne et la colonne survolées, et — séparément — celles dont une
   * cellule a le focus.
   *
   * Les garder séparés est ce qui répare le clic sur la poubelle : cliquer
   * dessus déplace le focus depuis la cellule qui l'avait, donc déclenche un
   * `blur` — et un SEUL état partagé entre survol et focus se faisait remettre
   * à `null` par ce `blur`, cachant la poubelle (et coupant son
   * `pointer-events`) entre le `mousedown` et le `click` qui devait la
   * déclencher. Avec deux états, le `blur` ne touche plus que `focused`, et
   * seulement quand le focus quitte le tableau (`relatedTarget` hors de la
   * grille) — jamais quand il se pose sur la poubelle elle-même, qui est
   * dedans.
   *
   * `active` est celle qu'on affiche : la survolée tant que la souris est
   * dans le tableau, sinon celle qui a le focus — exactement le modèle
   * demandé : le survol mène tant qu'on reste dans le tableau, et ne cède la
   * place qu'à la sortie ; le focus, lui, garde une cellule "sélectionnée"
   * même quand la souris est repartie ailleurs.
   */
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null)
  const [focused, setFocused] = useState<{ row: number; col: number } | null>(null)
  const active = hovered ?? focused
  const gridRef = useRef<HTMLDivElement>(null)

  function cellOf(target: EventTarget | null): { row: number; col: number } | null {
    if (!(target instanceof HTMLElement)) return null
    const key = target.closest<HTMLElement>('[data-cell]')?.dataset.cell
    if (key === undefined) return null
    const [rowText, colText] = key.split(',')
    const row = Number(rowText)
    const col = Number(colText)
    return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null
  }

  const columns = Array.from({ length: columnCount }, (_, c) => c)
  const rows = Array.from({ length: rowCount }, (_, r) => r)

  return (
      <div
        ref={gridRef}
        data-testid={testId}
        onMouseOver={event => {
          const cell = cellOf(event.target)
          if (cell) setHovered(cell)
        }}
        onMouseLeave={() => setHovered(null)}
        onFocus={event => {
          const cell = cellOf(event.target)
          if (cell) setFocused(cell)
        }}
        onBlur={event => {
          const next = event.relatedTarget
          if (next instanceof Node && gridRef.current?.contains(next) === true) return
          setFocused(null)
        }}
        style={{
          display: 'grid',
          // 52px de gouttière : la largeur qu'il faut au `+` de frontière ET à la
          // poubelle de la ligne, qui ne se chevauchent pas parce que l'un est
          // collé au bord droit et l'autre au bord gauche. La poubelle d'une
          // COLONNE, elle, est centrée sur sa colonne, donc hors de ce calcul.
          gridTemplateColumns: `52px repeat(${trackCount}, minmax(84px, 1fr))`,
          gap: TABLE_GRID_GAP,
          alignItems: 'stretch',
        }}
      >
        {/* Column boundaries, above the header. The corner holds the boundary
            BEFORE the first column, which no per-column handle can reach: handle
            `i` inserts AFTER column `i`, and now sits on exactly that boundary. */}
        <div style={HANDLE_ROW}>
          <TableHandle
            label={`Insérer une colonne avant la colonne 1 du tableau ${tableLabel}`}
            onActivate={() => onAddColumn(-1)}
            icon={<Plus size={13} />}
            straddle="col"
          />
        </div>
        {columns.map(columnIndex => (
          <div key={`h${columnIndex}`} style={{ ...HANDLE_ROW, position: 'relative' }}>
            <TableHandle
              label={`Insérer une colonne après la colonne ${columnIndex + 1} du tableau ${tableLabel}`}
              onActivate={() => onAddColumn(columnIndex)}
              icon={<Plus size={12} />}
              straddle="col"
            />
            {canRemoveColumn && (
              // Centrée SUR la colonne, parce que c'est la colonne qu'elle
              // supprime — alors que le `+` reste sur la frontière, au bord droit.
              <span
                style={{
                  ...revealedTrash(active?.col === columnIndex),
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <TableHandle
                  destructive
                  label={`Supprimer la colonne ${columnIndex + 1} du tableau ${tableLabel}`}
                  onActivate={() => onRemoveColumn(columnIndex)}
                  icon={<Trash2 size={12} />}
                />
              </span>
            )}
          </div>
        ))}

        {/* The optional header row. Its gutter carries the boundary BEFORE the
            first row, for the same reason the corner above carries the one
            before the first column. `data-cell` `-1,c`: a column's cell like the
            others, but no body row's, so it never reveals a ROW bin by mistake. */}
        {renderHeader !== undefined && (
          <>
            <div style={HANDLE_ROW}>
              <TableHandle
                label={`Insérer une ligne avant la ligne 1 du tableau ${tableLabel}`}
                onActivate={() => onAddRow(-1)}
                icon={<Plus size={13} />}
                straddle="row"
              />
            </div>
            {columns.map(columnIndex => (
              <div key={`head${columnIndex}`} data-cell={`-1,${columnIndex}`} style={{ minWidth: 0 }}>
                {renderHeader(columnIndex)}
              </div>
            ))}
          </>
        )}

        {rows.map(rowIndex => (
          <TableGridRow
            key={rowIndex}
            tableLabel={tableLabel}
            rowIndex={rowIndex}
            columnCount={columnCount}
            // Without a header, the gutter of the first row also carries the
            // boundary BEFORE it.
            insertBefore={renderHeader === undefined && rowIndex === 0}
            canRemoveRow={canRemoveRow}
            revealTrash={active?.row === rowIndex}
            renderCell={renderCell}
            onAddRow={onAddRow}
            onRemoveRow={onRemoveRow}
          />
        ))}
      </div>
  )
}

/**
 * The strip a row's or a column's handles sit in.
 *
 * `flex-end` on both axes is what puts a handle ON the boundary it acts on
 * rather than in the middle of the cell it belongs to. A column handle inserts
 * AFTER its column, so it is aligned to that column's trailing edge, and a row
 * handle likewise to the row's bottom edge. Centred — which is what these were —
 * every one of them read as "insert here" while inserting half a cell away.
 *
 * The 6px `gap` and the opacity are accessibility rather than taste. These used
 * to be 18px targets at 42% opacity with the DESTRUCTIVE trash 1px from the `+`:
 * below the 24px of WCAG 2.5.8, hard to see, and a near-miss next to it deleted
 * a row or a column of the user's data.
 */
const HANDLE_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
  gap: 6,
  opacity: 0.72,
}

/** The grid's own `gap` (see `TableGrid`) — the boundary handles straddle it. */
const TABLE_GRID_GAP = 4

const HANDLE_SIZE = 22

/**
 * How far a boundary `+` must shift to sit ON the line it inserts at, instead
 * of hugging it from one side.
 *
 * `HANDLE_ROW` packs each `+` flush against the trailing edge of its own grid
 * cell — the same edge the neighbouring cell's border starts at — so at rest
 * the button's own right (or bottom) edge already sits exactly on the
 * boundary, with the whole 22px of it on the near side. Moving it by half its
 * OWN size is what centres it on that edge instead of hugging it; the extra
 * half of the grid's `gap` centres it on the thin seam between the two cells'
 * borders rather than on the inner one of the two.
 */
const HANDLE_STRADDLE = HANDLE_SIZE / 2 + TABLE_GRID_GAP / 2

const HANDLE_BUTTON: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  // Plus petits qu'avant (28 → 22) : la demande était explicite, et ils n'ont
  // plus besoin de porter deux boutons côte à côte puisque la poubelle est
  // maintenant révélée au survol de sa ligne ou de sa colonne.
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  padding: 0,
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'inherit',
  cursor: 'pointer',
}

/**
 * La poubelle d'une ligne ou d'une colonne, révélée au survol de cette ligne ou
 * de cette colonne — ou quand une de ses cellules a le focus.
 *
 * `opacity: 0` plutôt que `display: none`, et ce n'est pas un détail : un bouton
 * invisible reste FOCALISABLE, donc une suppression de ligne ou de colonne reste
 * possible au clavier. Le focus le révèle, donc l'utilisateur voit ce qu'il
 * s'apprête à déclencher. `pointerEvents` est ce qui empêche un clic de tomber
 * sur une poubelle qu'on ne voyait pas.
 */
function revealedTrash(revealed: boolean): CSSProperties {
  return {
    position: 'absolute',
    display: 'flex',
    opacity: revealed ? 1 : 0,
    pointerEvents: revealed ? 'auto' : 'none',
    transition: 'opacity 120ms ease-in-out',
  }
}

/**
 * Un `+` de frontière est **nu** : ni bordure ni fond au repos, juste le glyphe,
 * et il ne prend l'apparence d'un bouton qu'au survol ou au focus clavier (voir
 * `.table-handle`, dans `theme.css`). Le glyphe reste visible au repos — c'est la
 * *chrome* qui disparaît, pas le signe —, sinon la poignée deviendrait
 * introuvable, ce que l'audit reprochait déjà à l'opacité de 42 %.
 *
 * Seule la corbeille garde la sienne : elle est destructive, et elle ne doit
 * jamais pouvoir se confondre avec le `+` qui la jouxte.
 */
const BARE_HANDLE: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  padding: 0,
  borderRadius: 6,
  cursor: 'pointer',
  // `border` et `background` sont volontairement ABSENTS : écrits ici, ils
  // l'emporteraient sur la règle `:hover` de la classe — un style en ligne gagne
  // toujours contre une feuille de style — et le bouton ne pourrait plus jamais
  // apparaître.
}

/**
 * One `+` or trash on a table's row/column boundaries.
 *
 * The places that draw one — every column boundary, every row boundary, and the
 * two that insert BEFORE the first row and column — share a single target size
 * and a single naming scheme, which is exactly what drifted when each was a
 * hand-written button.
 */
function TableHandle({
  label,
  onActivate,
  destructive = false,
  icon,
  straddle,
}: {
  label: string
  onActivate: () => void
  destructive?: boolean
  icon: ReactNode
  /**
   * For a boundary `+` only: which line it straddles — `"col"` shifts it
   * right onto the vertical line after its column, `"row"` shifts it down
   * onto the horizontal line after its row. See `HANDLE_STRADDLE`.
   */
  straddle?: 'col' | 'row' | 'row-start'
}) {
  const straddleStyle: CSSProperties | undefined =
    straddle === 'col'
      ? { transform: `translateX(${HANDLE_STRADDLE}px)` }
      : straddle === 'row'
        ? { transform: `translateY(${HANDLE_STRADDLE}px)` }
        : straddle === 'row-start'
          ? // Headerless table: the boundary BEFORE the first row is its top edge.
            { transform: `translateY(${-HANDLE_STRADDLE}px)` }
          : undefined

  return (
    <Hint label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onActivate}
        // Le survol passe par une CLASSE, pas par un état React : il y a une
        // poignée par frontière, et un `useState` par poignée coûterait un rendu à
        // chaque déplacement de souris au-dessus d'un tableau.
        className={destructive ? undefined : 'table-handle'}
        style={{
          ...(destructive ? { ...HANDLE_BUTTON, color: 'var(--destructive)' } : BARE_HANDLE),
          ...straddleStyle,
        }}
      >
        {icon}
      </button>
    </Hint>
  )
}

function TableGridRow({
  tableLabel,
  rowIndex,
  columnCount,
  insertBefore,
  canRemoveRow,
  revealTrash,
  renderCell,
  onAddRow,
  onRemoveRow,
}: {
  tableLabel: string
  rowIndex: number
  columnCount: number
  insertBefore: boolean
  canRemoveRow: boolean
  /** Vrai quand une cellule de CETTE ligne est survolée ou a le focus. */
  revealTrash: boolean
  renderCell: (row: number, column: number) => ReactNode
  onAddRow: (after: number) => void
  onRemoveRow: (row: number) => void
}) {
  return (
    <>
      <div style={{ ...HANDLE_ROW, position: 'relative' }}>
        {insertBefore && (
          // Its OWN absolutely-positioned box on the top-right of the gutter,
          // straddling the top boundary: never a flex sibling of the row's
          // bin (left, x 0-22) nor of the after-+ (bottom-right), so on a
          // 28px row the three boxes stay apart (bin x 0-22, + x 30-52).
          <span data-testid="insert-before-first-row" style={{ position: 'absolute', top: 0, right: 0, display: 'flex' }}>
            <TableHandle
              label={`Insérer une ligne avant la ligne 1 du tableau ${tableLabel}`}
              onActivate={() => onAddRow(-1)}
              icon={<Plus size={13} />}
              straddle="row-start"
            />
          </span>
        )}
        <TableHandle
          label={`Insérer une ligne après la ligne ${rowIndex + 1} du tableau ${tableLabel}`}
          onActivate={() => onAddRow(rowIndex)}
          icon={<Plus size={12} />}
          straddle="row"
        />
        {canRemoveRow && (
          // Centrée SUR la ligne (verticalement) et collée au bord GAUCHE : c'est
          // ce qui la sépare du `+`, qui est au bord droit ET sur la frontière du
          // bas. Deux positions distinctes, donc aucun chevauchement même quand
          // la ligne est courte.
          <span
            style={{
              ...revealedTrash(revealTrash),
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <TableHandle
              destructive
              label={`Supprimer la ligne ${rowIndex + 1} du tableau ${tableLabel}`}
              onActivate={() => onRemoveRow(rowIndex)}
              icon={<Trash2 size={12} />}
            />
          </span>
        )}
      </div>

      {Array.from({ length: columnCount }, (_, columnIndex) => (
        <div key={columnIndex} data-cell={`${rowIndex},${columnIndex}`} style={{ minWidth: 0 }}>
          {renderCell(rowIndex, columnIndex)}
        </div>
      ))}
    </>
  )
}
