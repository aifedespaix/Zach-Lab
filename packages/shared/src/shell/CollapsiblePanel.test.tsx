import { act, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineCommandCatalog, runCommand } from '../commands'
import { TooltipProvider } from '../ui'
import { CollapsiblePanel } from './CollapsiblePanel'
import { createPanelWidthStorage } from './panelWidth'

defineCommandCatalog({
  categories: [{ id: 'view', label: 'Affichage' }],
  commands: [{ id: 'test.toggle', label: 'Basculer le panneau', description: 'Test.', category: 'view', defaultBinding: 'Mod+B' }],
})

const storage = createPanelWidthStorage({ key: 'test:width', min: 100, max: 600, fallback: 240 })

function Panel({ side = 'left', footer, railContent }: { side?: 'left' | 'right'; footer?: ReactNode; railContent?: ReactNode }) {
  return (
    <TooltipProvider>
      <CollapsiblePanel
        side={side}
        label="Panneau test"
        storage={storage}
        collapsedKey="test:collapsed"
        toggleCommand="test.toggle"
        foldLabel="Replier le panneau test"
        unfoldLabel="Déplier le panneau test"
        footer={footer}
        railContent={railContent}
      >
        <p>Contenu du panneau</p>
      </CollapsiblePanel>
    </TooltipProvider>
  )
}

describe('CollapsiblePanel', () => {
  beforeEach(() => localStorage.clear())

  it('déplié : le bouton de repli est dans le pied, après les actions de l’app', () => {
    render(<Panel footer={<button>Action</button>} />)
    const bar = screen.getByRole('group')
    const buttons = within(bar).getAllByRole('button')
    expect(buttons.map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Action', 'Replier le panneau test'])
  })

  it('déplié : montre son contenu et sa poignée, la bande est là mais inerte', () => {
    render(<Panel />)
    expect(screen.getByText('Contenu du panneau')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Déplier le panneau test' }).closest('[inert]')).not.toBeNull()
  })

  it('la commande range le panneau : le contenu reste monté mais inerte, la bande prend le relais', () => {
    render(<Panel />)
    act(() => void runCommand('test.toggle'))
    expect(screen.getByText('Contenu du panneau').closest('[inert]')).not.toBeNull()
    expect(screen.queryByRole('separator')).toBeNull()
    expect(screen.getByRole('button', { name: 'Déplier le panneau test' }).closest('[inert]')).toBeNull()
  })

  it('déplié, la bande est inerte : pas de second bouton « Déplier » dans l’ordre de tabulation', () => {
    render(<Panel />)
    expect(screen.getByText('Déplier le panneau test').closest('[inert]')).not.toBeNull()
  })

  it('la largeur est animée : le panneau garde son nœud et passe de la largeur mémorisée à 32 px', () => {
    storage.save(333)
    render(<Panel />)
    const panel = screen.getByRole('complementary', { name: 'Panneau test' })
    expect(panel).toHaveStyle({ width: '333px' })
    act(() => void runCommand('test.toggle'))
    expect(screen.getByRole('complementary', { name: 'Panneau test' })).toBe(panel)
    expect(panel).toHaveStyle({ width: '32px' })
  })

  it('la bande dit ce que l’app lui donne, sinon le libellé de dépliage', () => {
    localStorage.setItem('test:collapsed', '1')
    const { unmount } = render(<Panel railContent="Fiche 3 · 2 à corriger" />)
    expect(screen.getByRole('button', { name: 'Déplier le panneau test' })).toHaveTextContent('Fiche 3 · 2 à corriger')
    unmount()
    render(<Panel />)
    expect(screen.getByRole('button', { name: 'Déplier le panneau test' })).toHaveTextContent('Déplier le panneau test')
  })

  it("le bouton de la bande déplie, et la largeur d'avant est restaurée", async () => {
    storage.save(333)
    render(<Panel />)
    act(() => void runCommand('test.toggle'))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Déplier le panneau test' }))
    expect(screen.getByText('Contenu du panneau')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Panneau test' })).toHaveStyle({ width: '333px' })
  })

  it('rangé, la commande (le raccourci) déplie encore : elle est enregistrée avant le retour anticipé', () => {
    render(<Panel />)
    act(() => void runCommand('test.toggle'))
    expect(screen.getByText('Contenu du panneau').closest('[inert]')).not.toBeNull()
    act(() => void runCommand('test.toggle'))
    expect(screen.getByText('Contenu du panneau').closest('[inert]')).toBeNull()
  })

  it("l'état rangé est mémorisé d'un lancement à l'autre", () => {
    const { unmount } = render(<Panel />)
    act(() => void runCommand('test.toggle'))
    unmount()
    render(<Panel />)
    expect(screen.getByText('Contenu du panneau').closest('[inert]')).not.toBeNull()
  })

  it('la bande du côté droit porte son propre bouton', () => {
    localStorage.setItem('test:collapsed', '1')
    render(<Panel side="right" />)
    expect(screen.getByRole('button', { name: 'Déplier le panneau test' })).toBeInTheDocument()
  })
})
