import type { ComponentProps } from 'react'
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react'
import { CommandButton } from '../commands'
import type { PanelSide } from './usePanelResize'

interface CollapsedRailProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** The edge of the window the folded panel sits against. */
  side: PanelSide
  /** The command that unfolds the panel: its shortcut shows in the tooltip. */
  command: string
  /** The button's accessible name, e.g. « Déplier le panneau des fiches ». */
  label: string
}

/**
 * The 32px strip a folded side panel leaves behind: one button that unfolds it.
 *
 * Bottom-aligned so folding and unfolding does not make the control jump to another corner of
 * the screen. Extra props go to the strip itself, so an app can hang a `data-testid` on it.
 */
export function CollapsedRail({ side, command, label, style, ...rest }: CollapsedRailProps) {
  return (
    <div
      {...rest}
      style={{
        width: 32,
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingBottom: 8,
        ...(side === 'left' ? { borderRight: '1px solid var(--border)' } : { borderLeft: '1px solid var(--border)' }),
        ...style,
      }}
    >
      <CommandButton command={command} icon={side === 'left' ? PanelLeftOpen : PanelRightOpen} label={label} variant="ghost" size="icon-sm" />
    </div>
  )
}
