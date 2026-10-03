import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PanelFooter, PanelFooterSeparator } from './PanelFooter'

describe('PanelFooter', () => {
  it('est une barre d’outils nommée qui contient ses actions', () => {
    render(
      <PanelFooter label="Actions de l’arborescence">
        <button>Un</button>
        <PanelFooterSeparator />
        <button>Deux</button>
      </PanelFooter>,
    )
    const bar = screen.getByRole('toolbar', { name: 'Actions de l’arborescence' })
    expect(bar).toContainElement(screen.getByRole('button', { name: 'Un' }))
    expect(bar).toContainElement(screen.getByRole('button', { name: 'Deux' }))
  })
})
