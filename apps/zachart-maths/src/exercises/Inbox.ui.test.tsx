import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@suite/shared/ui'
import '../commands'
import { beforeEach, describe, expect, it } from 'vitest'
import { ExerciseWorkspace } from './ExerciseWorkspace'
import { MoveExerciseDialog, useMoveExerciseDialog } from './MoveExerciseDialog'
import { NewSheetDialog, useNewSheetDialog } from './NewSheetDialog'
import { SheetOutline } from './SheetOutline'
import { INBOX_PATH } from './library'
import { createMemoryFs } from './memoryFs'
import { useExerciseStore } from './useExerciseStore'
import { useOpenExercise } from './useOpenExercise'

const sheetFile = (titre: string, exercices: object[]) => JSON.stringify({ version: 2, id: titre, titre, exercices })
const ex = (id: string, extra: object = {}) => ({ id, numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '', ...extra })
const stored = (fs: ReturnType<typeof createMemoryFs>, path: string) => JSON.parse(fs.files.get(path)!)

async function setup(files: Record<string, string> = {}) {
  const fs = createMemoryFs(files)
  render(<TooltipProvider><ExerciseWorkspace /><SheetOutline /><NewSheetDialog /><MoveExerciseDialog /></TooltipProvider>)
  await act(async () => useExerciseStore.getState().init(fs))
  return { fs, user: userEvent.setup() }
}

describe('Non classé et déplacement', () => {
  beforeEach(() => {
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, recent: [], error: null })
    useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' })
  })

  it('« Nouvelle fiche » sans nom crée un exercice dans « Non classé » et l’ouvre', async () => {
    const { user } = await setup()
    expect(useExerciseStore.getState().tree[0].name).toBe('Non classé')
    await act(async () => useNewSheetDialog.getState().openFor())
    await user.click(await screen.findByRole('button', { name: 'Créer un exercice non classé' }))
    await waitFor(() => expect(useExerciseStore.getState().selected).toBe(INBOX_PATH))
    expect(await screen.findByLabelText("Énoncé de l'exercice")).toBeInTheDocument()
  })

  it('déplace un exercice vers une nouvelle fiche, et la fiche d’origine le perd', async () => {
    const { fs, user } = await setup({ 'A/a.json': sheetFile('Fiche', [ex('e1', { enonce: 'Un' }), ex('e2', { enonce: 'Deux' })]) })
    await act(async () => useExerciseStore.getState().select('A/a.json'))
    await waitFor(() => expect(useOpenExercise.getState().sheet).not.toBeNull())
    await act(async () => useMoveExerciseDialog.getState().openFor('e2'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Nouvelle fiche' }))
    await user.type(within(dialog).getByLabelText('Nom de la nouvelle fiche'), 'Rangés')
    await user.click(within(dialog).getByRole('button', { name: 'Déplacer' }))
    await waitFor(() => expect(fs.files.has('A/Rangés.json')).toBe(true))
    expect(stored(fs, 'A/Rangés.json').exercices.map((e: { enonce: string }) => e.enonce)).toEqual(['Deux'])
    await waitFor(() => expect(useOpenExercise.getState().sheet!.exercices.map(e => e.id)).toEqual(['e1']))
  })
})
