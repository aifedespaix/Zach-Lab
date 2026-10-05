import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../ui'
import { formatBinding } from './keys'
import { commandById } from './catalog'
import { runCommand, useBinding, useCommandEnabled, useCommandLabel } from './useCommand'

export interface CommandButtonProps {
  command: string
  icon: LucideIcon
  /** Overrides the catalogue label — the accessible name AND the tooltip. */
  label?: string
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  /** Shows the label beside the icon, for the few actions that deserve the width. */
  showLabel?: boolean
  /**
   * Animates the icon, for an action that is currently running. The label stays
   * the caller's business: it publishes the in-progress wording through
   * `useCommand`'s contextual label, so the button, the tooltip and the screen
   * reader all say the same thing.
   */
  spinning?: boolean
  /**
   * A second, muted line under the tooltip's label, for the LIVE STATE of the
   * action — « 3 cartes à envoyer · dernière synchro il y a 12 min ».
   *
   * Deliberately not folded into the label: the accessible name stays the
   * action's own name, which is what a screen reader should announce and what
   * the tests assert, whatever the state happens to be.
   */
  tooltipDetail?: string
  /**
   * Replaces the tooltip's first line (the accessible name stays the label), and drops the
   * shortcut: for a disabled button, whose useful message is why it is, not which key it has.
   */
  tooltipLabel?: string
  /** For a toggle: sets `aria-pressed`, so the state is announced and a stylesheet can hang on it. */
  pressed?: boolean
  /**
   * Extra classes for the button itself, for the few states the variants cannot
   * express — a locked padlock wearing the same colour as the rows it explains,
   * for instance. Last resort, not the way buttons are styled here.
   */
  className?: string
}

/**
 * A toolbar button for one command.
 *
 * The tooltip carries the shortcut, which is how a keyboard-driven app teaches
 * its own shortcuts: you reach for the button, and the tooltip tells you the
 * key you could have pressed instead. It is read from the live binding, so a
 * rebinding in the settings changes what every tooltip says.
 *
 * Disabled exactly when the command cannot run right now — no separate
 * availability logic per button, and no button that looks clickable and does
 * nothing.
 */
export function CommandButton({
  command,
  icon: Icon,
  label,
  variant = 'outline',
  size,
  showLabel = false,
  spinning = false,
  tooltipDetail,
  tooltipLabel,
  pressed,
  className,
}: CommandButtonProps) {
  const definition = commandById(command)
  const enabled = useCommandEnabled(command)
  const contextualLabel = useCommandLabel(command)
  const binding = useBinding(command)
  if (definition === undefined) return null

  const name = label ?? contextualLabel ?? definition.label
  const shortcut = tooltipLabel === undefined ? formatBinding(binding) : ''

  return (
    <Tooltip>
      {/* Un bouton désactivé ne reçoit aucun évènement du pointeur : le conteneur porte l'infobulle. */}
      <TooltipTrigger asChild>
        <span style={{ display: 'inline-flex' }}>
        <Button
          variant={variant}
          size={size ?? (showLabel ? 'default' : 'icon')}
          className={className}
          aria-label={name}
          aria-keyshortcuts={binding ?? undefined}
          aria-pressed={pressed}
          disabled={!enabled}
          onClick={() => runCommand(command)}
        >
          <Icon className={spinning ? 'animate-spin' : undefined} />
          {showLabel && <span>{name}</span>}
        </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className={tooltipDetail ? 'flex-col items-start gap-1' : undefined}>
        <span>
          {tooltipLabel ?? name}
          {shortcut && <span style={{ opacity: 0.7, marginLeft: 8 }}>{shortcut}</span>}
        </span>
        {tooltipDetail && <span style={{ opacity: 0.75 }}>{tooltipDetail}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
