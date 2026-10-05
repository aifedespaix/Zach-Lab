import { spacing, useCompact } from './useCompact'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, HelpCircle, Trash2 } from 'lucide-react'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@suite/shared/ui'
import { isKnown, type Block } from './blocks'
import { BLOCK_META } from './blockMeta'
import { borderOf, toneOf } from './toolbarCatalog'

interface BlockCardProps {
  block: Block
  index: number
  count: number
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  /** Présent quand l'exercice est scindé : envoie le bloc dans l'autre zone, `sendTo` dit de quel côté elle est. */
  onSend?: () => void
  sendTo?: 'left' | 'right'
  /** Vrai juste après un déplacement : le halo aide à retrouver le bloc du regard. */
  halo?: boolean
  onHaloEnd?: () => void
  children: ReactNode
}

/**
 * Une carte de bloc : la gouttière à gauche (l'icône du type, qui ouvre le menu : monter, descendre, changer de zone, supprimer) puis
 * le contenu. La gouttière est discrète tant qu'on ne survole ni ne focalise la carte.
 */
export function BlockCard({ block, index, count, onMove, onRemove, onSend, sendTo = 'right', halo, onHaloEnd, children }: BlockCardProps) {
  const compact = useCompact(state => state.enabled)
  const meta = isKnown(block) ? BLOCK_META[block.type] : null
  const label = meta?.label ?? 'Bloc inconnu'
  const Icon = meta?.icon ?? HelpCircle
  const hue = meta?.hue ?? 0
  return (
    <section
      aria-label={`Bloc ${label}, ${index + 1} sur ${count}`}
      data-block-id={block.id}
      className={`group/card${halo === true ? ' block-halo' : ''}`}
      onAnimationEnd={e => { if (e.target === e.currentTarget) onHaloEnd?.() }}
      style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}
    >
      <div
        role="group"
        aria-label="Actions du bloc"
        className="opacity-60 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 4, background: toneOf(hue), borderRight: `2px solid ${borderOf(hue)}` }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions du bloc ${label}`} title={`${label} — actions`}><Icon /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}><ArrowUp size={14} />Monter</DropdownMenuItem>
            <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(1)}><ArrowDown size={14} />Descendre</DropdownMenuItem>
            {onSend !== undefined && (
              <DropdownMenuItem onSelect={onSend}>
                {sendTo === 'right' ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
                {sendTo === 'right' ? 'Envoyer à droite' : 'Envoyer à gauche'}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={onRemove}><Trash2 size={14} />Supprimer</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: spacing(compact).cardPad }}>{children}</div>
    </section>
  )
}
