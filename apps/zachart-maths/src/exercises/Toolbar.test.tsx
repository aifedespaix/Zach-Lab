import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'
import { SYMBOL_FAMILIES } from './toolbarCatalog'

describe('Toolbar', () => {
  it('range les signes de chaque famille sur deux colonnes, familles groupées', () => {
    render(<Toolbar target="text" onSymbol={() => {}} onFormula={() => {}} canFormula={false} />)
    for (const family of SYMBOL_FAMILIES) {
      const group = screen.getByRole('group', { name: family.name })
      expect(group.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
      expect(within(group).getAllByRole('button')).toHaveLength(family.symbols.length)
    }
  })

  it('ne réserve pas de gouttière pour sa barre de défilement, sans défilement horizontal', () => {
    render(<Toolbar target="none" onSymbol={() => {}} onFormula={() => {}} canFormula={false} />)
    const bar = screen.getByRole('toolbar', { name: 'Outils' })
    expect(bar.style.scrollbarGutter).toBe('auto')
    expect(bar.style.overflowX).toBe('hidden')
  })

  it('le bouton « Formule » est à part, grisé hors d’un texte à formules', async () => {
    const onFormula = vi.fn()
    const { rerender } = render(<Toolbar target="text" onSymbol={() => {}} onFormula={onFormula} canFormula={false} />)
    const group = screen.getByRole('group', { name: 'Formule dans le texte' })
    expect(within(group).getByRole('button', { name: 'Formule dans le texte' })).toBeDisabled()
    rerender(<Toolbar target="rich" onSymbol={() => {}} onFormula={onFormula} canFormula />)
    await userEvent.setup().click(within(group).getByRole('button', { name: 'Formule dans le texte' }))
    expect(onFormula).toHaveBeenCalledTimes(1)
  })

  it('les structures sont grisées dans une case de tableau, permises dans un texte à formules', () => {
    const { rerender } = render(<Toolbar target="text" onSymbol={() => {}} onFormula={() => {}} canFormula={false} />)
    expect(screen.getByRole('button', { name: 'Fraction' })).toBeDisabled()
    rerender(<Toolbar target="rich" onSymbol={() => {}} onFormula={() => {}} canFormula />)
    expect(screen.getByRole('button', { name: 'Fraction' })).toBeEnabled()
  })
})
