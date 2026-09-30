import {
  CommandDropdownItem as SharedCommandDropdownItem,
  CommandMenuItem as SharedCommandMenuItem,
  type CommandMenuItemProps as SharedCommandMenuItemProps,
} from '@suite/shared/commands'
import type { CommandId } from '../../types/commands'

type CommandMenuItemProps = Omit<SharedCommandMenuItemProps, 'command'> & { command: CommandId }

/** The shared right-click menu entry, with the app's `CommandId` union on its `command` prop. */
export function CommandMenuItem(props: CommandMenuItemProps) {
  return <SharedCommandMenuItem {...props} />
}

/** The same entry for a dropdown menu. */
export function CommandDropdownItem(props: CommandMenuItemProps) {
  return <SharedCommandDropdownItem {...props} />
}
