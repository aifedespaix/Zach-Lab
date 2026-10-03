import type { ReactNode } from 'react'
import { Columns2, Plus } from 'lucide-react'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@suite/shared/ui'
import { BLOCK_TYPES, type BlockType } from './blocks'
import { BLOCK_META } from './blockMeta'

/**
 * Le clic droit sur le vide d'une zone de travail (et dans une zone sans bloc) : ajouter un bloc,
 * scinder ou réunir les zones. C'est le niveau le plus extérieur ; bloc et champ l'arrêtent avant lui.
 */
export function EmptyAreaContextMenu({ onAdd, split, onToggleSplit, children }: {
  onAdd: (type: BlockType) => void
  split: boolean
  onToggleSplit?: () => void
  children: ReactNode
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {BLOCK_TYPES.map(({ type }) => {
          const { label, icon: Icon } = BLOCK_META[type]
          return (
            <ContextMenuItem key={type} onSelect={() => onAdd(type)}>
              <Plus size={14} /><Icon size={14} />Ajouter un bloc {label}
            </ContextMenuItem>
          )
        })}
        {onToggleSplit !== undefined && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onToggleSplit}>
              <Columns2 size={14} />{split ? 'Réunir les zones' : 'Scinder en deux zones'}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
