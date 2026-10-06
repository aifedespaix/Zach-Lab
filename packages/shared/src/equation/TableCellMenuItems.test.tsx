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
/** Les sous-menus Radix ne s'ouvrent pas au clic sous jsdom, mais à la flèche droite : c'est aussi le chemin clavier. */
async function item(submenu: string, name: string | RegExp) {
  const trigger = await screen.findByRole('menuitem', { name: submenu })
  trigger.focus()
  await userEvent.keyboard('{ArrowRight}')
  return screen.findByRole('menuitem', { name })
}
const choose = async (submenu: string, name: string | RegExp) => {
  await open()
  await userEvent.click(await item(submenu, name))
}

describe('TableCellMenuItems', () => {
  it('range les gestes dans les sous-menus Ligne et Colonne, sans sélection tant que l\'app n\'en fournit pas', async () => {
    setup()
    await open()
    expect(await screen.findByRole('menuitem', { name: 'Ligne' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Colonne' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Sélection' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Supprimer la ligne' })).not.toBeInTheDocument()
  })

  it('au-dessus / en dessous insèrent juste avant / juste après la ligne de la case (index -1 = avant la première)', async () => {
    const h = setup({ row: 1 })
    await choose('Ligne', 'Insérer une ligne au-dessus')
    expect(h.onAddRow).toHaveBeenLastCalledWith(0)
    await choose('Ligne', 'Insérer une ligne en dessous')
    expect(h.onAddRow).toHaveBeenLastCalledWith(1)
  })

  it('à gauche / à droite insèrent juste avant / juste après la colonne de la case', async () => {
    const h = setup({ column: 0 })
    await choose('Colonne', 'Insérer une colonne à gauche')
    expect(h.onAddColumn).toHaveBeenLastCalledWith(-1)
    await choose('Colonne', 'Insérer une colonne à droite')
    expect(h.onAddColumn).toHaveBeenLastCalledWith(0)
  })

  it('supprime la ligne et la colonne de la case', async () => {
    const h = setup({ row: 2, column: 3 })
    await choose('Ligne', 'Supprimer la ligne')
    expect(h.onRemoveRow).toHaveBeenCalledWith(2)
    await choose('Colonne', 'Supprimer la colonne')
    expect(h.onRemoveColumn).toHaveBeenCalledWith(3)
  })

  it('il reste une seule ligne / colonne : on ne peut plus la supprimer', async () => {
    const h = setup({ rowCount: 1, columnCount: 1 })
    await open()
    const row = await item('Ligne', 'Supprimer la ligne')
    expect(row).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(row)
    expect(h.onRemoveRow).not.toHaveBeenCalled()
  })

  it('au plafond, les insertions de cet axe sont grisées, pas les suppressions', async () => {
    const h = setup({ canAddRow: false })
    await open()
    const above = await item('Ligne', 'Insérer une ligne au-dessus')
    expect(above).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('menuitem', { name: 'Supprimer la ligne' })).not.toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(above)
    expect(h.onAddRow).not.toHaveBeenCalled()
  })

  it('« Sélection » : la ligne, la colonne et tout le tableau, avec leurs raccourcis', async () => {
    const onSelectRow = vi.fn()
    const onSelectColumn = vi.fn()
    const onSelectAll = vi.fn()
    setup({ row: 1, column: 2, onSelectRow, onSelectColumn, onSelectAll, shortcuts: { column: 'Ctrl + Espace' } })
    await choose('Sélection', 'Sélectionner la ligne')
    expect(onSelectRow).toHaveBeenCalledWith(1)
    await choose('Sélection', /Sélectionner la colonne/)
    expect(onSelectColumn).toHaveBeenCalledWith(2)
    await open()
    expect(await item('Sélection', /Sélectionner la colonne/)).toHaveTextContent('Ctrl + Espace')
    await userEvent.keyboard('{Escape}{Escape}')
    await choose('Sélection', 'Sélectionner tout le tableau')
    expect(onSelectAll).toHaveBeenCalledOnce()
  })
})
