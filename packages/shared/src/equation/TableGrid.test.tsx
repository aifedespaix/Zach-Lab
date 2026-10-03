import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TableGrid } from './TableGrid'

function setup(over: Partial<React.ComponentProps<typeof TableGrid>> = {}) {
  const handlers = { onAddRow: vi.fn(), onAddColumn: vi.fn(), onRemoveRow: vi.fn(), onRemoveColumn: vi.fn() }
  render(
    <TableGrid
      tableLabel="1"
      rowCount={2}
      columnCount={2}
      renderCell={(r, c) => <input aria-label={`cellule ${r},${c}`} />}
      {...handlers}
      {...over}
    />,
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
})
