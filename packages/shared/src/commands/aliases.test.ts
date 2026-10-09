import { afterEach, describe, expect, it } from 'vitest'
import { useCommandRegistry } from './useCommandRegistry'
import {
  commandById,
  commandIdAliases,
  defineCommandCatalog,
  isCommandId,
  resetCommandCatalog,
  resolveCommandId,
  type CommandDefinition,
} from './catalog'
import { runCommand } from './useCommand'
import { sanitizeShortcutSettings } from './shortcutSettingsPersistence'

const def = (id: string, defaultBinding: string | null = null): CommandDefinition => ({
  id,
  label: id,
  description: `Description de ${id}.`,
  category: 'file',
  defaultBinding,
})

const CATALOG = {
  categories: [{ id: 'file', label: 'Fichier' }],
  commands: [def('file.new', 'Mod+N'), def('view.toggleLeftPanel', 'Mod+B')],
  aliases: { 'sheet.new': 'file.new', 'view.toggleTree': 'view.toggleLeftPanel' },
}

afterEach(() => {
  resetCommandCatalog()
  useCommandRegistry.setState({ registrations: {} })
})

describe('alias d\'identifiants de commande', () => {
  it('chaque ancien id désigne la même commande que le nouveau', () => {
    defineCommandCatalog(CATALOG)
    for (const [oldId, newId] of commandIdAliases()) {
      expect(commandById(oldId)).toBe(commandById(newId))
      expect(isCommandId(oldId)).toBe(true)
      expect(resolveCommandId(oldId)).toBe(newId)
    }
    expect(commandIdAliases().size).toBe(2)
  })

  it('lance le gestionnaire du nouvel id quand on appelle l\'ancien', () => {
    defineCommandCatalog(CATALOG)
    let calls = 0
    useCommandRegistry.getState().register('file.new', { run: () => calls++, enabled: true })
    expect(runCommand('sheet.new')).toBe(true)
    expect(calls).toBe(1)
  })

  it('refuse un alias vers une commande inconnue ou qui est déjà une commande', () => {
    expect(() => defineCommandCatalog({ ...CATALOG, aliases: { 'a.b': 'nope' } })).toThrow(/n'existe pas/)
    expect(() => defineCommandCatalog({ ...CATALOG, aliases: { 'file.new': 'view.toggleLeftPanel' } })).toThrow(
      /aussi l'id/,
    )
  })

  it('relit un ancien shortcuts.json : les ids renommés sont réécrits, rien n\'est perdu', () => {
    defineCommandCatalog(CATALOG)
    const old = { bindings: { 'sheet.new': 'ctrl+alt+n', 'view.toggleTree': null, 'file.new': 'Mod+Shift+N', 'gone.cmd': 'Mod+G' } }
    const settings = sanitizeShortcutSettings(old)
    // Le nouvel id gagne s'il est déjà dans le fichier ; l'ancien, seul, est migré.
    expect(settings.bindings['file.new']).toBe('Mod+Shift+N')
    expect(settings.bindings['view.toggleLeftPanel']).toBeNull()
    expect(settings.bindings).not.toHaveProperty('sheet.new')
    expect(settings.bindings).not.toHaveProperty('gone.cmd')
  })

  it('migre un raccourci personnalisé enregistré sous l\'ancien id', () => {
    defineCommandCatalog(CATALOG)
    const settings = sanitizeShortcutSettings({ bindings: { 'sheet.new': 'Mod+Shift+J' } })
    expect(settings.bindings).toEqual({ 'file.new': 'Mod+Shift+J' })
  })
})
