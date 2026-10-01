import { describe, expect, it } from 'vitest'
import {
  InvalidNameError, createChapter, createExercise, deleteChapter, deleteExercise, loadTree,
  moveChapter, moveExercise, readExercise, renameChapter, renameExercise,
} from './library'
import { createMemoryFs } from './memoryFs'
import { safeName, uniqueName } from './names'
import { validateExercise } from './types'

const titles = async (fs: ReturnType<typeof createMemoryFs>) =>
  (await loadTree(fs)).map(c => [c.name, c.exercises.map(e => e.titre)])

describe('names', () => {
  it('nettoie ce que tape l\'élève', () => {
    expect(safeName('  Équations: 1/2 ? ')).toBe('Équations 1 2')
    expect(safeName('..')).toBeNull()
    expect(safeName('_ordre')).toBeNull()
    expect(safeName('   ')).toBeNull()
    expect(safeName('CON')).toBeNull()
    expect(safeName('fin.')).toBe('fin')
  })
  it('choisit un nom libre sans tenir compte de la casse', () => {
    expect(uniqueName('Exo', ['exo', 'Exo 2'])).toBe('Exo 3')
  })
})

describe('validateExercise', () => {
  it('refuse ce qui n\'est pas un exercice, et un format plus récent', () => {
    expect(validateExercise(null)).toBeNull()
    expect(validateExercise({ titre: 'x' })).toBeNull()
    expect(validateExercise({ version: 99, id: 'a', titre: 'x' })).toBeNull()
  })
  it('complète les champs manquants', () => {
    expect(validateExercise({ version: 1, id: 'a', titre: 'x' })).toMatchObject({ question: '', blocs: [], reponse: '' })
  })
})

describe('bibliothèque', () => {
  it('crée la racine vide au premier lancement', async () => {
    const fs = createMemoryFs()
    expect(await loadTree(fs)).toEqual([])
  })

  it('crée des chapitres et des exercices, dans l\'ordre de création', async () => {
    const fs = createMemoryFs()
    await createChapter(fs, 'Fractions')
    await createChapter(fs, 'Algèbre')
    await createExercise(fs, 'Fractions', 'Exo 2')
    await createExercise(fs, 'Fractions', 'Exo 1')
    expect(await titles(fs)).toEqual([['Fractions', ['Exo 2', 'Exo 1']], ['Algèbre', []]])
  })

  it('ne confond jamais deux chapitres ni deux exercices de même nom', async () => {
    const fs = createMemoryFs()
    expect(await createChapter(fs, 'Algèbre')).toBe('Algèbre')
    expect(await createChapter(fs, 'algèbre')).toBe('algèbre 2')
    await createExercise(fs, 'Algèbre', 'Exo')
    const second = await createExercise(fs, 'Algèbre', 'Exo')
    expect(second).toBe('Algèbre/Exo 2.json')
  })

  it('refuse un nom inutilisable', async () => {
    const fs = createMemoryFs()
    await expect(createChapter(fs, '..')).rejects.toBeInstanceOf(InvalidNameError)
    await createChapter(fs, 'A')
    await expect(createExercise(fs, 'A', '   ')).rejects.toBeInstanceOf(InvalidNameError)
  })

  it('renomme un chapitre en gardant sa place, et un exercice par son titre', async () => {
    const fs = createMemoryFs()
    await createChapter(fs, 'B')
    await createChapter(fs, 'A')
    await createExercise(fs, 'B', 'Exo')
    expect(await renameChapter(fs, 'B', 'Zéro')).toBe('Zéro')
    expect(await titles(fs)).toEqual([['Zéro', ['Exo']], ['A', []]])
    await renameExercise(fs, 'Zéro/Exo.json', 'Nouveau titre')
    expect(await titles(fs)).toEqual([['Zéro', ['Nouveau titre']], ['A', []]])
  })

  it('supprime un exercice, puis un chapitre avec son contenu', async () => {
    const fs = createMemoryFs()
    await createChapter(fs, 'A')
    const path = await createExercise(fs, 'A', 'Exo')
    await createExercise(fs, 'A', 'Autre')
    await deleteExercise(fs, path)
    expect(await titles(fs)).toEqual([['A', ['Autre']]])
    await deleteChapter(fs, 'A')
    expect(await loadTree(fs)).toEqual([])
    expect([...fs.files.keys()].filter(k => k.startsWith('A/'))).toEqual([])
  })

  it('déplace un exercice vers un autre chapitre sans écraser un homonyme', async () => {
    const fs = createMemoryFs()
    await createChapter(fs, 'A')
    await createChapter(fs, 'B')
    const path = await createExercise(fs, 'A', 'Exo')
    await createExercise(fs, 'B', 'Exo')
    const moved = await moveExercise(fs, path, 'B')
    expect(moved).toBe('B/Exo 2.json')
    expect(await titles(fs)).toEqual([['A', []], ['B', ['Exo', 'Exo']]])
  })

  it('réordonne au sein d\'un chapitre et entre chapitres', async () => {
    const fs = createMemoryFs()
    await createChapter(fs, 'A')
    await createExercise(fs, 'A', '1')
    await createExercise(fs, 'A', '2')
    const third = await createExercise(fs, 'A', '3')
    await moveExercise(fs, third, 'A', 0)
    expect(await titles(fs)).toEqual([['A', ['3', '1', '2']]])
    await createChapter(fs, 'B')
    await moveChapter(fs, 'B', 0)
    expect((await loadTree(fs)).map(c => c.name)).toEqual(['B', 'A'])
  })

  it('garde visible un exercice corrompu, et ignore un fichier d\'ordre abîmé', async () => {
    const fs = createMemoryFs({ 'A/cassé.json': '{pas du json', 'A/_ordre.json': 'oups' })
    await createExercise(fs, 'A', 'Bon')
    const tree = await loadTree(fs)
    expect(tree[0].exercises.find(e => e.path === 'A/cassé.json')).toMatchObject({ titre: 'cassé', corrompu: true })
    expect(await readExercise(fs, 'A/cassé.json')).toBeNull()
  })
})
