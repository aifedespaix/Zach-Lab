import { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
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

  /** Une case est sélectionnée quand le rectangle en trace le contour (voir `boxShadow` de `TableEditor`). */
  const selected = (...at: [number, number][]) =>
    [[1, 1], [1, 2], [2, 1], [2, 2]].filter(([r, c]) => cell(r, c).style.boxShadow.includes('inset')).sort().toString() === at.sort().toString()

  it('clic + glisser sur plusieurs cases les sélectionne, comme Maj+flèches', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[['a', 'b'], ['c', 'd']]} />)
    fireEvent.mouseDown(cell(1, 1), { button: 0 })
    fireEvent.mouseEnter(cell(2, 2), { buttons: 1 })
    expect(selected([1, 1], [1, 2], [2, 1], [2, 2])).toBe(true)
    fireEvent.mouseUp(window)
    fireEvent.mouseEnter(cell(1, 2), { buttons: 1 }) // le bouton est relâché : plus de glisser
    expect(selected([1, 1], [1, 2], [2, 1], [2, 2])).toBe(true)
    cell(1, 1).focus()
    await user.keyboard('{Delete}')
    expect(cells).toEqual([['', ''], ['', '']])
  })

  it('un clic simple, sans glisser, ne sélectionne rien', () => {
    render(<Harness initial={[['a', 'b'], ['c', 'd']]} />)
    fireEvent.mouseDown(cell(1, 1), { button: 0 })
    fireEvent.mouseEnter(cell(1, 2), { buttons: 0 })
    expect(selected()).toBe(true)
  })

  it('Ctrl+Espace sélectionne la colonne, Ctrl+Maj+Espace la ligne', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[['a', 'b'], ['c', 'd']]} />)
    cell(1, 2).focus()
    await user.keyboard('{Control>} {/Control}')
    expect(selected([1, 2], [2, 2])).toBe(true)
    await user.keyboard('{Control>}{Shift>} {/Shift}{/Control}')
    expect(selected([1, 1], [1, 2])).toBe(true)
  })

  it("Ctrl+A : d'abord le texte de la case, puis, quand il l'est déjà, tout le tableau", async () => {
    const user = userEvent.setup()
    render(<Harness initial={[['abc', 'b'], ['c', 'd']]} />)
    cell(1, 1).focus()
    cell(1, 1).setSelectionRange(1, 1)
    await user.keyboard('{Control>}a{/Control}')
    expect(selected()).toBe(true)
    cell(1, 1).setSelectionRange(0, 3)
    await user.keyboard('{Control>}a{/Control}')
    expect(selected([1, 1], [1, 2], [2, 1], [2, 2])).toBe(true)
  })

  it('le clic droit : raccourcis affichés, « Sélectionner la case » à part, et ligne / colonne / tout dans « Sélection »', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[['a', 'b'], ['c', 'd']]} />)
    fireEvent.contextMenu(cell(2, 1))
    expect(await screen.findByRole('menuitem', { name: /Couper/ })).toHaveTextContent('Ctrl + X')
    expect(screen.getByRole('menuitem', { name: /Sélectionner la case/ })).toHaveTextContent('Ctrl + A')
    const trigger = screen.getByRole('menuitem', { name: 'Sélection' })
    trigger.focus()
    await user.keyboard('{ArrowRight}')
    expect(await screen.findByRole('menuitem', { name: /Sélectionner la colonne/ })).toHaveTextContent('Ctrl + Espace')
    await user.click(screen.getByRole('menuitem', { name: /Sélectionner la ligne/ }))
    expect(selected([2, 1], [2, 2])).toBe(true)
  })
})
