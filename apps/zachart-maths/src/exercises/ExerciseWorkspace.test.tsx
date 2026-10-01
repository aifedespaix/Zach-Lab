import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseWorkspace } from './ExerciseWorkspace'
import { createMemoryFs } from './memoryFs'
import { useExerciseStore } from './useExerciseStore'
import { AUTOSAVE_DELAY_MS, useOpenExercise } from './useOpenExercise'

const exo = (titre: string) => JSON.stringify({ version: 1, id: titre, titre, question: '', page: '', blocs: [], reponse: '' })
const stored = (fs: ReturnType<typeof createMemoryFs>, path: string) => JSON.parse(fs.files.get(path)!)

async function setup(files: Record<string, string>) {
  const fs = createMemoryFs(files)
  render(<ExerciseWorkspace />)
  await act(async () => useExerciseStore.getState().init(fs))
  return fs
}
const open = (path: string | null) => act(async () => useExerciseStore.getState().select(path))

describe('ExerciseWorkspace', () => {
  beforeEach(() => {
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null })
    useOpenExercise.setState({ path: null, exercise: null, status: 'empty' })
  })
  afterEach(() => vi.useRealTimers())

  it('invite à choisir un exercice, puis l\'affiche', async () => {
    await setup({ 'A/a.json': exo('Premier') })
    expect(screen.getByText(/Choisis un exercice/)).toBeInTheDocument()
    await open('A/a.json')
    expect(screen.getByLabelText("Titre de l'exercice")).toHaveValue('Premier')
    expect(screen.getByRole('contentinfo', { name: 'Zone de réponse' })).toBeInTheDocument()
  })

  it('enregistre après le délai, pas à chaque frappe', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.type(screen.getByLabelText('Page (facultatif)'), '42')
    expect(stored(fs, 'A/a.json').page).toBe('')
    await act(async () => void (await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 50)))
    expect(stored(fs, 'A/a.json').page).toBe('42')
    expect(screen.getByRole('status')).toHaveTextContent('Enregistré')
  })

  it('écrit tout de suite en changeant d\'exercice, et le titre met l\'arbre à jour', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier'), 'A/b.json': exo('Second') })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Réponse finale'), 'x = 3')
    await user.clear(screen.getByLabelText("Titre de l'exercice"))
    await user.type(screen.getByLabelText("Titre de l'exercice"), 'Renommé')
    await open('A/b.json')
    expect(stored(fs, 'A/a.json')).toMatchObject({ reponse: 'x = 3', titre: 'Renommé' })
    expect(screen.getByLabelText("Titre de l'exercice")).toHaveValue('Second')
    expect(useExerciseStore.getState().tree[0].exercises.map(e => e.titre)).toEqual(['Renommé', 'Second'])
  })

  it('signale un fichier illisible, et un échec d\'écriture', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    fs.writeText = async () => { throw new Error('disque plein') }
    await userEvent.setup().type(screen.getByLabelText('Réponse finale'), 'x')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(screen.getByRole('alert')).toHaveTextContent(/a échoué/)
  })
})
