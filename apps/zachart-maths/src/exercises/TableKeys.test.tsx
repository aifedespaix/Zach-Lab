import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@suite/shared/ui'
import { BlockStack } from './BlockStack'
import type { Block, TableBlock } from './blocks'

vi.mock('mathlive', () => { throw new Error('indisponible') })

let cells: string[][] = []
function Harness({ initial }: { initial: string[][] }) {
  const [value, setValue] = useState<unknown[]>([{ id: 't', type: 'tableau', cellules: initial }])
  cells = (value[0] as TableBlock).cellules
  return <TooltipProvider><BlockStack value={value} onChange={(b: Block[]) => setValue(b)} /></TooltipProvider>
}
const cell = (row: number, column: number) => screen.getByLabelText(`Ligne ${row}, colonne ${column}`) as HTMLInputElement

describe('tableau : clavier', () => {
  it('Entrée avance, crée une ligne dans la dernière case ; Maj+Entrée recule', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[['a', 'b'], ['c', 'd']]} />)
    cell(1, 1).focus()
    await user.keyboard('{Enter}')
    expect(cell(1, 2)).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(cell(2, 1)).toHaveFocus()
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    expect(cell(1, 2)).toHaveFocus()
    cell(2, 2).focus()
    await user.keyboard('{Enter}')
    expect(cells).toHaveLength(3)
    expect(cell(3, 1)).toHaveFocus()
  })

  it('Retour arrière : recule dans une case vide, supprime la ligne vide depuis sa première case', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[['a', 'b'], ['', '']]} />)
    cell(2, 2).focus()
    await user.keyboard('{Backspace}')
    expect(cell(2, 1)).toHaveFocus()
    await user.keyboard('{Backspace}')
    expect(cells).toEqual([['a', 'b']])
    expect(cell(1, 2)).toHaveFocus()
  })

  it('Ctrl+Entrée ajoute une colonne et y place le curseur', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[['a', 'b'], ['c', 'd']]} />)
    cell(2, 1).focus()
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(cells).toEqual([['a', '', 'b'], ['c', '', 'd']])
    expect(cell(2, 2)).toHaveFocus()
  })

  it('Maj+flèches sélectionne un rectangle que Suppr vide', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[['a', 'b'], ['c', 'd']]} />)
    cell(1, 1).focus()
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}')
    await user.keyboard('{Delete}')
    expect(cells).toEqual([['', 'b'], ['', 'd']])
  })

  it('propose le produit en croix sur une case vide', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[['10', '20'], ['4', '']]} />)
    act(() => cell(2, 2).focus())
    expect(screen.getByText(/4 × 20 ÷ 10 = 8/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remplir' }))
    expect(cells[1][1]).toBe('8')
  })
})
