import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCommandRegistry } from '@suite/shared/commands'
import { ExerciseTree } from './ExerciseTree'
import { createMemoryFs } from './memoryFs'
import { useExerciseStore } from './useExerciseStore'

async function setup(files: Record<string, string> = {}) {
  const fs = createMemoryFs(files)
  render(<ExerciseTree />)
  await act(async () => useExerciseStore.getState().init(fs))
  return { fs, user: userEvent.setup() }
}

const fiche = (titre: string) =>
  JSON.stringify({ version: 2, id: titre, titre, exercices: [{ id: 'e', numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '' }] })
const twoChapters = () => ({ 'A/un.json': fiche('Un'), 'B/deux.json': fiche('Deux') })
const item = (name: RegExp) => screen.findByRole('menuitem', { name })

describe("clic droit sur l'arbre", () => {
  beforeEach(() => useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null }))

  it('sur le vide : nouveau chapitre, tout replier, tout déplier, ranger le panneau', async () => {
    await setup(twoChapters())
    fireEvent.contextMenu(screen.getByTestId('arbre-vide'))
    expect(await item(/Nouveau chapitre/)).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Tout replier/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Tout déplier/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Ranger le panneau/ })).toBeInTheDocument()
  })

  it('« Tout replier » cache les fichiers, « Tout déplier » les rend', async () => {
    const { user } = await setup(twoChapters())
    expect(await screen.findByText('Un')).toBeInTheDocument()
    fireEvent.contextMenu(screen.getByTestId('arbre-vide'))
    await user.click(await item(/Tout replier/))
    expect(screen.queryByText('Un')).toBeNull()
    fireEvent.contextMenu(screen.getByTestId('arbre-vide'))
    await user.click(await item(/Tout déplier/))
    expect(screen.getByText('Un')).toBeInTheDocument()
  })

  it('« Nouveau chapitre » ouvre le champ de nom', async () => {
    const { user } = await setup(twoChapters())
    fireEvent.contextMenu(screen.getByTestId('arbre-vide'))
    await user.click(await item(/Nouveau chapitre/))
    expect(screen.getByLabelText('Nom du nouveau chapitre')).toBeInTheDocument()
  })

  it('sur un chapitre : replier / déplier, et pas le menu du vide', async () => {
    const { user } = await setup(twoChapters())
    fireEvent.contextMenu(await screen.findByRole('button', { name: 'A' }))
    await user.click(await item(/^Replier$/))
    expect(screen.queryByText('Un')).toBeNull()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'A' }))
    expect(await item(/^Déplier$/)).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Tout replier/ })).toBeNull()
  })

  it('sur un fichier : « Dupliquer » crée la copie et la sélectionne ; grisé pour un fichier illisible', async () => {
    const { user } = await setup({ ...twoChapters(), 'A/cassé.json': '{pas du json' })
    fireEvent.contextMenu(await screen.findByRole('button', { name: /^Un/ }))
    await user.click(await item(/Dupliquer/))
    await waitFor(() => expect(useExerciseStore.getState().selected).toBe('A/un (copie).json'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.contextMenu(await screen.findByRole('button', { name: /cassé/ }))
    expect(await item(/Dupliquer/)).toHaveAttribute('aria-disabled', 'true')
  })

  it('« Ranger le panneau » du vide appelle la commande de rangement', async () => {
    const calls: number[] = []
    const registration = { run: () => void calls.push(1), enabled: true }
    useCommandRegistry.getState().register('view.toggleTree', registration)
    const { user } = await setup(twoChapters())
    fireEvent.contextMenu(screen.getByTestId('arbre-vide'))
    await user.click(await item(/Ranger le panneau/))
    expect(calls).toHaveLength(1)
    useCommandRegistry.getState().unregister('view.toggleTree', registration)
  })
})
