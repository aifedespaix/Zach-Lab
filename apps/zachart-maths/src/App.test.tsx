import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import css from './index.css?raw'
import { useUnitColors } from './exercises/useUnitColors'

// No Tauri runtime under jsdom: the first launch of a real install finds nothing
// on disk, so that is what the plugins answer.
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn(async () => null) }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  readDir: vi.fn(async () => []),
  remove: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appConfigDir: vi.fn(async () => '/config'),
  documentDir: vi.fn(async () => '/docs'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

import App from './App'

/** Un panneau rangé reste monté (sa largeur s'anime) : il a perdu sa poignée de redimensionnement. */
const isFolded = (name: string) => screen.getByRole('complementary', { name }).querySelector('[role="separator"]') === null

describe('App base', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    // Le store survit d'un test à l'autre : on le remet à « activé » (le défaut).
    useUnitColors.setState({ enabled: true })
  })

  it('le bouton « Colorer unités et termes » bascule la coloration, et le choix est mémorisé', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Colorer unités et termes/ }))
    expect(useUnitColors.getState().enabled).toBe(false)
    expect(localStorage.getItem('zachart-maths:unit-colors')).toBe('off')
    await user.click(screen.getByRole('button', { name: /Colorer unités et termes/ }))
    expect(useUnitColors.getState().enabled).toBe(true)
    await act(async () => {})
  })

  it('la zone centrale peut rétrécir sous son contenu, pour que ce soit la pile de blocs qui défile', async () => {
    render(<App />)
    expect(screen.getByRole('main')).toHaveStyle({ minHeight: '0px' })
    await act(async () => {})
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

  it("le bouton du pied range le panneau gauche, la bande le rouvre", async () => {
    const user = userEvent.setup()
    render(<App />)
    await act(async () => {})
    await user.click(await screen.findByRole('button', { name: "Replier l'arborescence" }))
    expect(isFolded('Panneau gauche')).toBe(true)
    await user.click(screen.getByRole('button', { name: "Déplier l'arborescence" }))
    expect(isFolded('Panneau gauche')).toBe(false)
  })

  it('le bouton « Nouveau chapitre » du pied ouvre le champ de nom', async () => {
    const user = userEvent.setup()
    render(<App />)
    await act(async () => {})
    await user.click(await screen.findByRole('button', { name: 'Nouveau chapitre' }))
    expect(screen.getByLabelText('Nom du nouveau chapitre')).toBeInTheDocument()
  })

  it('Ctrl+B range le panneau gauche et le rouvre, même rangé', async () => {
    const user = userEvent.setup()
    render(<App />)
    await act(async () => {})
    await user.keyboard('{Control>}b{/Control}')
    expect(isFolded('Panneau gauche')).toBe(true)
    await user.keyboard('{Control>}b{/Control}')
    expect(isFolded('Panneau gauche')).toBe(false)
  })

  it('Ctrl+Maj+B range le panneau des cours, indépendamment de celui de gauche', async () => {
    const user = userEvent.setup()
    render(<App />)
    await act(async () => {})
    await user.keyboard('{Control>}{Shift>}b{/Shift}{/Control}')
    expect(isFolded('Panneau droit')).toBe(true)
    expect(screen.getByRole('complementary', { name: 'Panneau gauche' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Déplier le panneau des cours' }))
    expect(isFolded('Panneau droit')).toBe(false)
  })

  it("l'état rangé d'un panneau est retenu au lancement suivant", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await act(async () => {})
    await user.click(await screen.findByRole('button', { name: "Replier l'arborescence" }))
    unmount()
    render(<App />)
    await act(async () => {})
    expect(isFolded('Panneau gauche')).toBe(true)
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

  it('les paramètres ont les raccourcis, la barre d\'outils et les mises à jour', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Paramètres/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Paramètres' })
    const tabs = within(dialog).getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveTextContent('Raccourcis')
    expect(tabs[1]).toHaveTextContent('Barre d\'outils')
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

describe('feuille de style de base', () => {
  it('déclare @source vers packages/shared : sans cela les composants partagés s\'affichent sans style', () => {
    expect(css).toMatch(/@source\s+["'][^"']*packages\/shared\/src["']/)
  })

  it('importe la charte graphique partagée', () => {
    expect(css).toContain('@suite/shared/theme.css')
  })

  it('couvre l\'écran d\'un M qui s\'écrit le temps du chargement, puis le retire', async () => {
    vi.useFakeTimers()
    try {
      render(<App />)
      expect(screen.getByRole('status', { name: /Chargement/ }).querySelectorAll('circle')).toHaveLength(4)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500)
      })
      expect(screen.queryByRole('status', { name: /Chargement/ })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
