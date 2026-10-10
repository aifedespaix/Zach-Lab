import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }))
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

import { check } from '@tauri-apps/plugin-updater'
import { Cog } from 'lucide-react'
import { defineCommandCatalog, standardCommands, STANDARD_CATEGORIES, runCommand } from '../commands'
import { defineToolbar } from '../shell'
import { defineApp } from './defineApp'
import { SuiteApp } from './SuiteApp'
import { useAppStatusStore } from './useAppStatus'

defineCommandCatalog({
  categories: [...STANDARD_CATEGORIES],
  commands: standardCommands(['app.palette', 'app.settings', 'app.shortcuts', 'app.toggleTheme', 'view.zoomOut', 'view.zoomIn', 'view.zoomReset', 'view.toggleDensity', 'settings.open.appearance', 'settings.open.toolbar', 'settings.open.updates']),
})

const mark = {
  points: [[36, 36], [92, 36], [36, 92], [92, 92]],
  colors: ['#EF4444', '#F97316', '#3B82F6', '#EAB308'],
  segments: [],
} as const

function makeApp(extra: Partial<Parameters<typeof defineApp>[0]> = {}) {
  return defineApp({ id: 'demo', name: 'Demo', mark, bootFloorMs: 0, ...extra })
}

describe('SuiteApp', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStatusStore.setState({ entries: [] })
    vi.mocked(check).mockReset()
    vi.mocked(check).mockResolvedValue(null)
  })

  it('met deux panneaux vides par défaut, et `null` retire un côté', async () => {
    const { rerender } = render(<SuiteApp app={makeApp()}><main /></SuiteApp>)
    expect(screen.getByRole('complementary', { name: 'Panneau gauche' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Panneau droit' })).toBeInTheDocument()
    rerender(<SuiteApp app={makeApp()} left={null} right={<aside aria-label="Mien" />}><main /></SuiteApp>)
    expect(screen.queryByRole('complementary', { name: 'Panneau gauche' })).not.toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Mien' })).toBeInTheDocument()
    await act(async () => {})
  })

  it('lance onReady une fois et son nettoyage au démontage', async () => {
    const cleanup = vi.fn()
    const onReady = vi.fn(() => cleanup)
    const app = makeApp({ onReady })
    const { rerender, unmount } = render(<SuiteApp app={app}><main /></SuiteApp>)
    rerender(<SuiteApp app={app}><main>autre</main></SuiteApp>)
    expect(onReady).toHaveBeenCalledOnce()
    unmount()
    expect(cleanup).toHaveBeenCalledOnce()
    await act(async () => {})
  })

  it('app.shortcuts ouvre les réglages sur le panneau Raccourcis, et les panneaux de l\'app s\'y ajoutent', async () => {
    const app = makeApp({
      settings: { panels: [{ id: 'quiz', label: 'Quiz', icon: Cog, render: () => <p>réglages du quiz</p> }] },
    })
    render(<SuiteApp app={app}><main /></SuiteApp>)
    await act(async () => {})
    act(() => void runCommand('app.shortcuts'))
    const dialog = await screen.findByRole('dialog', { name: 'Paramètres' })
    const tabs = within(dialog).getAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual([
      expect.stringContaining('Raccourcis'),
      expect.stringContaining('Apparence'),
      expect.stringContaining('Boutons'),
      expect.stringContaining('Quiz'),
      expect.stringContaining('Mises à jour'),
    ])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('le thème n’est plus dans la barre par défaut, mais sa commande répond ; l’onglet « Boutons » le rend', async () => {
    const user = userEvent.setup()
    render(<SuiteApp app={makeApp({ id: 'theme' })}><main /></SuiteApp>)
    await act(async () => {})
    expect(screen.queryByRole('button', { name: /Basculer le thème/ })).not.toBeInTheDocument()
    const before = document.documentElement.classList.contains('dark')
    act(() => void runCommand('app.toggleTheme'))
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(!before))

    act(() => void runCommand('settings.open.toolbar'))
    const dialog = await screen.findByRole('dialog', { name: 'Paramètres' })
    await user.click(within(dialog).getByRole('switch', { name: /Basculer le thème/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(screen.getByRole('button', { name: /Basculer le thème/ })).toBeInTheDocument()
  })

  it('un bouton masqué reste une commande : la palette s’ouvre encore', async () => {
    localStorage.setItem('mask:toolbar-hidden', '["app.palette"]')
    render(<SuiteApp app={makeApp({ id: 'mask' })}><main /></SuiteApp>)
    await act(async () => {})
    expect(screen.queryByRole('button', { name: 'Palette de commandes' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Paramètres' })).toBeInTheDocument()
    act(() => void runCommand('app.palette'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('le raccourci d’un onglet : fenêtre fermée, l’ouvre dessus ; ouverte, y bascule', async () => {
    const user = userEvent.setup()
    render(<SuiteApp app={makeApp({ id: 'tabs' })}><main /></SuiteApp>)
    await act(async () => {})
    act(() => void runCommand('settings.open.appearance'))
    const dialog = await screen.findByRole('dialog', { name: 'Paramètres' })
    expect(within(dialog).getByRole('tab', { name: /Apparence/ })).toHaveAttribute('aria-selected', 'true')
    expect(within(dialog).getByRole('tab', { name: /Apparence/ })).toHaveAttribute('aria-keyshortcuts', 'F3')

    await user.click(within(dialog).getByRole('tab', { name: /Raccourcis/ }))
    act(() => void runCommand('settings.open.toolbar'))
    await waitFor(() => expect(within(dialog).getByRole('tab', { name: /Boutons/ })).toHaveAttribute('aria-selected', 'true'))
    // Redemander le même onglet après un clic ailleurs y revient.
    await user.click(within(dialog).getByRole('tab', { name: /Raccourcis/ }))
    act(() => void runCommand('settings.open.toolbar'))
    await waitFor(() => expect(within(dialog).getByRole('tab', { name: /Boutons/ })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('`toolbar.hide` retire un item standard, et l\'app pose les siens dans la zone `app`', async () => {
    const toolbar = defineToolbar({
      items: [{ id: 'mine', zone: 'app', node: <button>À moi</button> }],
      hide: ['app.toggleTheme'],
    })
    render(<SuiteApp app={makeApp({ toolbar })}><main /></SuiteApp>)
    expect(screen.getByRole('button', { name: 'À moi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Paramètres' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Basculer le thème/ })).not.toBeInTheDocument()
    await act(async () => {})
  })

  it('pose le zoom d\'interface : la barre, les commandes et la racine', async () => {
    const user = userEvent.setup()
    localStorage.clear()
    render(<SuiteApp app={makeApp({ id: 'zoomy' })}><main /></SuiteApp>)
    await act(async () => {})
    await user.click(screen.getByRole('button', { name: /^Zoomer/ }))
    expect(screen.getByRole('button', { name: 'Zoom à 100 %' })).toHaveTextContent('110 %')
    expect(document.documentElement.style.zoom).toBe('110%')
    act(() => void runCommand('view.zoomReset'))
    expect(document.documentElement.style.zoom).toBe('')
  })

  it('une app qui désactive le zoom n\'a ni ses boutons ni son effet', async () => {
    render(<SuiteApp app={makeApp({ id: 'nozoom', view: { zoom: false } })}><main /></SuiteApp>)
    await act(async () => {})
    expect(screen.queryByRole('group', { name: 'Zoom' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mode condensé' })).toBeInTheDocument()
    expect(document.documentElement.style.getPropertyValue('--app-zoom')).toBe('')
  })

  it('une mise à jour prête devient un bandeau de la pile, masquable', async () => {
    const user = userEvent.setup()
    vi.mocked(check).mockResolvedValue({
      download: vi.fn(async () => {}),
      install: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
    } as never)
    render(<SuiteApp app={makeApp()}><main /></SuiteApp>)
    const banner = await screen.findByText('Mise à jour prête')
    expect(banner.closest('.status-banner')).toHaveClass('status-banner--info')
    await user.click(screen.getByRole('button', { name: 'Masquer le message de mise à jour' }))
    await waitFor(() => expect(screen.queryByText('Mise à jour prête')).not.toBeInTheDocument())
  })

  it('l\'écran de chargement attend `ready`', async () => {
    const { rerender } = render(<SuiteApp app={makeApp()} ready={false}><main /></SuiteApp>)
    expect(screen.getByRole('status', { name: 'Chargement de l’application' })).toBeInTheDocument()
    rerender(<SuiteApp app={makeApp()} ready><main /></SuiteApp>)
    expect(screen.queryByRole('status', { name: 'Chargement de l’application' })).not.toBeInTheDocument()
    await act(async () => {})
  })
})
