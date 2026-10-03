import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExerciseWorkspace } from './ExerciseWorkspace'
import { createMemoryFs } from './memoryFs'
import { useExerciseStore } from './useExerciseStore'
import { AUTOSAVE_DELAY_MS, useOpenExercise } from './useOpenExercise'

const exo = (titre: string) => JSON.stringify({ version: 1, id: titre, titre, question: '', page: '', blocs: [], reponse: '' })
const sheetFile = (titre: string, exercices: object[]) => JSON.stringify({ version: 2, id: titre, titre, exercices })
const ex = (id: string, extra: object = {}) => ({ id, numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '', ...extra })
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

  it("affiche la position dans la fiche et passe d'un exercice à l'autre", async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Premier énoncé' }), ex('2', { enonce: 'Second énoncé' })]) })
    await open('A/a.json')
    const user = userEvent.setup()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Premier énoncé')
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Second énoncé')
    await user.click(screen.getByRole('button', { name: 'Exercice précédent' }))
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Premier énoncé')
  })

  it("« suivant » au dernier exercice en crée un après, et il est écrit dans le fichier", async () => {
    const fs = await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Écrit' })]) })
    await open('A/a.json')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Exercice suivant' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices.map((e: { enonce: string }) => e.enonce)).toEqual(['Écrit', ''])
  })

  it("« précédent » au premier exercice en crée un avant", async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Écrit' })]) })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Exercice précédent' }))
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Écrit')
  })

  it("les flèches au bord sont désactivées tant que l'exercice affiché est vierge", async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1')]) })
    await open('A/a.json')
    expect(screen.getByRole('button', { name: 'Exercice précédent' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Exercice suivant' })).toBeDisabled()
    await userEvent.setup().type(screen.getByLabelText("Énoncé de l'exercice"), 'x')
    expect(screen.getByRole('button', { name: 'Exercice suivant' })).toBeEnabled()
  })

  it("« Nouvel exercice », dans la zone de réponse du dernier exercice, ajoute à la fin et s'y place", async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1'), ex('2', { enonce: 'Q2' })]) })
    await open('A/a.json')
    const user = userEvent.setup()
    // Avant le dernier, le bouton du bas passe à l'exercice suivant : il ne crée rien.
    expect(screen.queryByRole('button', { name: 'Nouvel exercice' })).toBeNull()
    await user.click(screen.getByRole('button', { name: "Passer à l'exercice suivant" }))
    await user.click(screen.getByRole('button', { name: 'Nouvel exercice' }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('le numéro vide est remplacé par la position, et un numéro saisi est écrit', async () => {
    const fs = await setup({ 'A/a.json': sheetFile('Fiche', [ex('1'), ex('2')]) })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    const numero = screen.getByLabelText("Numéro de l'exercice (facultatif)")
    expect(numero).toHaveAttribute('placeholder', '2')
    await user.type(numero, '3.b')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices[1].numero).toBe('3.b')
  })

  it("supprime l'exercice affiché après confirmation, et affiche le suivant", async () => {
    const fs = await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Un' }), ex('2', { enonce: 'Deux' }), ex('3', { enonce: 'Trois' })]) })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    await user.click(screen.getByRole('button', { name: "Supprimer l'exercice" }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Trois')
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices.map((e: { id: string }) => e.id)).toEqual(['1', '3'])
  })

  it('annuler la confirmation ne supprime rien ; le dernier exercice affiché laisse le précédent', async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Un' }), ex('2', { enonce: 'Deux' })]) })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    await user.click(screen.getByRole('button', { name: "Supprimer l'exercice" }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: "Supprimer l'exercice" }))
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveValue('Un')
  })

  it("ne propose pas de supprimer l'unique exercice d'une fiche", async () => {
    await setup({ 'A/a.json': sheetFile('Fiche', [ex('1')]) })
    await open('A/a.json')
    expect(screen.getByRole('button', { name: "Supprimer l'exercice" })).toBeDisabled()
  })

  it("écrit l'exercice courant en changeant de fichier", async () => {
    const fs = await setup({ 'A/a.json': sheetFile('Fiche', [ex('1', { enonce: 'Un' }), ex('2')]), 'A/b.json': sheetFile('Autre', [ex('x')]) })
    await open('A/a.json')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }))
    await user.type(screen.getByLabelText('Réponse'), '42')
    await open('A/b.json')
    expect(stored(fs, 'A/a.json').exercices[1].reponse).toBe('42')
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
    const etape = await screen.findByLabelText("Membre gauche de l'étape 1")
    await user.click(etape)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fraction' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Fraction' }))
    await user.click(screen.getByRole('button', { name: 'Multiplié par' }))
    await act(async () => void (await useOpenExercise.getState().flush()))
    expect(stored(fs, 'A/a.json').exercices[0].blocs[0]).toMatchObject({ type: 'equation', etapes: [{ left: '\\frac{}{}\\times ' }] })
  })

  describe('deux zones et zone de réponse', () => {
    const twoExercises = () => ({
      'Ch/f.json': sheetFile('F', [ex('e1', { enonce: 'Q1', blocs: [{ id: 'b1', type: 'texte', contenu: 'x' }] }), ex('e2')]),
    })

    it('« scinder » crée la zone de droite vide ; « réunir » remet ses blocs à la suite', async () => {
      const user = userEvent.setup()
      await setup(twoExercises())
      await open('Ch/f.json')
      await user.click(await screen.findByRole('button', { name: 'Scinder la zone de travail en deux' }))
      expect(useOpenExercise.getState().exercise!.blocsB).toEqual([])
      expect(screen.getByRole('group', { name: 'Zone de travail de droite' })).toBeInTheDocument()
      act(() => useOpenExercise.getState().edit({ blocsB: [{ id: 'b2', type: 'texte', contenu: 'y' }] }))
      await user.click(screen.getByRole('button', { name: 'Réunir les zones de travail' }))
      const e = useOpenExercise.getState().exercise!
      expect(e.blocs.map(b => (b as { id: string }).id)).toEqual(['b1', 'b2'])
      expect(e.blocsB).toBeUndefined()
    })

    it("la zone de droite vide garde ses boutons d'ajout", async () => {
      const user = userEvent.setup()
      await setup(twoExercises())
      await open('Ch/f.json')
      await user.click(await screen.findByRole('button', { name: 'Scinder la zone de travail en deux' }))
      const right = screen.getByRole('group', { name: 'Zone de travail de droite' })
      await user.click(within(right).getByRole('button', { name: 'Ajouter un bloc Texte' }))
      expect(useOpenExercise.getState().exercise!.blocsB).toHaveLength(1)
      expect(useOpenExercise.getState().exercise!.blocs).toHaveLength(1)
    })

    it("le bouton du bas passe au suivant, puis crée un exercice au dernier, curseur dans l'énoncé", async () => {
      const user = userEvent.setup()
      await setup(twoExercises())
      await open('Ch/f.json')
      await user.click(await screen.findByRole('button', { name: "Passer à l'exercice suivant" }))
      expect(useOpenExercise.getState().currentId).toBe('e2')
      // e2 est vierge au dernier rang : rien à créer par-dessus, le bouton est désactivé
      expect(screen.getByRole('button', { name: 'Nouvel exercice' })).toBeDisabled()
      await user.type(screen.getByLabelText("Énoncé de l'exercice"), 'Q2')
      await user.click(screen.getByRole('button', { name: 'Nouvel exercice' }))
      expect(useOpenExercise.getState().sheet!.exercices).toHaveLength(3)
      await waitFor(() => expect(screen.getByLabelText("Énoncé de l'exercice")).toHaveFocus())
    })

    it("le bouton « Nouvel exercice » n'est plus dans l'en-tête", async () => {
      await setup(twoExercises())
      await open('Ch/f.json')
      await screen.findByRole('button', { name: 'Exercice suivant' })
      expect(within(document.querySelector('header')!).queryByRole('button', { name: 'Nouvel exercice' })).toBeNull()
    })
  })
})
