import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  categoryLabel,
  commandById,
  commandList,
  commandsByCategory,
  defaultBindings,
  defineCommandCatalog,
  isCommandId,
  resetCommandCatalog,
  subscribeCatalog,
  type CommandCatalog,
} from './catalog'

const CATALOG: CommandCatalog = {
  categories: [
    { id: 'file', label: 'Fichier' },
    { id: 'edit', label: 'Édition' },
  ],
  commands: [
    { id: 'file.open', label: 'Ouvrir', description: 'Ouvre un fichier.', category: 'file', defaultBinding: 'Mod+O' },
    { id: 'edit.undo', label: 'Annuler', description: 'Annule.', category: 'edit', defaultBinding: 'Mod+Z', aliases: ['Mod+Y'] },
    { id: 'file.close', label: 'Fermer', description: 'Ferme.', category: 'file', defaultBinding: null },
  ],
}

afterEach(() => resetCommandCatalog())

describe('catalogue de commandes', () => {
  it('est vide tant que l\'app n\'a rien enregistré (une app sans commande démarre)', () => {
    expect(commandList()).toEqual([])
    expect(commandById('file.open')).toBeUndefined()
    expect(isCommandId('file.open')).toBe(false)
    expect(defaultBindings()).toEqual({})
    expect(commandsByCategory()).toEqual([])
  })

  it('retrouve une commande par son id', () => {
    defineCommandCatalog(CATALOG)
    expect(commandById('edit.undo')?.label).toBe('Annuler')
    expect(isCommandId('edit.undo')).toBe(true)
    expect(isCommandId('edit.nope')).toBe(false)
  })

  it('n\'hérite pas des propriétés d\'Object pour un id (constructor, __proto__, toString)', () => {
    defineCommandCatalog(CATALOG)
    for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(isCommandId(id)).toBe(false)
      expect(commandById(id)).toBeUndefined()
    }
  })

  it('donne le binding par défaut de chaque commande, null compris', () => {
    defineCommandCatalog(CATALOG)
    expect(defaultBindings()).toEqual({ 'file.open': 'Mod+O', 'edit.undo': 'Mod+Z', 'file.close': null })
  })

  it('regroupe par catégorie dans l\'ordre déclaré, en omettant les catégories vides', () => {
    defineCommandCatalog({ ...CATALOG, categories: [...CATALOG.categories, { id: 'view', label: 'Affichage' }] })
    const groups = commandsByCategory()
    expect(groups.map(group => group.category)).toEqual(['file', 'edit'])
    expect(groups[0].commands.map(command => command.id)).toEqual(['file.open', 'file.close'])
  })

  it('libelle une catégorie, et retombe sur son id si elle n\'est pas déclarée', () => {
    defineCommandCatalog(CATALOG)
    expect(categoryLabel('edit')).toBe('Édition')
    expect(categoryLabel('inconnue')).toBe('inconnue')
  })

  it('refuse deux commandes de même id (le second écraserait le premier sans un mot)', () => {
    expect(() =>
      defineCommandCatalog({
        ...CATALOG,
        commands: [...CATALOG.commands, { ...CATALOG.commands[0] }],
      }),
    ).toThrow(/file\.open/)
  })

  it('prévient les abonnés à chaque enregistrement, et plus après désabonnement', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeCatalog(listener)
    defineCommandCatalog(CATALOG)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    defineCommandCatalog(CATALOG)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('réenregistrer remplace le catalogue précédent', () => {
    defineCommandCatalog(CATALOG)
    defineCommandCatalog({ categories: [], commands: [] })
    expect(commandList()).toEqual([])
  })
})
