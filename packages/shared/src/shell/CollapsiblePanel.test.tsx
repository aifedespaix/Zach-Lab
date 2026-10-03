import { act, render, screen } from '@testing-library/react'
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

function Panel({ side = 'left' }: { side?: 'left' | 'right' }) {
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
      >
        <p>Contenu du panneau</p>
      </CollapsiblePanel>
    </TooltipProvider>
  )
}

describe('CollapsiblePanel', () => {
  beforeEach(() => localStorage.clear())

  it('déplié : montre son contenu et sa poignée, pas la bande', () => {
    render(<Panel />)
    expect(screen.getByText('Contenu du panneau')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Déplier le panneau test' })).toBeNull()
  })

  it("la commande range le panneau : la bande remplace le contenu, qui n'est plus monté", () => {
    render(<Panel />)
    act(() => void runCommand('test.toggle'))
    expect(screen.queryByText('Contenu du panneau')).toBeNull()
    expect(screen.getByRole('button', { name: 'Déplier le panneau test' })).toBeInTheDocument()
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
    expect(screen.queryByText('Contenu du panneau')).toBeNull()
    act(() => void runCommand('test.toggle'))
    expect(screen.getByText('Contenu du panneau')).toBeInTheDocument()
  })

  it("l'état rangé est mémorisé d'un lancement à l'autre", () => {
    const { unmount } = render(<Panel />)
    act(() => void runCommand('test.toggle'))
    unmount()
    render(<Panel />)
    expect(screen.queryByText('Contenu du panneau')).toBeNull()
  })

  it('la bande du côté droit porte son propre bouton', () => {
    localStorage.setItem('test:collapsed', '1')
    render(<Panel side="right" />)
    expect(screen.getByRole('button', { name: 'Déplier le panneau test' })).toBeInTheDocument()
  })
})
