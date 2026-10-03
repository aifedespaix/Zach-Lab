import { useEffect, useMemo, useRef, useState } from 'react'
import { TableGrid, type BlockEdgeHandle } from '@suite/shared/equation'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@suite/shared/ui'
import { BlockCard } from './BlockCard'
import { BLOCK_META } from './blockMeta'
import { BlockContextMenu } from './BlockContextMenu'
import { CalcEditor } from './CalcEditor'
import { EmptyAreaContextMenu } from './EmptyAreaContextMenu'
import { EquationEditor, type SubBlockContext } from './EquationEditor'
import { FieldContextMenu } from './FieldContextMenu'
import { borderOf, toneOf } from './toolbarCatalog'
import {
  BLOCK_TYPES, newBlock, addColumn, addRow, convertBlock, duplicateBlock, insertBlockAfter, isKnown, moveBlock, parseBlocks,
  removeBlock, removeColumn, removeRow, setCell, updateBlock, type Block, type BlockType, type EquationBlock, type KnownBlock, type TableBlock, type TextBlock,
} from './blocks'

const field = 'rounded border bg-background px-2 py-1 text-sm'

function TextEditor({ block, onChange }: { block: TextBlock; onChange: (patch: Partial<TextBlock>) => void }) {
  return (
    <FieldContextMenu kind="text">
      <textarea
        aria-label="Texte"
        value={block.contenu}
        rows={Math.max(2, block.contenu.split('\n').length)}
        onChange={e => onChange({ contenu: e.target.value })}
        className={`${field} w-full`}
      />
    </FieldContextMenu>
  )
}

function TableEditor({ block, onChange, index }: { block: TableBlock; onChange: (patch: Partial<TableBlock>) => void; index: number }) {
  const cells = block.cellules
  const set = (next: string[][]) => onChange({ cellules: next })
  return (
    // `overflow-x: auto` forces `overflow-y: auto`, which would clip the « + »
    // after the last column / row: they straddle the grid's right and bottom
    // edges by 13px (TableGrid's HANDLE_STRADDLE). 14px keeps them inside.
    <div data-testid="table-scroll" style={{ overflowX: 'auto', paddingRight: 14, paddingBottom: 14 }}>
      <TableGrid
        tableLabel={String(index + 1)}
        rowCount={cells.length}
        columnCount={cells[0].length}
        renderCell={(r, c) => (
          <FieldContextMenu kind="text">
            <input
              aria-label={`Ligne ${r + 1}, colonne ${c + 1}`}
              value={cells[r][c]}
              onChange={e => set(setCell(cells, r, c, e.target.value))}
              className="w-full bg-background px-2 py-1 text-sm"
              style={{ border: '1px solid var(--border)' }}
            />
          </FieldContextMenu>
        )}
        onAddRow={after => set(addRow(cells, after))}
        onAddColumn={after => set(addColumn(cells, after))}
        onRemoveRow={row => set(removeRow(cells, row))}
        onRemoveColumn={column => set(removeColumn(cells, column))}
      />
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
export function BlockStack({ value, onChange, label = "Blocs de l'exercice", onSend, split = false, onToggleSplit, arrivedId = null }: {
  value: readonly unknown[]
  onChange: (blocs: Block[]) => void
  label?: string
  /** Présent quand l'exercice est scindé : envoie un bloc dans l'autre zone (câblé au clic droit). */
  onSend?: (id: string) => void
  /** L'exercice est-il scindé ? Dit au clic droit sur le vide s'il faut proposer de scinder ou de réunir. */
  split?: boolean
  /** Scinder ou réunir les zones ; absent, le clic droit sur le vide ne le propose pas. */
  onToggleSplit?: () => void
  /** Le bloc qui vient de l'autre zone : fondu d'entrée, halo et curseur. */
  arrivedId?: string | null
}) {
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
      <ul aria-label={label} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
