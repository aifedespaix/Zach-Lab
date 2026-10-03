import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@suite/shared/ui'
import { BlockCard } from './BlockCard'
import { BLOCK_META } from './blockMeta'
import { CalcEditor } from './CalcEditor'
import { EquationEditor } from './EquationEditor'
import { borderOf, toneOf } from './toolbarCatalog'
import {
  BLOCK_TYPES, newBlock, addColumn, addRow, canGrow, insertBlockAfter, isKnown, moveBlock, parseBlocks, removeBlock, removeColumn,
  removeRow, setCell, updateBlock, type Block, type BlockType, type EquationBlock, type KnownBlock, type TableBlock, type TextBlock,
} from './blocks'

const field = 'rounded border bg-background px-2 py-1 text-sm'

function TextEditor({ block, onChange }: { block: TextBlock; onChange: (patch: Partial<TextBlock>) => void }) {
  return (
    <textarea
      aria-label="Texte"
      value={block.contenu}
      rows={Math.max(2, block.contenu.split('\n').length)}
      onChange={e => onChange({ contenu: e.target.value })}
      className={`${field} w-full`}
    />
  )
}

function TableEditor({ block, onChange }: { block: TableBlock; onChange: (patch: Partial<TableBlock>) => void }) {
  const cells = block.cellules
  const set = (next: string[][]) => onChange({ cellules: next })
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {cells.map((row, r) => (
              <tr key={r}>
                {row.map((value, c) => (
                  <td key={c} style={{ border: '1px solid var(--border)', padding: 0 }}>
                    <input
                      aria-label={`Ligne ${r + 1}, colonne ${c + 1}`}
                      value={value}
                      onChange={e => set(setCell(cells, r, c, e.target.value))}
                      className="bg-background px-2 py-1 text-sm"
                      style={{ width: 90 }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        <Button variant="outline" size="xs" aria-label="Ajouter une ligne" disabled={!canGrow(cells, 'row')} onClick={() => set(addRow(cells))}><Plus />Ligne</Button>
        <Button variant="outline" size="xs" aria-label="Retirer la dernière ligne" disabled={cells.length <= 1} onClick={() => set(removeRow(cells, cells.length - 1))}><Minus />Ligne</Button>
        <Button variant="outline" size="xs" aria-label="Ajouter une colonne" disabled={!canGrow(cells, 'col')} onClick={() => set(addColumn(cells))}><Plus />Colonne</Button>
        <Button variant="outline" size="xs" aria-label="Retirer la dernière colonne" disabled={cells[0].length <= 1} onClick={() => set(removeColumn(cells, cells[0].length - 1))}><Minus />Colonne</Button>
      </div>
    </div>
  )
}

function editorFor(block: KnownBlock, onChange: (patch: Partial<KnownBlock>) => void, onDone: () => void) {
  switch (block.type) {
    case 'texte': return <TextEditor block={block} onChange={onChange} />
    case 'calcul': return <CalcEditor block={block} onChange={onChange} onDone={onDone} />
    case 'tableau': return <TableEditor block={block} onChange={onChange} />
    case 'equation': return <EquationEditor block={block} onChange={onChange as (patch: Partial<EquationBlock>) => void} />
  }
}

/** La pile de blocs de la zone de travail : chaque bloc se déplace d'un cran et se supprime, et les boutons d'ajout sont au bout. */
export function BlockStack({ value, onChange, label = "Blocs de l'exercice", arrivedId = null }: {
  value: readonly unknown[]
  onChange: (blocs: Block[]) => void
  label?: string
  /** Présent quand l'exercice est scindé : envoie un bloc dans l'autre zone (câblé au clic droit). */
  onSend?: (id: string) => void
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

  return (
    <div>
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
                ? editorFor(block, patch => onChange(updateBlock(blocks, block.id, patch)), () => insertAfter(block.id, 'calcul'))
                : <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Ce type de bloc n'est pas encore pris en charge ; il est conservé tel quel.</p>}
            </BlockCard>
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
  )
}
