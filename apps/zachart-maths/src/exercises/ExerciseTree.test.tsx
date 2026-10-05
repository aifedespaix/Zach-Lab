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

  it('met le focus sur le champ de nom dès la création', async () => {
    await setup()
    await act(async () => void runCommand('tree.newChapter'))
    await waitFor(() => expect(screen.getByLabelText('Nom du nouveau chapitre')).toHaveFocus())
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
  describe('recherche', () => {
    const mk = (t: string) => JSON.stringify({ version: 1, id: t, titre: t })
    const files = { 'Fractions/a.json': mk('Additionner'), 'Géométrie/c.json': mk('Théorème de Pythagore') }

    it('filtre l’arbre pendant la frappe et le rétablit en effaçant', async () => {
      const { user } = await setup(files)
      expect(await screen.findByText('Additionner')).toBeInTheDocument()
      const box = screen.getByRole('textbox', { name: 'Rechercher un exercice' })
      await user.type(box, 'pyth')
      expect(screen.getByText('Théorème de Pythagore')).toBeInTheDocument()
      expect(screen.queryByText('Additionner')).toBeNull()
      expect(screen.queryByRole('button', { name: /Fractions/ })).toBeNull()
      await user.clear(box)
      expect(screen.getByText('Additionner')).toBeInTheDocument()
      expect(screen.getByText('Théorème de Pythagore')).toBeInTheDocument()
    })

    it('ouvre le chapitre d’un résultat sans toucher à l’état replié réel', async () => {
      const { user } = await setup(files)
      await user.click(await screen.findByRole('button', { name: /^Géométrie$/ }))
      expect(screen.queryByText('Théorème de Pythagore')).toBeNull()
      const box = screen.getByRole('textbox', { name: 'Rechercher un exercice' })
      await user.type(box, 'pyth')
      expect(screen.getByText('Théorème de Pythagore')).toBeInTheDocument()
      await user.clear(box)
      expect(screen.queryByText('Théorème de Pythagore')).toBeNull()
    })

    it('sans résultat : message dédié, pas « Aucun chapitre »', async () => {
      const { user } = await setup(files)
      await screen.findByText('Additionner')
      await user.type(screen.getByRole('textbox', { name: 'Rechercher un exercice' }), 'zzzzzz')
      expect(screen.getByRole('status')).toHaveTextContent('Aucun résultat pour « zzzzzz ».')
      expect(screen.queryByText(/Aucun chapitre/)).toBeNull()
    })

    it('pendant une recherche, Monter/Descendre suivent la position RÉELLE du chapitre', async () => {
      const { user } = await setup({ 'A/a.json': mk('Alpha'), 'B/b.json': mk('Beta'), 'C/c.json': mk('Gamma') })
      await screen.findByText('Alpha')
      await user.type(screen.getByRole('textbox', { name: 'Rechercher un exercice' }), 'Gamma')
      await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('button', { name: /^C$/ }) })
      expect(await screen.findByRole('menuitem', { name: 'Monter' })).not.toHaveAttribute('data-disabled')
      expect(screen.getByRole('menuitem', { name: 'Descendre' })).toHaveAttribute('data-disabled')
    })

    it('pendant une recherche, Monter/Descendre d’un exercice suivent sa position réelle', async () => {
      const { user } = await setup({ 'A/a.json': mk('Un'), 'A/b.json': mk('Deux'), 'A/c.json': mk('Trois') })
      await screen.findByText('Un')
      await user.type(screen.getByRole('textbox', { name: 'Rechercher un exercice' }), 'Trois')
      await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('button', { name: 'Trois' }) })
      expect(await screen.findByRole('menuitem', { name: 'Monter' })).not.toHaveAttribute('data-disabled')
      expect(screen.getByRole('menuitem', { name: 'Descendre' })).toHaveAttribute('data-disabled')
    })

    it('créer un chapitre ou un exercice pendant une recherche la vide, pour que le nouvel élément se voie', async () => {
      const { user } = await setup(files)
      await screen.findByText('Additionner')
      const box = screen.getByRole('textbox', { name: 'Rechercher un exercice' })
      await user.type(box, 'pyth')
      await act(async () => void runCommand('tree.newChapter'))
      expect(box).toHaveValue('')
      await user.type(screen.getByLabelText('Nom du nouveau chapitre'), 'Zèbre{Enter}')
      expect(await screen.findByRole('button', { name: /Zèbre/ })).toBeInTheDocument()

      await user.type(box, 'pyth')
      await user.pointer({ keys: '[MouseRight]', target: screen.getByRole('button', { name: /Géométrie/ }) })
      await user.click(await screen.findByRole('menuitem', { name: /Nouvel exercice/ }))
      await user.type(screen.getByLabelText('Titre du nouvel exercice'), 'Nouveau{Enter}')
      expect(box).toHaveValue('')
      expect(await screen.findByRole('button', { name: 'Nouveau' })).toBeInTheDocument()
    })

    it('« Tout déplier » du vide se base sur les chapitres réels, pas sur des noms périmés', async () => {
      const { user } = await setup({ 'A/a.json': mk('ExoA') })
      await user.click(await screen.findByRole('button', { name: /^A$/ }))
      await act(async () => void (await useExerciseStore.getState().renameChapter('A', 'C')))
      await screen.findByRole('button', { name: /^C$/ })
      await user.pointer({ keys: '[MouseRight]', target: screen.getByTestId('arbre-vide') })
      expect(await screen.findByRole('menuitem', { name: /Tout déplier/ })).toHaveAttribute('data-disabled')
    })

    it('bibliothèque vide + recherche : pas de « Aucun chapitre », seulement « Aucun résultat »', async () => {
      const { user } = await setup()
      await user.type(screen.getByRole('textbox', { name: 'Rechercher un exercice' }), 'abc')
      expect(screen.queryByText(/Aucun chapitre/)).toBeNull()
    })
  })
})
