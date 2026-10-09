import { CommandButton, type CommandButtonProps } from './CommandButton'
import { CommandDropdownItem, CommandMenuItem, type CommandMenuItemProps } from './CommandMenuItem'
import type { CommandDefinition } from './catalog'
import {
  runCommand,
  useBinding,
  useCommand,
  useCommandEnabled,
  useCommandLabel,
  useShortcutLabel,
} from './useCommand'

/**
 * The command entry points with the app's own ids as a compile-time union.
 *
 * The framework knows ids as plain strings; a mistyped one (`'card.edt'`) is a
 * menu entry that silently does nothing. An app calls this ONCE, in its
 * `commands.ts`, and imports the typed versions from there:
 *
 *     export const { useCommand, runCommand, CommandButton } = createTypedCommands<typeof COMMANDS>()
 *
 * `Aliases` adds the former ids the catalogue still answers to, so a module that
 * has not caught up with a rename still type-checks.
 */
export function createTypedCommands<
  Commands extends readonly Pick<CommandDefinition, 'id'>[],
  Aliases extends string = never,
>() {
  type Id = Commands[number]['id'] | Aliases

  return {
    useCommand: (id: Id, run: () => void, enabled?: boolean, label?: string) => useCommand(id, run, enabled, label),
    runCommand: (id: Id) => runCommand(id),
    useCommandEnabled: (id: Id) => useCommandEnabled(id),
    useCommandLabel: (id: Id) => useCommandLabel(id),
    useBinding: (id: Id) => useBinding(id),
    useShortcutLabel: (id: Id) => useShortcutLabel(id),
    CommandButton: (props: Omit<CommandButtonProps, 'command'> & { command: Id }) => <CommandButton {...props} />,
    CommandMenuItem: (props: Omit<CommandMenuItemProps, 'command'> & { command: Id }) => <CommandMenuItem {...props} />,
    CommandDropdownItem: (props: Omit<CommandMenuItemProps, 'command'> & { command: Id }) => (
      <CommandDropdownItem {...props} />
    ),
  }
}
