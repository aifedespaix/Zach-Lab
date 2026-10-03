import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Toolbar } from './Toolbar'
import { SYMBOL_FAMILIES } from './toolbarCatalog'

describe('Toolbar', () => {
  it('range les signes de chaque famille sur deux colonnes, familles groupées', () => {
    render(<Toolbar target="text" onSymbol={() => {}} />)
    for (const family of SYMBOL_FAMILIES) {
      const group = screen.getByRole('group', { name: family.name })
      expect(group.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
      expect(within(group).getAllByRole('button')).toHaveLength(family.symbols.length)
    }
  })
})
