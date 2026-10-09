import { afterEach, describe, expect, it } from 'vitest'
import { defineCommandCatalog, resetCommandCatalog } from './catalog'
import { STANDARD_CATEGORIES, STANDARD_COMMAND_IDS, standardCommands } from './standard'

afterEach(() => resetCommandCatalog())

describe('commandes standard', () => {
  it('chaque id a une catégorie standard, un libellé et une description', () => {
    const categories = new Set(STANDARD_CATEGORIES.map(category => category.id))
    for (const command of standardCommands(STANDARD_COMMAND_IDS)) {
      expect(categories.has(command.category), command.id).toBe(true)
      expect(command.label.length, command.id).toBeGreaterThan(0)
      expect(command.description.length, command.id).toBeGreaterThan(0)
    }
  })

  it('aucun raccourci par défaut n\'est pris deux fois parmi les standards', () => {
    expect(() =>
      defineCommandCatalog({ categories: [...STANDARD_CATEGORIES], commands: standardCommands(STANDARD_COMMAND_IDS) }),
    ).not.toThrow()
  })

  it('suit l\'ordre demandé et accepte une surcharge de libellé et de touche', () => {
    const [close, save] = standardCommands(['file.close', 'file.save'], {
      'file.close': { label: 'Fermer la fiche', defaultBinding: null },
    })
    expect(close).toMatchObject({ id: 'file.close', label: 'Fermer la fiche', defaultBinding: null })
    expect(save.id).toBe('file.save')
    expect(save.allowInEditable).toBe(true)
  })

  it('refuse un id qui n\'est pas standard', () => {
    expect(() => standardCommands(['file.nope' as 'file.new'])).toThrow(/inconnue/)
  })

  it('signale en développement une commande de l\'app qui prend la touche d\'un standard', () => {
    expect(() =>
      defineCommandCatalog({
        categories: [...STANDARD_CATEGORIES],
        commands: [
          ...standardCommands(['file.new']),
          { id: 'card.add', label: 'Ajouter', description: 'Ajoute.', category: 'file', defaultBinding: 'Mod+N' },
        ],
      }),
    ).toThrow(/Mod\+N/)
  })

  it('tolère la même touche dans deux portées différentes', () => {
    expect(() =>
      defineCommandCatalog({
        categories: [...STANDARD_CATEGORIES],
        commands: [
          ...standardCommands(['file.new']),
          { id: 'card.add', label: 'Ajouter', description: 'Ajoute.', category: 'file', defaultBinding: 'Mod+N', scope: 'canvas' },
        ],
      }),
    ).not.toThrow()
  })
})
