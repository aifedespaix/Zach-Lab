import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RecentFilesList } from './RecentFilesList'

const items = [
  { path: 'Fractions/exo-1.json', name: 'Exo 1', folder: 'Fractions', openedAt: new Date().toISOString() },
  { path: 'Calcul/exo-2.json', name: 'Exo 2', folder: 'Calcul', openedAt: new Date().toISOString() },
]

describe('RecentFilesList', () => {
  it('ne rend rien sans fichier', () => {
    const { container } = render(<RecentFilesList title="Récents" items={[]} onOpen={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('montre le titre, le nom, le dossier, et ouvre au clic', async () => {
    const onOpen = vi.fn()
    render(<RecentFilesList title="Récents" items={items} onOpen={onOpen} />)
    expect(screen.getByText('Récents')).toBeInTheDocument()
    expect(screen.getByText('Fractions')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Exo 2/ }))
    expect(onOpen).toHaveBeenCalledWith('Calcul/exo-2.json')
  })

  it("laisse l'app ajouter un badge et envelopper la rangée", () => {
    render(
      <RecentFilesList
        title="Récents"
        items={items.slice(0, 1)}
        onOpen={vi.fn()}
        adornment={item => <span>badge-{item.name}</span>}
        wrap={(item, row) => <div data-testid={`wrap-${item.name}`}>{row}</div>}
      />
    )
    expect(screen.getByText('badge-Exo 1')).toBeInTheDocument()
    expect(screen.getByTestId('wrap-Exo 1')).toContainElement(screen.getByRole('button', { name: /Exo 1/ }))
  })
})
