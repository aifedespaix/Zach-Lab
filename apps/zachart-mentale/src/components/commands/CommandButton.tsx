import {
  CommandButton as SharedCommandButton,
  type CommandButtonProps as SharedCommandButtonProps,
} from '@suite/shared/commands'
import type { CommandId } from '../../types/commands'

type CommandButtonProps = Omit<SharedCommandButtonProps, 'command'> & { command: CommandId }

/** The shared toolbar button, with the app's `CommandId` union on its `command` prop. */
export function CommandButton(props: CommandButtonProps) {
  return <SharedCommandButton {...props} />
}
