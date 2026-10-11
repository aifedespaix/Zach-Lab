import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HomeScreen } from './HomeScreen'
import { DropOverlay } from './DropOverlay'
import type { MarkConfig } from '../shell/AnimatedMark'

const mark: MarkConfig = {
  points: [[20, 20], [60, 20], [60, 60], [20, 60]],
  colors: ['#f00', '#0f0', '#00f', '#ff0'],
  segments: [[[20, 20], [60, 20]]],
}

const recent = [{ path: 'a.txt', name: 'a', folder: 'Notes', openedAt: new Date().toISOString() }]

describe('HomeScreen', () => {
  it('dit quoi faire, liste les récents et ouvre au clic', async () => {
    const onOpen = vi.fn()
    render(
      <HomeScreen mark={mark} message="Ouvrez un fichier." recentTitle="Récents" recent={recent} onOpen={onOpen} />,
    )
    expect(screen.getByText('Ouvrez un fichier.')).toBeInTheDocument()
    expect(screen.getByText('Récents')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /a/ }))
    expect(onOpen).toHaveBeenCalledWith('a.txt')
  })

  it('reçoit les actions propres à l’app en enfants', () => {
    render(
      <HomeScreen mark={mark} message="x" recentTitle="Récents" recent={[]} onOpen={vi.fn()}>
        <button type="button">Créer un fichier</button>
      </HomeScreen>,
    )
    expect(screen.getByRole('button', { name: 'Créer un fichier' })).toBeInTheDocument()
  })

  it('sans récent, n’affiche pas la liste', () => {
    render(<HomeScreen mark={mark} message="x" recentTitle="Récents" recent={[]} onOpen={vi.fn()} />)
    expect(screen.queryByText('Récents')).not.toBeInTheDocument()
  })
})

describe('DropOverlay', () => {
  it('ne rend rien hors survol', () => {
    const { container } = render(<DropOverlay active={false}>Déposez</DropOverlay>)
    expect(container).toBeEmptyDOMElement()
  })

  it('montre son message pendant le survol, sans capter le pointeur', () => {
    render(<DropOverlay active>Déposez ici</DropOverlay>)
    const overlay = screen.getByText('Déposez ici')
    expect(overlay.style.pointerEvents).toBe('none')
  })
})
