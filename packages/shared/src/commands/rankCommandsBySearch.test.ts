import { afterEach, describe, expect, it } from 'vitest'
import { defineCommandCatalog, resetCommandCatalog, type CommandDefinition } from './catalog'
import { rankCommandsBySearch } from './rankCommandsBySearch'

const rename: CommandDefinition = { id: 'edit.rename', label: 'Renommer', description: 'Change le nom de la carte.', category: 'edit', defaultBinding: 'F2' }
const remove: CommandDefinition = { id: 'edit.delete', label: 'Supprimer la carte', description: 'Retire la carte et ses enfants, après confirmation.', category: 'edit', defaultBinding: null }
const zoom: CommandDefinition = { id: 'view.zoom', label: 'Zoom avant', description: 'Rapproche la vue.', category: 'view', defaultBinding: null }
const floating: CommandDefinition = { id: 'card.addFloating', label: 'Ajouter une carte flottante', description: 'Crée une carte libre sur le canevas.', category: 'card', defaultBinding: null }
const ALL = [rename, remove, zoom, floating]

afterEach(() => resetCommandCatalog())

/** Ids in the order the palette would list them (best match first). */
function ids(query: string, commands: readonly CommandDefinition[] = ALL): string[] {
  return rankCommandsBySearch(query, commands)
    .sort((a, b) => a.score - b.score)
    .map(entry => entry.command.id)
}

describe('rankCommandsBySearch', () => {
  it('renvoie toutes les commandes pour une requête vide ou blanche, comme la palette qui vient de s\'ouvrir', () => {
    expect(ids('')).toHaveLength(4)
    expect(ids('   ')).toHaveLength(4)
  })

  it('ne renvoie rien quand rien ne correspond', () => {
    expect(ids('xyzzy')).toEqual([])
  })

  it('ignore les accents et la casse, dans la requête comme dans le texte', () => {
    expect(ids('RENOMMER')).toEqual(['edit.rename'])
    expect(ids('supprimér')[0]).toBe('edit.delete')
    expect(ids('creer')[0]).toBe('card.addFloating')
  })

  it('trouve une commande avec une requête de plusieurs mots', () => {
    expect(ids('creer une carte')).toContain('card.addFloating')
  })

  it('classe une correspondance dans le libellé avant une correspondance dans la description', () => {
    // « confirmation » n'est que dans la description de « Supprimer ».
    // « carte » est dans le libellé de « Supprimer la carte » et de « Ajouter une carte flottante »,
    // et seulement dans la description de « Renommer ».
    const order = ids('carte')
    expect(order.indexOf('edit.rename')).toBeGreaterThan(order.indexOf('edit.delete'))
    expect(order.indexOf('edit.rename')).toBeGreaterThan(order.indexOf('card.addFloating'))
  })

  it('un nom exact passe devant un mot noyé dans une explication', () => {
    expect(ids('renommer')[0]).toBe('edit.rename')
    expect(ids('confirmation')).toEqual(['edit.delete'])
  })

  it('tolère une faute de frappe', () => {
    expect(ids('supprimre')[0]).toBe('edit.delete')
    expect(ids('flotante')[0]).toBe('card.addFloating')
  })

  it('cherche aussi dans le libellé de la catégorie déclarée', () => {
    defineCommandCatalog({ categories: [{ id: 'view', label: 'Affichage' }], commands: [zoom] })
    expect(ids('affichage', [zoom])).toEqual(['view.zoom'])
  })

  it.each(['(', '[', '.*', String.fromCharCode(92), '+', '?', '$', '🙂'])('traite %j comme du texte, pas comme une expression', query => {
    expect(() => rankCommandsBySearch(query, ALL)).not.toThrow()
    expect(rankCommandsBySearch(query, ALL).length).toBeLessThan(ALL.length)
  })

  it('renvoie des notes où PLUS PETIT = MIEUX, comme l\'attend la palette', () => {
    // Sans tri préalable : c'est la note elle-même qui doit dire qui est meilleur.
    const score = Object.fromEntries(rankCommandsBySearch('carte', ALL).map(entry => [entry.command.id, entry.score]))
    expect(score['edit.delete']).toBeLessThan(score['edit.rename'])
  })

  it('le libellé pèse plus que la description, même quand la description répète le mot', () => {
    const title: CommandDefinition = {
      id: 'a',
      label: 'Aire',
      description: 'Calcule une surface plane assez longue pour diluer le champ de la description',
      category: 'x',
      defaultBinding: null,
    }
    const buried: CommandDefinition = {
      id: 'b',
      label: 'Divers',
      description: 'aire '.repeat(40),
      category: 'x',
      defaultBinding: null,
    }
    expect(ids('aire', [buried, title])[0]).toBe('a')
  })

  it('suit les commandes qu\'on lui donne : un autre catalogue n\'est pas cherché dans l\'ancien index', () => {
    expect(ids('zoom', [zoom])).toEqual(['view.zoom'])
    expect(ids('zoom', [rename])).toEqual([])
    expect(ids('renommer', [zoom, rename])).toEqual(['edit.rename'])
  })

  it('accepte une liste vide', () => {
    expect(rankCommandsBySearch('x', [])).toEqual([])
    expect(rankCommandsBySearch('', [])).toEqual([])
  })
})
