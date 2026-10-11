import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NewFileDialog } from './NewFileDialog'

const base = {
  open: true,
  title: 'Nouvelle fiche',
  nameLabel: 'Nom de la fiche',
  createLabel: 'Valider',
  onCancel: vi.fn(),
}

describe('NewFileDialog', () => {
  it('crée avec le nom saisi, sans espaces autour', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<NewFileDialog {...base} onCreate={onCreate} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Nom de la fiche' }), '  Fractions  ')
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    expect(onCreate).toHaveBeenCalledWith('Fractions')
  })

  it('Entrée crée aussi', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<NewFileDialog {...base} onCreate={onCreate} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Nom de la fiche' }), 'Fractions{Enter}')
    expect(onCreate).toHaveBeenCalledWith('Fractions')
  })

  it('désactive la création tant que le nom est vide ou que canCreate est faux', async () => {
    const { rerender } = render(<NewFileDialog {...base} onCreate={vi.fn()} canCreate={false} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Nom de la fiche' }), 'Fractions')
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled()
    rerender(<NewFileDialog {...base} onCreate={vi.fn()} canCreate />)
    expect(screen.getByRole('button', { name: 'Valider' })).toBeEnabled()
  })

  it('affiche l’erreur sur place et reste ouvert', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('existe déjà'))
    render(<NewFileDialog {...base} onCreate={onCreate} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Nom de la fiche' }), 'Fractions{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('existe déjà')
    expect(screen.getByRole('textbox', { name: 'Nom de la fiche' })).toBeInTheDocument()
  })

  it('ne lance pas deux créations de suite', async () => {
    let finish!: () => void
    const onCreate = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    render(<NewFileDialog {...base} onCreate={onCreate} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Nom de la fiche' }), 'Fractions{Enter}')
    await userEvent.keyboard('{Enter}')
    expect(onCreate).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Valider' })).toBeInTheDocument())
  })

  it('affiche les champs de l’app et le titre', () => {
    render(
      <NewFileDialog {...base} onCreate={vi.fn()}>
        <span>Chapitre : Géométrie</span>
      </NewFileDialog>,
    )
    expect(screen.getByRole('heading', { name: 'Nouvelle fiche' })).toBeInTheDocument()
    expect(screen.getByText('Chapitre : Géométrie')).toBeInTheDocument()
  })

  it('le nom a le focus à l’ouverture et Annuler appelle onCancel', async () => {
    const onCancel = vi.fn()
    render(<NewFileDialog {...base} onCancel={onCancel} onCreate={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Nom de la fiche' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('repart d’un formulaire vide à chaque ouverture', async () => {
    const { rerender } = render(<NewFileDialog {...base} open onCreate={vi.fn()} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Nom de la fiche' }), 'Brouillon')
    rerender(<NewFileDialog {...base} open={false} onCreate={vi.fn()} />)
    rerender(<NewFileDialog {...base} open onCreate={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: 'Nom de la fiche' })).toHaveValue('')
  })
})
