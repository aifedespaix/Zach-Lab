import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '../ui'
import { TableCellMenuItems } from './TableCellMenuItems'

function setup(over: Partial<React.ComponentProps<typeof TableCellMenuItems>> = {}) {
  const handlers = { onAddRow: vi.fn(), onAddColumn: vi.fn(), onRemoveRow: vi.fn(), onRemoveColumn: vi.fn() }
  render(
    <ContextMenu>
      <ContextMenuTrigger>cellule</ContextMenuTrigger>
      <ContextMenuContent>
        <TableCellMenuItems row={1} column={2} rowCount={3} columnCount={4} {...handlers} {...over} />
      </ContextMenuContent>
    </ContextMenu>,
  )
  return handlers
}
const open = () => userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('cellule') })

describe('TableCellMenuItems', () => {
  it('propose les six gestes du clic droit sur une case', async () => {
    setup()
    await open()
    for (const name of [
      'Insérer une ligne au-dessus',
      'Insérer une ligne en dessous',
      'Insérer une colonne à gauche',
      'Insérer une colonne à droite',
      'Supprimer la ligne',
      'Supprimer la colonne',
    ]) {
      expect(await screen.findByRole('menuitem', { name })).toBeInTheDocument()
    }
  })

  it('au-dessus / en dessous insèrent juste avant / juste après la ligne de la case (index -1 = avant la première)', async () => {
    const h = setup({ row: 1 })
    await open()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Insérer une ligne au-dessus' }))
    expect(h.onAddRow).toHaveBeenLastCalledWith(0)
    await open()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Insérer une ligne en dessous' }))
    expect(h.onAddRow).toHaveBeenLastCalledWith(1)
  })

  it('à gauche / à droite insèrent juste avant / juste après la colonne de la case', async () => {
    const h = setup({ column: 0 })
    await open()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Insérer une colonne à gauche' }))
    expect(h.onAddColumn).toHaveBeenLastCalledWith(-1)
    await open()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Insérer une colonne à droite' }))
    expect(h.onAddColumn).toHaveBeenLastCalledWith(0)
  })

  it('supprime la ligne et la colonne de la case', async () => {
    const h = setup({ row: 2, column: 3 })
    await open()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer la ligne' }))
    expect(h.onRemoveRow).toHaveBeenCalledWith(2)
    await open()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Supprimer la colonne' }))
    expect(h.onRemoveColumn).toHaveBeenCalledWith(3)
  })

  it('il reste une seule ligne / colonne : on ne peut plus la supprimer', async () => {
    const h = setup({ rowCount: 1, columnCount: 1 })
    await open()
    const row = await screen.findByRole('menuitem', { name: 'Supprimer la ligne' })
    const col = screen.getByRole('menuitem', { name: 'Supprimer la colonne' })
    expect(row).toHaveAttribute('aria-disabled', 'true')
    expect(col).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(row)
    expect(h.onRemoveRow).not.toHaveBeenCalled()
  })

  it('au plafond, les insertions de cet axe sont grisées, pas les suppressions', async () => {
    const h = setup({ canAddRow: false, canAddColumn: false })
    await open()
    const above = await screen.findByRole('menuitem', { name: 'Insérer une ligne au-dessus' })
    expect(above).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('menuitem', { name: 'Insérer une colonne à droite' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('menuitem', { name: 'Supprimer la ligne' })).not.toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(above)
    expect(h.onAddRow).not.toHaveBeenCalled()
  })
})
