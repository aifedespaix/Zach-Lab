import type { ReactNode } from 'react'
import { ArrowDown, ArrowLeftRight, ArrowUp, CopyPlus, Shapes, Trash2 } from 'lucide-react'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub,
  ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@suite/shared/ui'
import { BLOCK_TYPES, type BlockType } from './blocks'
import { BLOCK_META } from './blockMeta'

interface Props {
  index: number
  count: number
  /** `null` : bloc de type inconnu — conservé tel quel, donc ni converti ni modifié. */
  kind: BlockType | null
  onMove: (delta: -1 | 1) => void
  onDuplicate: () => void
  onRemove: () => void
  onChangeKind: (type: BlockType) => void
  /** Présent seulement quand l'exercice est scindé. */
  onSend?: () => void
  children: ReactNode
}

/**
 * Le clic droit d'un bloc (la carte, hors des champs : ceux-ci ont le leur). Il arrête l'évènement,
 * pour que le menu du vide qui entoure toute la pile ne s'ouvre pas en même temps.
 */
export function BlockContextMenu({ index, count, kind, onMove, onDuplicate, onRemove, onChangeKind, onSend, children }: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={e => e.stopPropagation()}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled={index === 0} onSelect={() => onMove(-1)}><ArrowUp size={14} />Monter</ContextMenuItem>
        <ContextMenuItem disabled={index === count - 1} onSelect={() => onMove(1)}><ArrowDown size={14} />Descendre</ContextMenuItem>
        <ContextMenuItem onSelect={onDuplicate}><CopyPlus size={14} />Dupliquer</ContextMenuItem>
        {kind !== null && (
          <ContextMenuSub>
            <ContextMenuSubTrigger><Shapes size={14} />Changer de type</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {BLOCK_TYPES.filter(t => t.type !== kind).map(({ type }) => {
                const { label, icon: Icon } = BLOCK_META[type]
                return <ContextMenuItem key={type} onSelect={() => onChangeKind(type)}><Icon size={14} />{label}</ContextMenuItem>
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {onSend !== undefined && <ContextMenuItem onSelect={onSend}><ArrowLeftRight size={14} />Envoyer dans l'autre zone</ContextMenuItem>}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onRemove}><Trash2 size={14} />Supprimer</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
