import { act, render, screen, waitFor, within } from '@testing-library/react'
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

vi.mock('mathlive', () => {
  if (!customElements.get('math-field')) {
    customElements.define('math-field', class extends HTMLElement {
      value = ''
      connectedCallback() { this.tabIndex = 0 }
      insert(fragment: string) { this.value += fragment.replace(/#[0?]/g, '') }
    })
  }
  return {}
})

describe('ExerciseWorkspace', () => {
  beforeEach(() => {
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null })
    useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' })
  })
  afterEach(() => vi.useRealTimers())

  it('invite à choisir un exercice, puis l\'affiche', async () => {
    await setup({ 'A/a.json': exo('Premier') })
    expect(screen.getByText(/Choisis un exercice/)).toBeInTheDocument()
    await open('A/a.json')
    expect(screen.getByLabelText("Titre de l'exercice")).toHaveValue('Premier')
    expect(screen.getByRole('contentinfo', { name: 'Zone de réponse' })).toBeInTheDocument()
  })

  it("n'écrit rien en ouvrant un fichier v1", async () => {
    const fs = await setup({ 'A/a.json': exo('Premier') })
    const before = fs.files.get('A/a.json')
    await open('A/a.json')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(fs.files.get('A/a.json')).toBe(before)
  })

  it('un fichier v1 est écrit en v2, avec son exercice, à la première modification', async () => {
    const fs = await setup({ 'A/a.json': JSON.stringify({ version: 1, id: 'a', titre: 'Premier', question: '4', page: '12', blocs: [], reponse: '' }) })
    await open('A/a.json')
    await userEvent.setup().type(screen.getByLabelText('Réponse'), 'x')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json')).toMatchObject({ version: 2, titre: 'Premier', exercices: [{ numero: '4', page: '12', reponse: 'x' }] })
  })

  it('enregistre après le délai, pas à chaque frappe', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.type(screen.getByLabelText('Page (facultatif)'), '42')
    expect(stored(fs, 'A/a.json').exercices).toBeUndefined()
    await act(async () => void (await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 50)))
    expect(stored(fs, 'A/a.json').exercices[0].page).toBe('42')
    expect(screen.getByRole('status')).toHaveTextContent('Enregistré')
  })

  it('écrit tout de suite en changeant d\'exercice, et le titre met l\'arbre à jour', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier'), 'A/b.json': exo('Second') })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Réponse'), 'x = 3')
    await user.clear(screen.getByLabelText("Titre de l'exercice"))
    await user.type(screen.getByLabelText("Titre de l'exercice"), 'Renommé')
    await open('A/b.json')
    expect(stored(fs, 'A/a.json')).toMatchObject({ titre: 'Renommé', exercices: [{ reponse: 'x = 3' }] })
    expect(screen.getByLabelText("Titre de l'exercice")).toHaveValue('Second')
    expect(useExerciseStore.getState().tree[0].exercises.map(e => e.titre)).toEqual(['Renommé', 'Second'])
  })

  it('signale un fichier illisible, et un échec d\'écriture', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    fs.writeText = async () => { throw new Error('disque plein') }
    await userEvent.setup().type(screen.getByLabelText('Réponse'), 'x')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(screen.getByRole('alert')).toHaveTextContent(/a échoué/)
  })

  it('les blocs ajoutés et réordonnés sont écrits dans le fichier', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ajouter un bloc Texte' }))
    await user.click(screen.getByRole('button', { name: 'Ajouter un bloc Calcul' }))
    await user.click(screen.getAllByRole('button', { name: 'Monter le bloc' })[1])
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices[0].blocs.map((b: { type: string }) => b.type)).toEqual(['calcul', 'texte'])
  })

  it('l\'énoncé de la question est écrit dans le fichier', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    await userEvent.setup().type(screen.getByLabelText("Énoncé de l'exercice"), 'Calcule 3 × 4')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices[0].enonce).toBe('Calcule 3 × 4')
  })

  it('les boutons d\'ajout de bloc sont dans la zone de travail, plus dans la barre d\'outils', async () => {
    await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    const add = screen.getByRole('group', { name: 'Ajouter un bloc' })
    expect(within(screen.getByRole('toolbar', { name: 'Outils' })).queryByRole('group', { name: 'Ajouter un bloc' })).toBeNull()
    expect(within(add).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual([
      'Ajouter un bloc Texte', 'Ajouter un bloc Calcul', 'Ajouter un bloc Tableau', 'Ajouter un bloc Équation',
    ])
  })

  it('le curseur passe dans le bloc qu\'on vient d\'ajouter', async () => {
    await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ajouter un bloc Texte' }))
    expect(screen.getByLabelText('Texte')).toHaveFocus()
  })

  it('la barre d\'outils insère un signe au curseur du champ actif, et ça s\'enregistre', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: 'Multiplié par' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Ajouter un bloc Calcul' }))
    const calcul = screen.getByLabelText('Calcul')
    await user.type(calcul, '34')
    await user.keyboard('{ArrowLeft}')
    await user.click(screen.getByRole('button', { name: 'Multiplié par' }))
    expect(calcul).toHaveValue('3×4')
    expect(calcul).toHaveFocus()
    await user.keyboard('2')
    expect(calcul).toHaveValue('3×24')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices[0].blocs[0].expression).toBe('3×24')
  })

  it('remplace la sélection, et fonctionne aussi dans la réponse finale', async () => {
    await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    const user = userEvent.setup()
    const reponse = screen.getByLabelText<HTMLTextAreaElement>('Réponse')
    await user.type(reponse, 'x ? 3')
    reponse.setSelectionRange(2, 3)
    await user.click(screen.getByRole('button', { name: 'Supérieur ou égal' }))
    expect(reponse).toHaveValue('x ≥ 3')
  })

  it('n\'écrit plus dans l\'ancien champ après un changement d\'exercice', async () => {
    await setup({ 'A/a.json': exo('Premier'), 'A/b.json': exo('Second') })
    await open('A/a.json')
    await userEvent.setup().click(screen.getByLabelText('Réponse'))
    await open('A/b.json')
    expect(screen.getByRole('button', { name: 'Plus' })).toBeDisabled()
  })

  it('la barre insère du LaTeX dans un champ de formule, et réserve les structures aux formules', async () => {
    const fs = await setup({ 'A/a.json': exo('Premier') })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Réponse'))
    expect(screen.getByRole('button', { name: 'Fraction' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Multiplié par' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Ajouter un bloc Équation' }))
    const etape = await screen.findByLabelText('Étape 1')
    await user.click(etape)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fraction' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Fraction' }))
    await user.click(screen.getByRole('button', { name: 'Multiplié par' }))
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices[0].blocs[0]).toMatchObject({ type: 'equation', etapes: [{ latex: '\\frac{}{}\\times ' }] })
  })
})
