import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import css from './index.css?raw'

// No Tauri runtime under jsdom: the first launch of a real install finds nothing
// on disk, so that is what the plugins answer.
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn(async () => null) }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appConfigDir: vi.fn(async () => '/config'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

import App from './App'

describe('App base', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('démarre sans aucun état persisté : les deux panneaux et le centre sont là', async () => {
    render(<App />)
    expect(screen.getByRole('complementary', { name: 'Panneau gauche' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Panneau droit' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    // Rien n'est ouvert de force : ni palette ni paramètres.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await act(async () => {})
  })

  it('les panneaux vides restent redimensionnables', () => {
    render(<App />)
    expect(screen.getAllByRole('separator')).toHaveLength(2)
  })

  it('n\'affiche pas de bannière de mise à jour quand il n\'y en a pas', async () => {
    render(<App />)
    await act(async () => {})
    expect(screen.queryByText(/mise à jour/i)).not.toBeInTheDocument()
  })

  it('ouvre la palette de commandes avec Ctrl+K et y liste les actions de base', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog', { name: 'Palette de commandes' })
    expect(within(dialog).getByRole('option', { name: /Paramètres/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('option', { name: /Basculer le thème/ })).toBeInTheDocument()
  })

  it('la palette retrouve une action malgré une faute de frappe et des accents oubliés', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.keyboard('{Control>}k{/Control}')
    const dialog = await screen.findByRole('dialog', { name: 'Palette de commandes' })
    await user.type(within(dialog).getByLabelText('Rechercher une commande'), 'parametrs')
    expect(within(dialog).getByRole('option', { name: /Paramètres/ })).toBeInTheDocument()
  })

  it('la barre n’a pas de bouton de thème par défaut ; l’onglet « Boutons » le remet', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.queryByRole('button', { name: /Basculer le thème/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Paramètres/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Paramètres' })
    await user.click(within(dialog).getByRole('tab', { name: /Boutons/ }))
    await user.click(await within(dialog).findByRole('switch', { name: /Basculer le thème/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(await screen.findByRole('button', { name: /Basculer le thème/ })).toBeInTheDocument()
  })

  it('le bouton de thème, une fois activé, bascule le thème sombre, et le choix est retenu', async () => {
    const user = userEvent.setup()
    localStorage.setItem('base:toolbar-hidden', '[]')
    render(<App />)
    expect(document.documentElement).not.toHaveClass('dark')
    await user.click(screen.getByRole('button', { name: /Basculer le thème/ }))
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
    expect(localStorage.getItem('suite.theme-mode')).toBe('dark')
    await user.click(screen.getByRole('button', { name: /Basculer le thème/ }))
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'))
  })

  it('les paramètres ont les raccourcis, l\'apparence et les mises à jour', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Paramètres/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Paramètres' })
    const tabs = within(dialog).getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs[0]).toHaveTextContent('Raccourcis')
    expect(tabs[1]).toHaveTextContent('Apparence')
    expect(tabs[2]).toHaveTextContent('Boutons')
    expect(tabs[3]).toHaveTextContent('Mises à jour')
    expect(tabs[2]).toHaveTextContent('F4')
    await user.click(tabs[3])
    expect(await within(dialog).findByRole('button', { name: 'Rechercher les mises à jour' })).toBeInTheDocument()
  })

  it('Échap referme la palette', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.keyboard('{Control>}k{/Control}')
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('feuille de style de base', () => {
  it('déclare @source vers packages/shared : sans cela les composants partagés s\'affichent sans style', () => {
    expect(css).toMatch(/@source\s+["'][^"']*packages\/shared\/src["']/)
  })

  it('importe la charte graphique partagée', () => {
    expect(css).toContain('@suite/shared/theme.css')
  })
})
