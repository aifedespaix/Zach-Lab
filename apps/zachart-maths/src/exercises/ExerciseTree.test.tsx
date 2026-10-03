import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { runCommand } from '@suite/shared/commands'
import '../commands'
import { ExerciseTree } from './ExerciseTree'
import { createMemoryFs } from './memoryFs'
import { useExerciseStore } from './useExerciseStore'

async function setup(files: Record<string, string> = {}) {
  const fs = createMemoryFs(files)
  render(<ExerciseTree />)
  await act(async () => useExerciseStore.getState().init(fs))
  return { fs, user: userEvent.setup() }
}

describe('ExerciseTree', () => {
  beforeEach(() => useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null }))

  it('invite à créer un premier chapitre quand le dossier est vide', async () => {
    await setup()
    expect(screen.getByText(/Aucun chapitre/)).toBeInTheDocument()
  })

  it('crée un chapitre puis un exercice, et ouvre l\'exercice', async () => {
    const { user } = await setup()
    await act(async () => void runCommand('tree.newChapter'))
    await user.type(screen.getByLabelText('Nom du nouveau chapitre'), 'Fractions{Enter}')
    expect(await screen.findByRole('button', { name: /Fractions/ })).toBeInTheDocument()

    await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('button', { name: /Fractions/ }) })
    await user.click(await screen.findByRole('menuitem', { name: /Nouvel exercice/ }))
    await user.type(screen.getByLabelText('Titre du nouvel exercice'), 'Exo 1{Enter}')

    const exo = await screen.findByRole('button', { name: 'Exo 1' })
    expect(exo).toHaveAttribute('aria-current', 'true')
    expect(useExerciseStore.getState().selected).toBe('Fractions/Exo 1.json')
  })

  it('le clic sur un exercice le sélectionne', async () => {
    const exo = JSON.stringify({ version: 1, id: 'a', titre: 'Premier' })
    const { user } = await setup({ 'Algèbre/p.json': exo })
    await user.click(await screen.findByRole('button', { name: 'Premier' }))
    expect(useExerciseStore.getState().selected).toBe('Algèbre/p.json')
  })

  it('demande confirmation avant de supprimer, et vide la sélection', async () => {
    const exo = JSON.stringify({ version: 1, id: 'a', titre: 'Premier' })
    const { fs, user } = await setup({ 'Algèbre/p.json': exo })
    await user.click(await screen.findByRole('button', { name: 'Premier' }))
    await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('button', { name: 'Premier' }) })
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))
    const dialog = await screen.findByRole('dialog')
    expect(fs.files.has('Algèbre/p.json')).toBe(true)
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(fs.files.has('Algèbre/p.json')).toBe(false))
    expect(useExerciseStore.getState().selected).toBeNull()
  })

  it("annonce le nombre d'exercices avant de supprimer un fichier", async () => {
    const fiche = JSON.stringify({ version: 2, id: 'a', titre: 'Fiche', exercices: [{ id: '1' }, { id: '2' }, { id: '3' }] })
    const { user } = await setup({ 'Algèbre/f.json': fiche })
    await user.pointer({ keys: '[MouseRight]', target: await screen.findByRole('button', { name: 'Fiche' }) })
    await user.click(await screen.findByRole('menuitem', { name: 'Supprimer' }))
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer ce fichier ?' })
    expect(dialog).toHaveTextContent('« Fiche » et ses 3 exercice(s)')
  })

  it('montre un exercice illisible sans pouvoir l\'ouvrir, et signale un nom refusé', async () => {
    const { user } = await setup({ 'A/x.json': '{cassé' })
    await user.click(await screen.findByRole('button', { name: 'x' }))
    expect(useExerciseStore.getState().selected).toBeNull()

    await act(async () => void runCommand('tree.newChapter'))
    await user.type(screen.getByLabelText('Nom du nouveau chapitre'), '..{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(/pas utilisable/)
  })

  it('« tree.toggleAll » replie puis déplie tous les chapitres', async () => {
    const exo = JSON.stringify({ version: 1, id: 'a', titre: 'Exo 1' })
    await setup({ 'Algèbre/p.json': exo })
    expect(await screen.findByText('Exo 1')).toBeInTheDocument()
    await act(async () => void runCommand('tree.toggleAll'))
    expect(screen.queryByText('Exo 1')).toBeNull()
    await act(async () => void runCommand('tree.toggleAll'))
    expect(screen.getByText('Exo 1')).toBeInTheDocument()
  })

  it('« tree.newChapter » ouvre le champ de nom', async () => {
    await setup()
    await act(async () => void runCommand('tree.newChapter'))
    expect(screen.getByLabelText('Nom du nouveau chapitre')).toBeInTheDocument()
  })

  it('montre le champ de recherche en tête de l’arborescence', async () => {
    await setup()
    expect(screen.getByRole('textbox', { name: 'Rechercher un exercice' })).toBeInTheDocument()
  })

  it('« tree.toggleAll » ignore les noms périmés d’un chapitre renommé', async () => {
    const mk = (t: string) => JSON.stringify({ version: 1, id: t, titre: t })
    const { user } = await setup({ 'A/a.json': mk('ExoA'), 'B/b.json': mk('ExoB') })
    await user.click(await screen.findByRole('button', { name: /^A$/ }))
    await user.click(screen.getByRole('button', { name: /^B$/ }))
    await act(async () => void (await useExerciseStore.getState().renameChapter('A', 'C')))
    expect(await screen.findByText('ExoA')).toBeInTheDocument()
    await act(async () => void runCommand('tree.toggleAll'))
    expect(screen.queryByText('ExoA')).toBeNull()
    expect(screen.queryByText('ExoB')).toBeNull()
  })
})
