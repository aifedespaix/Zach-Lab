import { useEffect, useMemo, useRef } from 'react'
import { useCommandRegistry, type CommandRegistration } from './useCommandRegistry'
import { useShortcutSettingsStore } from './useShortcutSettingsStore'
import { formatBinding } from './keys'
import { resolveCommandId } from './catalog'

/**
 * Publishes `run` as the handler for `id` for as long as the component is
 * mounted.
 *
 * `run` is read through a ref, so a component may pass an inline arrow without
 * re-registering on every render — the registration only changes when the
 * command's availability (or its contextual label) actually changes.
 */
export function useCommand(rawId: string, run: () => void, enabled = true, label?: string): void {
  const id = resolveCommandId(rawId)
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    const registration: CommandRegistration = { run: () => runRef.current(), enabled, label }
    const { register, unregister } = useCommandRegistry.getState()
    register(id, registration)
    return () => unregister(id, registration)
  }, [id, enabled, label])
}

/** Whether the command can be run right now — what a menu entry disables itself on. */
export function useCommandEnabled(id: string): boolean {
  const current = resolveCommandId(id)
  return useCommandRegistry(state => state.registrations[current]?.enabled === true)
}

/** The contextual label a handler published, falling back to the catalogue's. */
export function useCommandLabel(id: string): string | undefined {
  const current = resolveCommandId(id)
  return useCommandRegistry(state => state.registrations[current]?.label)
}

/** Runs a command by id — the same entry point a keystroke, a menu and the palette all use. */
export function runCommand(id: string): boolean {
  return useCommandRegistry.getState().run(resolveCommandId(id))
}

/** The command's binding as configured, or `null` when it has none. */
export function useBinding(id: string): string | null {
  const current = resolveCommandId(id)
  return useShortcutSettingsStore(state => state.bindings[current] ?? null)
}

/** The binding spelled for a human — « Ctrl + Maj + Z » — or `''` when unbound. */
export function useShortcutLabel(id: string): string {
  const binding = useBinding(id)
  return useMemo(() => formatBinding(binding), [binding])
}
