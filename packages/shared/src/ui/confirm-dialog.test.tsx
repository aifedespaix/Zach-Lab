import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'

const setup = (open = true) => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(<ConfirmDialog open={open} title="Supprimer ?" description="C'est définitif." onConfirm={onConfirm} onCancel={onCancel} />)
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('montre le titre et la description', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Supprimer ?' })).toHaveTextContent("C'est définitif.")
  })
  it('ne rend rien tant qu\'il est fermé', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('confirme avec le bouton destructif, annule avec « Annuler » et avec Échap', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = setup()
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
  it('met le focus sur le bouton de confirmation : Entrée accepte', async () => {
    const user = userEvent.setup()
    const { onConfirm } = setup()
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
