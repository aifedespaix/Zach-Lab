import { afterEach, describe, expect, it } from 'vitest'
import { defineCommandCatalog, resetCommandCatalog, type CommandDefinition } from './catalog'
import { rankCommandsByText } from './rankCommandsByText'

const rename: CommandDefinition = { id: 'edit.rename', label: 'Renommer', description: 'Change le nom de la carte.', category: 'edit', defaultBinding: 'F2' }
const remove: CommandDefinition = { id: 'edit.delete', label: 'Supprimer la carte', description: 'Retire la carte et ses enfants.', category: 'edit', defaultBinding: null }
const zoom: CommandDefinition = { id: 'view.zoom', label: 'Zoom avant', description: 'Rapproche la vue.', category: 'view', defaultBinding: null }
const ALL = [rename, remove, zoom]

afterEach(() => resetCommandCatalog())

function ids(query: string): string[] {
  return rankCommandsByText(query, ALL)
    .sort((a, b) => a.score - b.score)
    .map(entry => entry.command.id)
}

describe('rankCommandsByText', () => {
  it('renvoie toutes les commandes pour une requête vide ou blanche', () => {
    expect(ids('')).toHaveLength(3)
    expect(ids('   ')).toHaveLength(3)
  })

  it('ne renvoie rien quand rien ne correspond', () => {
    expect(ids('zzzz')).toEqual([])
  })

  it('ignore les accents et la casse, dans la requête comme dans le texte', () => {
    expect(ids('RENOMMER')).toEqual(['edit.rename'])
    expect(ids('supprimér')).toEqual(['edit.delete'])
  })

  it('classe une correspondance dans le libellé avant une correspondance dans la description', () => {
    // « carte » est dans le libellé de « Supprimer la carte » et seulement dans la
    // description de « Renommer ».
    expect(ids('carte')).toEqual(['edit.delete', 'edit.rename'])
  })

  it('classe une correspondance plus tôt dans le libellé avant une plus tardive', () => {
    expect(ids('r')[0]).toBe('edit.rename')
  })

  it('cherche aussi dans le libellé de la catégorie déclarée', () => {
    defineCommandCatalog({ categories: [{ id: 'view', label: 'Affichage' }], commands: [zoom] })
    expect(ids('affichage')).toEqual(['view.zoom'])
  })

  it.each(['(', '[', '.*', '\u005c', '+', '?', '$'])('traite %s comme du texte, pas comme une expression', query => {
    expect(() => rankCommandsByText(query, ALL)).not.toThrow()
  })
})
