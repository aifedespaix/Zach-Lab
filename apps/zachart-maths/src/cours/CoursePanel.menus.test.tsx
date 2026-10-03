import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCommandRegistry } from '@suite/shared/commands'
import { createMemoryFs } from '../exercises/memoryFs'
import { useExerciseStore } from '../exercises/useExerciseStore'
import { useOpenExercise } from '../exercises/useOpenExercise'
import { CoursePanel } from './CoursePanel'
import { useCoursesStore } from './useCoursesStore'

const exo = (titre: string, extra: object = {}) => JSON.stringify({ version: 1, id: titre, titre, ...extra })

async function setup(files: Record<string, string> = {}) {
  const fs = createMemoryFs(files)
  render(<CoursePanel />)
  await act(async () => useExerciseStore.getState().init(fs))
  return { fs, user: userEvent.setup() }
}
const open = (path: string | null) => act(async () => useExerciseStore.getState().select(path))
const item = (name: RegExp) => screen.findByRole('menuitem', { name })

describe('clic droit sur le panneau des cours', () => {
  beforeEach(() => {
    localStorage.clear()
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null })
    useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' })
    useCoursesStore.setState({ selectedId: null, searchOpen: false, notesVisible: true })
  })

  it('sur le vide : « Chercher un cours » ouvre la recherche', async () => {
    const { user } = await setup()
    fireEvent.contextMenu(screen.getByTestId('cours-vide'))
    await user.click(await item(/Chercher un cours/))
    expect(useCoursesStore.getState().searchOpen).toBe(true)
  })

  it('« Masquer les notes » / « Afficher les notes » suit l’état', async () => {
    const { user } = await setup()
    fireEvent.contextMenu(screen.getByTestId('cours-vide'))
    await user.click(await item(/Masquer les notes/))
    expect(useCoursesStore.getState().notesVisible).toBe(false)
    fireEvent.contextMenu(screen.getByTestId('cours-vide'))
    expect(await item(/Afficher les notes/)).toBeInTheDocument()
  })

  it('« Ranger le panneau » appelle la commande de rangement', async () => {
    const calls: number[] = []
    const registration = { run: () => void calls.push(1), enabled: true }
    useCommandRegistry.getState().register('view.toggleCourses', registration)
    const { user } = await setup()
    fireEvent.contextMenu(screen.getByTestId('cours-vide'))
    await user.click(await item(/Ranger le panneau/))
    expect(calls).toHaveLength(1)
    useCommandRegistry.getState().unregister('view.toggleCourses', registration)
  })

  it('sur un cours suggéré : ouvrir, copier le titre ; pas le menu du vide', async () => {
    const { user } = await setup({ 'Fractions/a.json': exo('Calculs') })
    await open('Fractions/a.json')
    const group = await screen.findByRole('group', { name: 'Cours suggérés' })
    const row = within(group).getAllByRole('button')[0]
    fireEvent.contextMenu(row)
    await item(/Copier le titre/)
    expect(screen.queryByRole('menuitem', { name: /Chercher un cours/ })).toBeNull()
    await user.click(screen.getByRole('menuitem', { name: /Copier le titre/ }))
    // `userEvent.setup()` installe son propre presse-papiers : on y relit ce que le menu a copié.
    const copied = await navigator.clipboard.readText()
    expect(copied).not.toBe('')
    expect(row.textContent).toContain(copied)
    fireEvent.contextMenu(row)
    await user.click(await item(/Ouvrir/))
    expect(useCoursesStore.getState().selectedId).not.toBeNull()
  })

  it('dans les notes : le menu de champ, plus « Masquer les notes »', async () => {
    await setup()
    fireEvent.contextMenu(screen.getByLabelText('Mes notes'))
    expect(await item(/Copier/)).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Masquer les notes/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Chercher un cours/ })).toBeNull()
  })
})
