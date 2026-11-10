import { beforeEach, describe, expect, it } from 'vitest'
import { INBOX_CHAPTER, INBOX_PATH, createChapter, createExercise, deleteChapter, ensureInbox, loadTree, readSheet, renameChapter, saveSheet } from './library'
import { createMemoryFs } from './memoryFs'
import { addQuickExercise, moveExerciseToSheet } from './inbox'
import { newExercise } from './types'
import { useExerciseStore } from './useExerciseStore'
import { useOpenExercise } from './useOpenExercise'

describe('« Non classé »', () => {
  it('est créé une fois et reste toujours le premier chapitre', async () => {
    const fs = createMemoryFs()
    await createChapter(fs, 'Algèbre')
    await ensureInbox(fs)
    await ensureInbox(fs)
    await createChapter(fs, 'Fractions')
    const tree = await loadTree(fs)
    expect(tree.map(c => c.name)).toEqual([INBOX_CHAPTER, 'Algèbre', 'Fractions'])
    expect(tree[0].exercises).toHaveLength(1)
  })

  it('ne se renomme ni ne se supprime, et un chapitre à la main ne le copie pas', async () => {
    const fs = createMemoryFs()
    await ensureInbox(fs)
    await expect(renameChapter(fs, INBOX_CHAPTER, 'Vrac')).rejects.toThrow()
    await expect(deleteChapter(fs, INBOX_CHAPTER)).rejects.toThrow()
    expect(await createChapter(fs, 'Non classé')).toBe('Non classé 2')
  })
})

describe('exercice rapide et déplacement', () => {
  beforeEach(async () => {
    const fs = createMemoryFs()
    await ensureInbox(fs)
    useExerciseStore.setState({ fs, tree: await loadTree(fs), selected: null, error: null })
    useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' })
  })

  it('réutilise l’exercice vierge de « Non classé » puis en ajoute un seul quand il est rempli', async () => {
    const fs = useExerciseStore.getState().fs!
    await addQuickExercise()
    expect((await readSheet(fs, INBOX_PATH))!.exercices).toHaveLength(1)
    expect(useExerciseStore.getState().selected).toBe(INBOX_PATH)
    const sheet = (await readSheet(fs, INBOX_PATH))!
    await saveSheet(fs, INBOX_PATH, { ...sheet, exercices: [{ ...sheet.exercices[0], enonce: 'Calculer 3 + 4' }] })
    useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' })
    await addQuickExercise()
    await vi_waitForOpen()
    await useOpenExercise.getState().flush()
    const after = (await readSheet(fs, INBOX_PATH))!
    expect(after.exercices.map(e => e.enonce)).toEqual(['Calculer 3 + 4', ''])
  })

  it('déplace un exercice vers une fiche existante sans rien perdre', async () => {
    const fs = useExerciseStore.getState().fs!
    await createChapter(fs, 'Algèbre')
    const target = await createExercise(fs, 'Algèbre', 'Équations')
    const moved = { ...newExercise(), enonce: 'Résoudre 2x = 6' }
    const other = { ...newExercise(), enonce: 'Autre' }
    const sheet = (await readSheet(fs, INBOX_PATH))!
    await saveSheet(fs, INBOX_PATH, { ...sheet, exercices: [moved, other] })
    useExerciseStore.setState({ tree: await loadTree(fs) })
    useExerciseStore.getState().select(INBOX_PATH)
    await vi_waitForOpen()
    const path = await moveExerciseToSheet(moved.id, { kind: 'existing', path: target })
    expect(path).toBe(target)
    expect((await readSheet(fs, target))!.exercices.map(e => e.enonce)).toEqual(['Résoudre 2x = 6'])
    expect((await readSheet(fs, INBOX_PATH))!.exercices.map(e => e.enonce)).toEqual(['Autre'])
  })

  it('l’envoie vers une fiche toute neuve, dans un chapitre neuf, et laisse un vierge si c’était le seul', async () => {
    const fs = useExerciseStore.getState().fs!
    const moved = { ...newExercise(), enonce: 'Théorème de Thalès' }
    const sheet = (await readSheet(fs, INBOX_PATH))!
    await saveSheet(fs, INBOX_PATH, { ...sheet, exercices: [moved] })
    useExerciseStore.getState().select(INBOX_PATH)
    await vi_waitForOpen()
    const path = await moveExerciseToSheet(moved.id, { kind: 'new', chapter: 'Géométrie', titre: 'Thalès' })
    expect(path).toBe('Géométrie/Thalès.json')
    expect((await readSheet(fs, path!))!.exercices.map(e => e.enonce)).toEqual(['Théorème de Thalès'])
    const rest = (await readSheet(fs, INBOX_PATH))!.exercices
    expect(rest).toHaveLength(1)
    expect(rest[0].enonce).toBe('')
  })
})

async function vi_waitForOpen() {
  for (let i = 0; i < 50 && useOpenExercise.getState().sheet === null; i++) await new Promise(r => setTimeout(r, 10))
}
