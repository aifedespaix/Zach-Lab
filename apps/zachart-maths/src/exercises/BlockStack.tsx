import { useMemo, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@suite/shared/ui'
import { EquationEditor } from './EquationEditor'
import {
  BLOCK_TYPES, addBlock, addColumn, addRow, canGrow, isKnown, moveBlock, parseBlocks, removeBlock, removeColumn,
  removeRow, setCell, updateBlock, type Block, type CalcBlock, type EquationBlock, type KnownBlock, type TableBlock, type TextBlock,
} from './blocks'

const field = 'rounded border bg-background px-2 py-1 text-sm'
const LABELS: Record<string, string> = Object.fromEntries(BLOCK_TYPES.map(t => [t.type, t.label]))

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

function CalcEditor({ block, onChange }: { block: CalcBlock; onChange: (patch: Partial<CalcBlock>) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        aria-label="Calcul"
        value={block.expression}
        onChange={e => onChange({ expression: e.target.value })}
        className={`${field} flex-1 font-mono`}
      />
      <span aria-hidden>=</span>
      <input
        aria-label="Résultat du calcul"
        value={block.resultat}
        onChange={e => onChange({ resultat: e.target.value })}
        className={`${field} font-mono`}
        style={{ width: 120 }}
      />
    </div>
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

function BlockCard({ block, index, count, onMove, onRemove, children }: {
  block: Block
  index: number
  count: number
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  children: ReactNode
}) {
  const label = LABELS[block.type] ?? 'Bloc inconnu'
  return (
    <li>
      <section aria-label={`Bloc ${label}, ${index + 1} sur ${count}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <strong style={{ fontSize: 12 }}>{label}</strong>
          <div style={{ display: 'flex', gap: 2 }}>
            <Button variant="ghost" size="icon-sm" aria-label="Monter le bloc" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Descendre le bloc" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Supprimer le bloc" onClick={onRemove}><Trash2 /></Button>
          </div>
        </div>
        {children}
      </section>
    </li>
  )
}

function editorFor(block: KnownBlock, onChange: (patch: Partial<KnownBlock>) => void) {
  switch (block.type) {
    case 'texte': return <TextEditor block={block} onChange={onChange} />
    case 'calcul': return <CalcEditor block={block} onChange={onChange} />
    case 'tableau': return <TableEditor block={block} onChange={onChange} />
    case 'equation': return <EquationEditor block={block} onChange={onChange as (patch: Partial<EquationBlock>) => void} />
  }
}

/** La pile de blocs de la zone de travail : chaque bloc se déplace d'un cran et se supprime. */
export function BlockStack({ value, onChange, showAddButtons = true }: {
  value: readonly unknown[]
  onChange: (blocs: Block[]) => void
  /** Les boutons « + Texte »… sous la pile ; faux quand la barre d'outils les porte déjà. */
  showAddButtons?: boolean
}) {
  const blocks = useMemo(() => parseBlocks(value), [value])
  return (
    <div>
      <ul aria-label="Blocs de l'exercice" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {blocks.map((block, i) => (
          <BlockCard
            key={block.id}
            block={block}
            index={i}
            count={blocks.length}
            onMove={delta => onChange(moveBlock(blocks, block.id, delta))}
            onRemove={() => onChange(removeBlock(blocks, block.id))}
          >
            {isKnown(block)
              ? editorFor(block, patch => onChange(updateBlock(blocks, block.id, patch)))
              : <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Ce type de bloc n'est pas encore pris en charge ; il est conservé tel quel.</p>}
          </BlockCard>
        ))}
      </ul>

      {blocks.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Aucun bloc. Ajoute-en un pour commencer.</p>
      )}
      {showAddButtons && <div role="group" aria-label="Ajouter un bloc" style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {BLOCK_TYPES.map(({ type, label }) => (
          <Button key={type} variant="outline" size="sm" onClick={() => onChange(addBlock(blocks, type))}>
            <Plus />{label}
          </Button>
        ))}
      </div>}
    </div>
  )
}
