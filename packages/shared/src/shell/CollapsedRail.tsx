import type { ComponentProps, ReactNode } from 'react'
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react'
import { CommandButton, formatBinding, runCommand, useBinding } from '../commands'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui'
import type { PanelSide } from './usePanelResize'

interface CollapsedRailProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** The edge of the window the folded panel sits against. */
  side: PanelSide
  /** The command that unfolds the panel: its shortcut shows in the tooltip. */
  command: string
  /** The button's accessible name, e.g. « Déplier le panneau des fiches ». */
  label: string
  /**
   * Text of the folded panel, written vertically. Given, the whole rail is ONE button that unfolds the
   * panel; absent, the rail is a bare strip holding a small unfold button.
   */
  children?: ReactNode
  /**
   * Small buttons the folded panel keeps within reach, stacked and centred in the strip; the unfold
   * button stays at the bottom. Wins over `children`.
   */
  actions?: ReactNode
}

/**
 * The strip a folded side panel leaves behind.
 *
 * Without `children`: 32px, one button, bottom-aligned so folding and unfolding does not make the
 * control jump to another corner of the screen. With `children`: the strip itself is the button, full
 * height, its text turned 90° and centred; it stays on one line and only wraps into a second column
 * when the height runs out. Extra props go to the strip, so an app can hang a `data-testid` on it.
 */
export function CollapsedRail({ side, command, label, children, actions, style, ...rest }: CollapsedRailProps) {
  const binding = useBinding(command)
  const Icon = side === 'left' ? PanelLeftOpen : PanelRightOpen
  const edge = side === 'left' ? { borderRight: '1px solid var(--border)' } : { borderLeft: '1px solid var(--border)' }

  if (actions !== undefined) {
    return (
      <div
        {...rest}
        style={{ width: 40, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 8, ...edge, ...style }}
      >
        <div role="group" aria-label={label} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {actions}
        </div>
        <CommandButton command={command} icon={Icon} label={label} variant="ghost" size="icon-sm" />
      </div>
    )
  }

  if (children === undefined) {
    return (
      <div
        {...rest}
        style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 8, ...edge, ...style }}
      >
        <CommandButton command={command} icon={Icon} label={label} variant="ghost" size="icon-sm" />
      </div>
    )
  }

  const shortcut = formatBinding(binding)
  return (
    <div {...rest} style={{ flex: 1, display: 'flex', minWidth: 0, ...style }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            aria-keyshortcuts={binding ?? undefined}
            onClick={() => runCommand(command)}
            className="hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer', transition: 'background-color 120ms ease' }}
          >
            <span
              style={{
                flex: 1,
                minHeight: 0,
                maxWidth: '100%',
                writingMode: 'vertical-rl',
                // Left rail reads bottom-to-top, right rail top-to-bottom.
                transform: side === 'left' ? 'rotate(180deg)' : undefined,
                // Centred along the line (the vertical axis) and between the lines.
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                lineHeight: 1.3,
                overflow: 'hidden',
              }}
            >
              <span>{children}</span>
            </span>
            <Icon size={16} aria-hidden style={{ flexShrink: 0 }} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side === 'left' ? 'right' : 'left'}>
          <span>
            {label}
            {shortcut && <span style={{ opacity: 0.7, marginLeft: 8 }}>{shortcut}</span>}
          </span>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
