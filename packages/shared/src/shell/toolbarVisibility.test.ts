import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_HIDDEN_TOOLBAR_ITEMS,
  LOCKED_TOOLBAR_ITEMS,
  isToolbarItemLocked,
  toolbarHiddenStore,
  visibleToolbarItems,
} from './toolbarVisibility'

const item = (id: string) => ({ id })

describe('visibleToolbarItems', () => {
  it('retire les items masqués', () => {
    const items = [item('app.palette'), item('view.zoom'), item('quiz')]
    expect(visibleToolbarItems(items, new Set(['quiz', 'view.zoom'])).map(i => i.id)).toEqual(['app.palette'])
  })

  it('ne retire jamais un item verrouillé, même présent dans la liste (donnée corrompue)', () => {
    const items = LOCKED_TOOLBAR_ITEMS.map(item)
    expect(visibleToolbarItems(items, new Set(LOCKED_TOOLBAR_ITEMS))).toHaveLength(LOCKED_TOOLBAR_ITEMS.length)
  })

  it('ignore un id inconnu (app mise à jour)', () => {
    expect(visibleToolbarItems([item('quiz')], new Set(['disparu'])).map(i => i.id)).toEqual(['quiz'])
  })

  it('verrouille Nouveau/Fermer, Annuler, Rétablir, Paramètres et le menu Fichier, pas la palette ni le thème', () => {
    expect(isToolbarItemLocked('file.newOrClose')).toBe(true)
    expect(isToolbarItemLocked('edit.undo')).toBe(true)
    expect(isToolbarItemLocked('edit.redo')).toBe(true)
    expect(isToolbarItemLocked('app.settings')).toBe(true)
    expect(isToolbarItemLocked('file.menu')).toBe(true)
    expect(isToolbarItemLocked('app.palette')).toBe(false)
    expect(isToolbarItemLocked('app.toggleTheme')).toBe(false)
  })
})

describe('toolbarHiddenStore', () => {
  beforeEach(() => localStorage.clear())

  it('masque le thème par défaut', () => {
    expect(DEFAULT_HIDDEN_TOOLBAR_ITEMS).toEqual(['app.toggleTheme'])
    expect(toolbarHiddenStore('a-defaut').getState().value).toEqual(['app.toggleTheme'])
  })

  it('se souvient du choix sous la clé <id>:toolbar-hidden', () => {
    toolbarHiddenStore('a-retenir').getState().set(['quiz'])
    expect(localStorage.getItem('a-retenir:toolbar-hidden')).toBe('["quiz"]')
  })

  it('relit un choix enregistré, y compris une liste vide (le thème redevient visible)', () => {
    localStorage.setItem('relu:toolbar-hidden', '[]')
    expect(toolbarHiddenStore('relu').getState().value).toEqual([])
  })

  it('rend le même store pour le même id', () => {
    expect(toolbarHiddenStore('meme')).toBe(toolbarHiddenStore('meme'))
  })
})
