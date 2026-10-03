import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { PanelSearch } from './PanelSearch'

function Harness({ focusRequest = 0 }: { focusRequest?: number }) {
  const [value, setValue] = useState('')
  return <PanelSearch value={value} onChange={setValue} ariaLabel="Rechercher un fichier" focusRequest={focusRequest} />
}

describe('PanelSearch', () => {
  it('remonte la saisie', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Rechercher un fichier' }), 'frac')
    expect(screen.getByRole('textbox')).toHaveValue('frac')
  })

  it("n'affiche le bouton d'effacement que lorsque le champ n'est pas vide, et il vide", async () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Effacer la recherche' })).toBeNull()
    await userEvent.type(screen.getByRole('textbox'), 'a')
    await userEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }))
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('Échap vide le champ et le quitte', async () => {
    render(<Harness />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'abc{Escape}')
    expect(input).toHaveValue('')
    expect(input).not.toHaveFocus()
  })

  it('prend le focus quand focusRequest change', () => {
    const { rerender } = render(<Harness focusRequest={0} />)
    expect(screen.getByRole('textbox')).not.toHaveFocus()
    rerender(<Harness focusRequest={1} />)
    expect(screen.getByRole('textbox')).toHaveFocus()
  })
})
