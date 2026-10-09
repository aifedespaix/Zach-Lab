/**
 * The command catalogue every app of the suite registers once, at startup.
 *
 * Every action a user can trigger — from a keyboard shortcut, a context menu, a
 * toolbar button or the command palette — is declared ONCE in the app's
 * catalogue. Nothing else hard-codes a key combination or a menu label: the
 * toolbar reads its tooltip from `label`, menus read the shortcut hint from the
 * resolved binding, the settings panel lists the catalogue verbatim. Rebinding
 * a key in the settings changes the hint printed in every menu at the same
 * time, because they all read the same source.
 *
 * The framework (registry, shortcut settings, dispatcher, palette, settings
 * panel) is shared and knows nothing about what an app can do; this module is
 * how the app tells it. Ids are plain strings here — an app that wants a
 * compile-time union of its own ids (`CommandId`) derives it from its catalogue
 * and wraps the few entry points it cares about.
 */

import { isStandardCommandId } from './standard'

/**
 * Where a shortcut is allowed to fire.
 *
 * `global` works wherever focus happens to be; `canvas` only fires while the
 * app's main surface has focus (see `canvasSelector` in `useGlobalShortcuts`).
 * The distinction is what makes bare keys usable as shortcuts at all: `Entrée`
 * may create a sibling card on the canvas, but must still activate a focused
 * toolbar button, and `Suppr` must still delete a character in a rename field.
 */
export type CommandScope = 'global' | 'canvas'

export interface CommandDefinition {
  readonly id: string
  /** Imperative, in the app's language — this is the menu entry and the tooltip. */
  readonly label: string
  /** One sentence, shown in the settings list and the palette. Never repeats the label. */
  readonly description: string
  /** One of the catalogue's `categories` ids. */
  readonly category: string
  /** `null` means "no key by default" — the action exists, the user may bind it. */
  readonly defaultBinding: string | null
  /**
   * Extra, non-editable bindings that always work alongside the configured
   * one. Only for genuine synonyms every app accepts (`Ctrl+Y` for redo).
   */
  readonly aliases?: readonly string[]
  /** Fires even while a text field has focus — `Ctrl+S` must, `Ctrl+Z` must not. */
  readonly allowInEditable?: boolean
  /**
   * Fires while the app is suspended (see `isSuspended` in `useGlobalShortcuts`
   * — a quiz in progress, for instance). Almost nothing does.
   */
  readonly allowWhenSuspended?: boolean
  /** Skipped when the user has an actual text selection — the clipboard trio. */
  readonly skipWhenTextSelected?: boolean
  readonly scope?: CommandScope
  /** Rendered in red in menus, given no default binding: it deletes something. */
  readonly destructive?: boolean
}

export interface CommandCategoryDef {
  readonly id: string
  readonly label: string
}

export interface CommandCatalog {
  /** The groups the settings tab and the palette show, in display order. */
  readonly categories: readonly CommandCategoryDef[]
  readonly commands: readonly CommandDefinition[]
  /**
   * Former ids of renamed commands: `oldId → newId`. An old id keeps working
   * everywhere an id is read (`commandById`, `runCommand`, `useCommand`,
   * `useBinding`, an old `shortcuts.json`) and resolves to the new command, so
   * renaming a command never loses a shortcut a student customised. Not to be
   * confused with `CommandDefinition.aliases`, which are extra KEYS.
   */
  readonly aliases?: Readonly<Record<string, string>>
}

const EMPTY: CommandCatalog = { categories: [], commands: [] }

let catalog: CommandCatalog = EMPTY
// A Map, never a plain object: `commands['constructor']` on an object is a
// function, and would read as a command that exists.
let byId = new Map<string, CommandDefinition>()
let idAliases = new Map<string, string>()
const listeners = new Set<() => void>()

/**
 * Registers the app's catalogue, replacing any previous one.
 *
 * Throws on a duplicated id rather than letting the second entry silently
 * shadow the first: two commands with one id would make one of them
 * unreachable, and nothing would say so.
 */
export function defineCommandCatalog(next: CommandCatalog): void {
  const seen = new Map<string, CommandDefinition>()
  for (const command of next.commands) {
    if (seen.has(command.id)) throw new Error(`Commande déclarée deux fois : « ${command.id} »`)
    seen.set(command.id, command)
  }
  const aliases = new Map<string, string>()
  for (const [oldId, newId] of Object.entries(next.aliases ?? {})) {
    if (seen.has(oldId)) throw new Error(`Alias « ${oldId} » : c'est aussi l'id d'une commande`)
    if (!seen.has(newId)) throw new Error(`Alias « ${oldId} » : la commande « ${newId} » n'existe pas`)
    aliases.set(oldId, newId)
  }
  if (import.meta.env?.DEV !== false) assertStandardBindingsFree(next.commands)
  catalog = next
  byId = seen
  idAliases = aliases
  for (const listener of [...listeners]) listener()
}

/** Back to an empty catalogue. For tests. */
export function resetCommandCatalog(): void {
  defineCommandCatalog(EMPTY)
}

/**
 * Calls `listener` whenever a catalogue is (re)registered. The shortcut store
 * uses it to recompute its bindings: it is created when its module loads,
 * which can be before the app has registered anything.
 */
export function subscribeCatalog(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function commandList(): readonly CommandDefinition[] {
  return catalog.commands
}

/** The current id of a command: `id` itself, or the command a former id was renamed to. */
export function resolveCommandId(id: string): string {
  return idAliases.get(id) ?? id
}

/** The former ids the catalogue still answers to, `oldId → newId`. */
export function commandIdAliases(): ReadonlyMap<string, string> {
  return idAliases
}

export function commandById(id: string): CommandDefinition | undefined {
  return byId.get(resolveCommandId(id))
}

/** Whether `id` is one of the catalogue's commands, under its current id or a former one. */
export function isCommandId(id: string): boolean {
  return byId.has(resolveCommandId(id))
}

/** The default binding of every command, `null` for the ones that ship unbound. */
export function defaultBindings(): Record<string, string | null> {
  return Object.fromEntries(catalog.commands.map(command => [command.id, command.defaultBinding]))
}

/** The commands of each declared category, in display order; empty categories are left out. */
export function commandsByCategory(): { category: string; commands: CommandDefinition[] }[] {
  return catalog.categories
    .map(category => ({
      category: category.id,
      commands: catalog.commands.filter(command => command.category === category.id),
    }))
    .filter(group => group.commands.length > 0)
}

/** A category's label; its id when the catalogue does not declare it. */
export function categoryLabel(id: string): string {
  return catalog.categories.find(category => category.id === id)?.label ?? id
}

/**
 * A standard command may not share its default key with another command of
 * the same scope: the app would silently lose one of the two. Checked while
 * developing only — it is a mistake in the catalogue, not something a user
 * can cause.
 */
function assertStandardBindingsFree(commands: readonly CommandDefinition[]): void {
  const holders = new Map<string, CommandDefinition>()
  for (const command of commands) {
    if (command.defaultBinding === null) continue
    const slot = `${command.scope ?? 'global'}|${command.defaultBinding}`
    const other = holders.get(slot)
    if (other !== undefined && (isStandardCommandId(other.id) || isStandardCommandId(command.id))) {
      throw new Error(
        `Raccourci ${command.defaultBinding} pris deux fois : « ${other.id} » et « ${command.id} » (l'une est une commande standard)`,
      )
    }
    holders.set(slot, command)
  }
}
