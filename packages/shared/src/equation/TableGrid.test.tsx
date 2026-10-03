import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '../ui'
import { TableGrid } from './TableGrid'

function setup(over: Partial<React.ComponentProps<typeof TableGrid>> = {}) {
  const handlers = { onAddRow: vi.fn(), onAddColumn: vi.fn(), onRemoveRow: vi.fn(), onRemoveColumn: vi.fn() }
  render(
    <TooltipProvider>
    <TableGrid
      tableLabel="1"
      rowCount={2}
      columnCount={2}
      renderCell={(r, c) => <input aria-label={`cellule ${r},${c}`} />}
      {...handlers}
      {...over}
    />
    </TooltipProvider>,
  )
  return handlers
}

describe('TableGrid', () => {
  it('rend toutes les cellules', () => {
    setup()
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
  })

  it('« + » après la colonne 1 insère après l’index 0 ; « avant la colonne 1 » insère après -1', async () => {
    const h = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Insérer une colonne après la colonne 1 du tableau 1' }))
    expect(h.onAddColumn).toHaveBeenLastCalledWith(0)
    await userEvent.click(screen.getByRole('button', { name: 'Insérer une colonne avant la colonne 1 du tableau 1' }))
    expect(h.onAddColumn).toHaveBeenLastCalledWith(-1)
  })

  it('« + » de ligne', async () => {
    const h = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Insérer une ligne après la ligne 2 du tableau 1' }))
    expect(h.onAddRow).toHaveBeenLastCalledWith(1)
    await userEvent.click(screen.getByRole('button', { name: 'Insérer une ligne avant la ligne 1 du tableau 1' }))
    expect(h.onAddRow).toHaveBeenLastCalledWith(-1)
  })

  it('la corbeille de colonne supprime la colonne, même après un clic qui retire le focus de la cellule', async () => {
    const h = setup()
    await userEvent.click(screen.getByLabelText('cellule 0,1'))
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la colonne 2 du tableau 1' }))
    expect(h.onRemoveColumn).toHaveBeenCalledWith(1)
  })

  it('le focus seul (sans survol) révèle la corbeille, et la lui donner ne la cache pas', () => {
    setup()
    const trash = screen.getByRole('button', { name: 'Supprimer la colonne 2 du tableau 1' })
    const wrapper = trash.parentElement as HTMLElement
    expect(wrapper.style.opacity).toBe('0')
    act(() => screen.getByLabelText('cellule 0,1').focus())
    expect(wrapper.style.opacity).toBe('1')
    expect(wrapper.style.pointerEvents).toBe('auto')
    // The focus moves onto the bin itself (inside the grid): the blur must not hide it.
    act(() => trash.focus())
    expect(document.activeElement).toBe(trash)
    expect(wrapper.style.opacity).toBe('1')
    expect(wrapper.style.pointerEvents).toBe('auto')
    // Leaving the grid does.
    act(() => trash.blur())
    expect(wrapper.style.opacity).toBe('0')
  })

  it('le focus seul révèle la corbeille de ligne ; invisible (opacité 0), elle reste focalisable au clavier', async () => {
    const h = setup()
    const trash = screen.getByRole('button', { name: 'Supprimer la ligne 2 du tableau 1' })
    const wrapper = trash.parentElement as HTMLElement
    expect(wrapper.style.opacity).toBe('0')
    trash.focus()
    expect(document.activeElement).toBe(trash)
    act(() => trash.blur())
    act(() => screen.getByLabelText('cellule 1,0').focus())
    expect(wrapper.style.opacity).toBe('1')
    act(() => trash.focus())
    expect(wrapper.style.opacity).toBe('1')
    await userEvent.click(trash)
    expect(h.onRemoveRow).toHaveBeenCalledWith(1)
  })

  it('sans en-tête : « avant la ligne 1 » et la corbeille de la ligne 1 coexistent, séparés', async () => {
    const h = setup()
    const before = screen.getByRole('button', { name: 'Insérer une ligne avant la ligne 1 du tableau 1' })
    const trash = screen.getByRole('button', { name: 'Supprimer la ligne 1 du tableau 1' })
    // Structure (jsdom has no layout): the before-+ is in its own box, not a flex sibling of the bin.
    expect(before.parentElement).not.toBe(trash.parentElement)
    expect(before.parentElement?.getAttribute('data-testid')).toBe('insert-before-first-row')
    expect(before.parentElement?.style.position).toBe('absolute')
    await userEvent.click(before)
    expect(h.onAddRow).toHaveBeenLastCalledWith(-1)
    await userEvent.click(screen.getByLabelText('cellule 0,0'))
    await userEvent.click(trash)
    expect(h.onRemoveRow).toHaveBeenCalledWith(0)
  })

  it('avec en-tête : un seul « avant la ligne 1 »', () => {
    setup({ renderHeader: c => <input aria-label={`en-tête ${c}`} /> })
    expect(screen.getAllByRole('button', { name: 'Insérer une ligne avant la ligne 1 du tableau 1' })).toHaveLength(1)
  })

  it('transmet data-testid à la racine de la grille', () => {
    setup({ 'data-testid': 'table-grid-0' })
    const grid = screen.getByTestId('table-grid-0')
    expect(grid.style.display).toBe('grid')
    expect(grid.querySelector('[data-cell="0,0"]')).not.toBeNull()
  })

  it('la corbeille de ligne supprime la ligne', async () => {
    const h = setup()
    await userEvent.click(screen.getByLabelText('cellule 1,0'))
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la ligne 2 du tableau 1' }))
    expect(h.onRemoveRow).toHaveBeenCalledWith(1)
  })

  it('l’en-tête est rendu avec data-cell="-1,c"', () => {
    setup({ renderHeader: c => <input aria-label={`en-tête ${c}`} /> })
    expect(screen.getByLabelText('en-tête 1').closest('[data-cell]')?.getAttribute('data-cell')).toBe('-1,1')
    expect(screen.getByLabelText('cellule 1,0').closest('[data-cell]')?.getAttribute('data-cell')).toBe('1,0')
  })

  it('une seule colonne / ligne : pas de corbeille', () => {
    setup({ rowCount: 1, columnCount: 1 })
    expect(screen.queryByRole('button', { name: /Supprimer/ })).toBeNull()
  })

  it('canAddColumn / canAddRow = false désactivent les « + » de l’axe, sans appel', async () => {
    const h = setup({ canAddColumn: false, canAddRow: false, addDisabledReason: { row: '12 lignes au maximum', column: '12 colonnes au maximum' } })
    const col = screen.getByRole('button', { name: 'Insérer une colonne après la colonne 1 du tableau 1' })
    const row = screen.getByRole('button', { name: 'Insérer une ligne après la ligne 1 du tableau 1' })
    expect(col).toHaveAttribute('aria-disabled', 'true')
    expect(row).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(col)
    await userEvent.click(row)
    await userEvent.click(screen.getByRole('button', { name: 'Insérer une colonne avant la colonne 1 du tableau 1' }))
    expect(h.onAddColumn).not.toHaveBeenCalled()
    expect(h.onAddRow).not.toHaveBeenCalled()
    // The hint carries the reason: focus the handle (a keyboard user's way in).
    act(() => col.focus())
    expect((await screen.findAllByText('12 colonnes au maximum')).length).toBeGreaterThan(0)
  })
})
