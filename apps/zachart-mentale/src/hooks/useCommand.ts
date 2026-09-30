import {
  runCommand as runSharedCommand,
  useBinding as useSharedBinding,
  useCommand as useSharedCommand,
  useCommandEnabled as useSharedCommandEnabled,
  useCommandLabel as useSharedCommandLabel,
  useShortcutLabel as useSharedShortcutLabel,
} from '@suite/shared/commands'
import type { CommandId } from '../types/commands'

/*
 * The command framework is shared and knows ids only as strings. These wrappers
 * put the app's `CommandId` union back on every entry point, so a mistyped id
 * (`'card.edt'`) is still a compile error here rather than a menu entry that
 * silently never does anything.
 */

/**
 * Publishes `run` as the handler for `id` for as long as the component is
 * mounted. See the shared `useCommand`.
 */
export function useCommand(id: CommandId, run: () => void, enabled = true, label?: string): void {
  useSharedCommand(id, run, enabled, label)
}

/** Whether the command can be run right now — what a menu entry disables itself on. */
export function useCommandEnabled(id: CommandId): boolean {
  return useSharedCommandEnabled(id)
}

/** The contextual label a handler published, falling back to the catalogue's. */
export function useCommandLabel(id: CommandId): string | undefined {
  return useSharedCommandLabel(id)
}

/** Runs a command by id — the same entry point a keystroke, a menu and the palette all use. */
export function runCommand(id: CommandId): boolean {
  return runSharedCommand(id)
}

/** The command's binding as configured, or `null` when it has none. */
export function useBinding(id: CommandId): string | null {
  return useSharedBinding(id)
}

/** The binding spelled for a human — « Ctrl + Maj + Z » — or `''` when unbound. */
export function useShortcutLabel(id: CommandId): string {
  return useSharedShortcutLabel(id)
}
