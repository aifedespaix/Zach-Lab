import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import css from './index.css?raw'

// No Tauri runtime under jsdom: the first launch of a real install finds nothing
// on disk, so that is what the plugins answer.
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn(async () => null) }))
// A disk in memory: the first launch of a real install finds nothing, and what the app writes is read back.
const disk = vi.hoisted(() => new Map<string, string>())
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => disk.has(path) || path === '/documents/Base'),
  readTextFile: vi.fn(async (path: string) => disk.get(path) ?? ''),
  writeTextFile: vi.fn(async (path: string, text: string) => void disk.set(path, text)),
  mkdir: vi.fn(async () => {}),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appConfigDir: vi.fn(async () => '/config'),
  documentDir: vi.fn(async () => '/documents'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

import App from './App'

describe('App base', () => {
  beforeEach(() => {
    localStorage.clear()
    disk.clear()
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

  it('le bouton de thème bascule le thème sombre, et le choix est retenu', async () => {
    const user = userEvent.setup()
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
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveTextContent('Raccourcis')
    expect(tabs[1]).toHaveTextContent('Apparence')
    expect(tabs[2]).toHaveTextContent('Mises à jour')
    await user.click(tabs[2])
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

describe('document texte', () => {
  beforeEach(() => {
    localStorage.clear()
    disk.clear()
  })

  it('Ctrl+N crée un fichier, la frappe est enregistrée, annuler la défait, Fermer revient à l\'accueil', async () => {
    const user = userEvent.setup()
    render(<App />)
    await act(async () => {})
    await user.keyboard('{Control>}n{/Control}')
    const field = await screen.findByLabelText('Contenu du fichier')
    expect([...disk.keys()]).toEqual(['/documents/Base/Sans titre.txt'])
    await user.type(field, 'bonjour')
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByLabelText('Contenu du fichier')).not.toBeInTheDocument())
    expect(disk.get('/documents/Base/Sans titre.txt')).toBe('bonjour')
    // Le fichier est dans les récents de l'accueil.
    await user.click(await screen.findByRole('button', { name: /Sans titre\.txt/ }))
    expect(await screen.findByLabelText('Contenu du fichier')).toHaveValue('bonjour')
    await user.type(screen.getByLabelText('Contenu du fichier'), '!')
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByLabelText('Contenu du fichier')).toHaveValue('bonjour')
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
