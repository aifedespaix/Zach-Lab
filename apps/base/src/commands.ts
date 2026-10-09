import { defineCommandCatalog, standardCommands, STANDARD_CATEGORIES, createTypedCommands } from '@suite/shared/commands'

/**
 * What this app can do, declared once: the toolbar, the palette and the
 * shortcuts panel all read it. Pick the standard commands the app has, add its
 * own beside them (a `category` must be one of `categories`), and register their
 * handlers with `useCommand`.
 */
export const COMMANDS = [
  ...standardCommands(['app.palette', 'app.settings', 'app.shortcuts', 'app.toggleTheme', 'file.new', 'file.close', 'file.save', 'edit.undo', 'edit.redo', 'view.zoomOut', 'view.zoomIn', 'view.zoomReset', 'view.toggleDensity']),
] as const

export type CommandId = (typeof COMMANDS)[number]['id']

defineCommandCatalog({ categories: [...STANDARD_CATEGORIES], commands: COMMANDS })

export const { useCommand, CommandButton } = createTypedCommands<typeof COMMANDS>()
