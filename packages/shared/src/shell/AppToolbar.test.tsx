import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { defineCommandCatalog, standardCommands, STANDARD_CATEGORIES, useCommand } from '../commands'
import { AppToolbar, FileTitle } from './AppToolbar'
import { defineToolbar } from './toolbarZones'
import { TooltipProvider } from '../ui'

beforeAll(() => {
  defineCommandCatalog({
    categories: [...STANDARD_CATEGORIES],
    commands: standardCommands([
      'app.palette', 'app.settings', 'app.toggleTheme',
      'file.new', 'file.close', 'file.save', 'file.rename', 'edit.undo', 'edit.redo',
    ]),
  })
})

function Handlers() {
  useCommand('file.new', vi.fn())
  useCommand('file.close', vi.fn())
  useCommand('edit.undo', vi.fn(), false)
  useCommand('edit.redo', vi.fn(), true)
  return null
}

const mount = (props: Parameters<typeof AppToolbar>[0]) =>
  render(<TooltipProvider><Handlers /><AppToolbar {...props} /></TooltipProvider>)

const names = () => screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)

describe('AppToolbar', () => {
  it('sans fichier : Nouveau, menu Fichier, Annuler, Rétablir… puis le système, dans l’ordre des zones', async () => {
    mount({ toolbar: defineToolbar({ items: [{ id: 'mine', zone: 'app', node: <button aria-label="Mien" /> }] }) })
    await act(async () => {})
    expect(names()).toEqual([
      'Nouveau fichier', 'Fichier', 'Annuler', 'Rétablir', 'Mien', 'Palette de commandes', 'Basculer le thème', 'Paramètres',
    ])
  })

  it('un seul emplacement : Fermer remplace Nouveau quand un fichier est ouvert, avant Annuler', async () => {
    mount({ file: { open: true, name: 'devoir.zmath' } })
    await act(async () => {})
    const all = names()
    expect(all).toContain('Fermer')
    expect(all).not.toContain('Nouveau fichier')
    expect(all.indexOf('Fermer')).toBeLessThan(all.indexOf('Annuler'))
  })

  it('désactive Annuler selon l’historique, et un item caché disparaît', async () => {
    mount({ toolbar: defineToolbar({ hide: ['file.menu', 'app.palette'] }) })
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rétablir' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Fichier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Palette de commandes' })).not.toBeInTheDocument()
  })

  it('le menu Fichier liste les commandes du catalogue avec leurs groupes', async () => {
    const user = userEvent.setup()
    mount({})
    await user.click(screen.getByRole('button', { name: 'Fichier' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual([
      expect.stringContaining('Nouveau fichier'),
      expect.stringContaining('Enregistrer maintenant'),
      expect.stringContaining('Renommer'),
      expect.stringContaining('Fermer'),
    ])
  })

  it('affiche le titre (nom tronqué, chemin au survol) et l’état d’enregistrement', async () => {
    mount({ file: { open: true, name: 'Un très long nom de fiche', path: '/docs/fiche.zmath', status: 'error' } })
    await act(async () => {})
    expect(screen.getByText('Un très long nom de fiche')).toHaveAttribute('title', '/docs/fiche.zmath')
    expect(screen.getByRole('status')).toHaveTextContent('⚠ Erreur de sauvegarde')
  })
})

describe('FileTitle', () => {
  it('dit « Enregistrement… » puis « Enregistré »', () => {
    const { rerender } = render(<FileTitle name="a" status="saving" />)
    expect(screen.getByRole('status')).toHaveTextContent('Enregistrement…')
    rerender(<FileTitle name="a" status="saved" />)
    expect(screen.getByRole('status')).toHaveTextContent('Enregistré')
  })
})
