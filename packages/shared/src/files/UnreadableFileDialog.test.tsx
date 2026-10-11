import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UnreadableFileDialog } from './UnreadableFileDialog'

const base = {
  message: 'Impossible d’ouvrir ce fichier.',
  fileName: 'carte.zmap',
  repairedFileName: 'carte (réparée).zmap',
  issueLines: ['élément 3 : parent introuvable'],
  repairing: false,
  error: null,
  onCancel: vi.fn(),
  onRepair: vi.fn(),
}

describe('UnreadableFileDialog', () => {
  it('affiche le message de l’app, les fichiers et les problèmes', () => {
    render(<UnreadableFileDialog {...base} />)
    expect(screen.getByText('Impossible d’ouvrir ce fichier.')).toBeInTheDocument()
    expect(screen.getByText('carte.zmap')).toBeInTheDocument()
    expect(screen.getByText('carte (réparée).zmap')).toBeInTheDocument()
    expect(screen.getByText('élément 3 : parent introuvable')).toBeInTheDocument()
    expect(screen.getByText(/L’original ne sera pas modifié/)).toBeInTheDocument()
  })

  it('l’action de réparation a le focus à l’ouverture', () => {
    render(<UnreadableFileDialog {...base} />)
    expect(screen.getByRole('button', { name: 'Créer une copie réparée' })).toHaveFocus()
  })

  it('appelle onRepair puis onCancel', async () => {
    const user = userEvent.setup()
    const onRepair = vi.fn()
    const onCancel = vi.fn()
    render(<UnreadableFileDialog {...base} onRepair={onRepair} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Créer une copie réparée' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onRepair).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pendant la réparation, les deux boutons sont désactivés', () => {
    render(<UnreadableFileDialog {...base} repairing />)
    expect(screen.getByRole('button', { name: 'Réparation…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
  })

  it('montre un échec de réparation sur place', () => {
    render(<UnreadableFileDialog {...base} error="Écriture refusée" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Écriture refusée')
  })

  it('accepte le libellé et le détail propres à l’app', () => {
    render(
      <UnreadableFileDialog
        {...base}
        repairLabel="Réparer"
        repairDetail="les éléments valides gardent leur place"
      />,
    )
    expect(screen.getByRole('button', { name: 'Réparer' })).toBeInTheDocument()
    expect(screen.getByText(/les éléments valides gardent leur place/)).toBeInTheDocument()
  })
})
