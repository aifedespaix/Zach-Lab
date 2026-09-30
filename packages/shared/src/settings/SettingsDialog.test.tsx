import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sliders } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsDialog, type SettingsPanelDef, type SettingsSource } from './SettingsDialog'

const PANELS: SettingsPanelDef[] = [
  { id: 'general', label: 'Général', hint: 'Thème', icon: Sliders, render: () => <p>Contenu général</p> },
  {
    id: 'colors',
    label: 'Couleurs',
    icon: Sliders,
    render: ({ markDirty }) => (
      <button type="button" onClick={markDirty}>
        Changer une couleur
      </button>
    ),
  },
]

function memorySource(initial = 'a') {
  let value = initial
  const source: SettingsSource<string> = {
    snapshot: () => value,
    restore: vi.fn((snapshot: string) => {
      value = snapshot
    }),
    commit: vi.fn(async () => {}),
  }
  return { source, set: (next: string) => (value = next), get: () => value }
}

function Harness(props: {
  panels?: SettingsPanelDef[]
  sources?: SettingsSource<string>[]
  initialPanel?: string
  startOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(props.startOpen ?? true)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Rouvrir
      </button>
      <SettingsDialog
        open={open}
        onOpenChange={next => {
          props.onOpenChange?.(next)
          setOpen(next)
        }}
        panels={props.panels ?? PANELS}
        sources={props.sources}
        initialPanel={props.initialPanel}
      />
    </>
  )
}

const sources = (...list: SettingsSource<string>[]) => list

describe('SettingsDialog — onglets', () => {
  it('affiche un onglet par panneau, le premier actif', () => {
    render(<Harness />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual(['GénéralThème', 'Couleurs'])
    expect(screen.getByRole('tab', { name: /Général/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Contenu général')
  })

  it('ouvre sur le panneau demandé, et retombe sur le premier si l\'id est inconnu', () => {
    const { unmount } = render(<Harness initialPanel="colors" />)
    expect(screen.getByRole('tab', { name: /Couleurs/ })).toHaveAttribute('aria-selected', 'true')
    unmount()
    render(<Harness initialPanel="nope" />)
    expect(screen.getByRole('tab', { name: /Général/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('change de panneau au clic, et relie l\'onglet à son panneau pour les lecteurs d\'écran', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('tab', { name: /Couleurs/ }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByRole('button', { name: 'Changer une couleur' })).toBeInTheDocument()
    expect(panel).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { name: /Couleurs/ }).id)
  })

  it('n\'a pas de panneau à montrer : pas de plantage, un message', () => {
    render(<Harness panels={[]} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Aucun réglage/)).toBeInTheDocument()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('revient sur le panneau demandé à chaque ouverture', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('tab', { name: /Couleurs/ }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Rouvrir' }))
    expect(screen.getByRole('tab', { name: /Général/ })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('SettingsDialog — brouillon', () => {
  it('démarre propre : rien à enregistrer', () => {
    render(<Harness />)
    expect(screen.getByRole('status')).toHaveTextContent('Tout est enregistré')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('devient « modifié » dès qu\'un panneau le signale', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('tab', { name: /Couleurs/ }))
    await user.click(screen.getByRole('button', { name: 'Changer une couleur' }))
    expect(screen.getByRole('status')).toHaveTextContent('Modifications non enregistrées')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled()
  })

  it('« Enregistrer » enregistre chaque source, puis ferme', async () => {
    const user = userEvent.setup()
    const a = memorySource()
    const b = memorySource()
    const onOpenChange = vi.fn()
    render(<Harness sources={sources(a.source, b.source)} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('tab', { name: /Couleurs/ }))
    await user.click(screen.getByRole('button', { name: 'Changer une couleur' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(a.source.commit).toHaveBeenCalledOnce()
    expect(b.source.commit).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('si un enregistrement échoue, la fenêtre reste ouverte et modifiée (rien n\'est perdu en silence)', async () => {
    const user = userEvent.setup()
    const broken = memorySource()
    broken.source.commit = vi.fn(async () => {
      throw new Error('disk full')
    })
    const onOpenChange = vi.fn()
    render(<Harness sources={sources(broken.source)} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('tab', { name: /Couleurs/ }))
    await user.click(screen.getByRole('button', { name: 'Changer une couleur' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Modifications non enregistrées')
    expect(screen.getByRole('alert')).toHaveTextContent(/enregistrer/i)
  })

  it('« Annuler » remet chaque source dans l\'état où elle était à l\'ouverture, puis ferme', async () => {
    const user = userEvent.setup()
    const a = memorySource('avant')
    render(<Harness sources={sources(a.source)} />)
    a.set('aperçu en cours')
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(a.source.restore).toHaveBeenCalledWith('avant')
    expect(a.get()).toBe('avant')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('fermer par Échap annule aussi : un aperçu non enregistré ne survit pas à la fenêtre', async () => {
    const user = userEvent.setup()
    const a = memorySource('avant')
    render(<Harness sources={sources(a.source)} />)
    a.set('aperçu')
    await user.keyboard('{Escape}')
    expect(a.get()).toBe('avant')
  })

  it('reprend un instantané à CHAQUE ouverture : ce qui a été enregistré entre-temps n\'est pas défait', async () => {
    const user = userEvent.setup()
    const a = memorySource('v1')
    render(<Harness sources={sources(a.source)} />)
    a.set('v2') // enregistré depuis, ailleurs
    await user.keyboard('{Escape}')
    a.source.restore = vi.fn()
    a.set('v2')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Rouvrir' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(a.source.restore).toHaveBeenCalledWith('v2')
  })
})

describe('SettingsDialog — sources qui changent toutes seules', () => {
  function watchedSource() {
    const listeners = new Set<() => void>()
    let value = 'a'
    const source: SettingsSource<string> = {
      snapshot: () => value,
      restore: (snapshot: string) => {
        value = snapshot
      },
      commit: async () => {},
      changedSince: {
        subscribe: listener => {
          listeners.add(listener)
          return () => void listeners.delete(listener)
        },
        isChanged: snapshot => snapshot !== value,
      },
    }
    return {
      source,
      change: (next: string) => {
        value = next
        act(() => listeners.forEach(listener => listener()))
      },
      listeners,
    }
  }

  it('marque la fenêtre comme modifiée quand la source change', () => {
    const watched = watchedSource()
    render(<Harness sources={sources(watched.source)} />)
    expect(screen.getByRole('status')).toHaveTextContent('Tout est enregistré')
    watched.change('b')
    expect(screen.getByRole('status')).toHaveTextContent('Modifications non enregistrées')
  })

  it('ne marque rien si la source revient à sa valeur d\'ouverture', () => {
    const watched = watchedSource()
    render(<Harness sources={sources(watched.source)} />)
    watched.change('a')
    expect(screen.getByRole('status')).toHaveTextContent('Tout est enregistré')
  })

  it('cesse d\'écouter dès que la fenêtre est fermée', async () => {
    const user = userEvent.setup()
    const watched = watchedSource()
    render(<Harness sources={sources(watched.source)} />)
    expect(watched.listeners.size).toBe(1)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(watched.listeners.size).toBe(0))
  })
})
