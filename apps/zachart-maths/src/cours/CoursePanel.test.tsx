import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
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

describe('CoursePanel', () => {
  beforeEach(() => {
    localStorage.clear()
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null })
    useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' })
    useCoursesStore.setState({ selectedId: null, searchOpen: false, notesVisible: true })
  })

  it('sans exercice : pas de suggestion, une invite, des notes désactivées', async () => {
    await setup()
    expect(screen.queryByRole('group', { name: 'Cours suggérés' })).not.toBeInTheDocument()
    expect(screen.getByText(/Choisis un cours suggéré/)).toBeInTheDocument()
    expect(screen.getByLabelText('Mes notes')).toBeDisabled()
  })

  it('suggère les cours du chapitre de l\'exercice ouvert, et un clic l\'affiche avec ses formules', async () => {
    const { user } = await setup({ 'Fractions/a.json': exo('Calculs') })
    await open('Fractions/a.json')
    const group = await screen.findByRole('group', { name: 'Cours suggérés' })
    expect(within(group).getAllByRole('button').map(b => b.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Additionner'), expect.stringContaining('Multiplier')]),
    )
    expect(within(group).getAllByText(/même chapitre/).length).toBeGreaterThan(0)
    await user.click(within(group).getByRole('button', { name: /Additionner/ }))
    const article = screen.getByRole('article', { name: /Additionner et soustraire/ })
    expect(article.querySelector('.katex')).not.toBeNull()
  })

  it('les suggestions suivent le contenu de l\'exercice, pas seulement son chapitre', async () => {
    const eq = { blocs: [{ id: 'q', type: 'equation', etapes: [{ id: 's', action: '', latex: 'BC^2=AB^2+AC^2' }] }] }
    await setup({ 'Chapitre 3/a.json': exo('Triangle rectangle et hypoténuse', eq) })
    await open('Chapitre 3/a.json')
    const group = await screen.findByRole('group', { name: 'Cours suggérés' })
    expect(within(group).getByRole('button', { name: /Pythagore/ })).toBeInTheDocument()
  })

  it('la modale cherche un cours : taper, Entrée, et le cours s\'ouvre', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: /Chercher un cours/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Tous les cours')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Rechercher un cours'), 'pitagore{Enter}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('article', { name: /Pythagore/ })).toBeInTheDocument()
  })

  it('la modale dit quand rien ne correspond', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: /Chercher un cours/ }))
    await user.type(await screen.findByLabelText('Rechercher un cours'), 'zzzzqx')
    expect(screen.getByText(/Aucun cours ne correspond/)).toBeInTheDocument()
  })

  it('les notes s\'écrivent dans le fichier de l\'exercice', async () => {
    const { fs, user } = await setup({ 'A/a.json': exo('Un') })
    await open('A/a.json')
    await user.type(screen.getByLabelText('Mes notes'), 'penser au dénominateur')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(JSON.parse(fs.files.get('A/a.json')!).exercices[0].notes).toBe('penser au dénominateur')
  })

  it('masquer les notes donne toute la place aux cours, et le choix est retenu', async () => {
    const { user } = await setup()
    expect(screen.getByRole('region', { name: 'Notes' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Masquer les notes' }))
    expect(screen.queryByRole('region', { name: 'Notes' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notes' })).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('zachart-maths:notes-visible')).toBe('false')
    await user.click(screen.getByRole('button', { name: 'Notes' }))
    expect(screen.getByRole('region', { name: 'Notes' })).toBeInTheDocument()
  })
})
