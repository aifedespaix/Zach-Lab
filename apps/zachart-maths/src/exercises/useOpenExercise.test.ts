import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryFs } from './memoryFs'
import { useExerciseStore } from './useExerciseStore'
import { useOpenExercise } from './useOpenExercise'

const ex = (id: string) => ({ id, numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '' })
const file = JSON.stringify({ version: 2, id: 's', titre: 'F', exercices: [ex('a'), ex('b'), ex('c')] })

async function openSheet() {
  await act(async () => useExerciseStore.getState().init(createMemoryFs({ 'Ch/f.json': file })))
  await act(async () => useExerciseStore.getState().select('Ch/f.json'))
  await act(async () => {})
}
const ids = () => useOpenExercise.getState().sheet!.exercices.map(e => e.id)

describe('useOpenExercise : réorganiser la fiche', () => {
  beforeEach(() => {
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null })
    useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' })
  })

  it("reorder déplace sans changer l'exercice affiché", async () => {
    await openSheet()
    act(() => useOpenExercise.getState().reorder('b', -1))
    expect(ids()).toEqual(['b', 'a', 'c'])
    expect(useOpenExercise.getState().currentId).toBe('a')
  })

  it("insertAt crée un exercice vierge et l'affiche", async () => {
    await openSheet()
    act(() => useOpenExercise.getState().insertAt('b', 'after'))
    expect(ids()).toHaveLength(4)
    expect(ids()[2]).toBe(useOpenExercise.getState().currentId)
  })

  it("removeById d'un autre exercice garde l'exercice affiché ; du courant, passe au voisin", async () => {
    await openSheet()
    act(() => useOpenExercise.getState().removeById('c'))
    expect(ids()).toEqual(['a', 'b'])
    expect(useOpenExercise.getState().currentId).toBe('a')
    act(() => useOpenExercise.getState().removeById('a'))
    expect(ids()).toEqual(['b'])
    expect(useOpenExercise.getState().currentId).toBe('b')
  })

  it('removeById ne retire jamais le seul exercice, ni un id inconnu', async () => {
    await openSheet()
    act(() => useOpenExercise.getState().removeById('zz'))
    expect(ids()).toHaveLength(3)
    act(() => {
      useOpenExercise.getState().removeById('a')
      useOpenExercise.getState().removeById('b')
    })
    act(() => useOpenExercise.getState().removeById('c'))
    expect(ids()).toHaveLength(1)
  })
})

describe('useOpenExercise : annuler / rétablir', () => {
  beforeEach(() => {
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, error: null })
    useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty', undoDepth: 0, redoDepth: 0 })
  })
  const enonce = () => useOpenExercise.getState().exercise!.enonce

  it('groupe les frappes rapprochées en un seul pas', async () => {
    await openSheet()
    act(() => { for (const t of ['a', 'ab', 'abc']) useOpenExercise.getState().edit({ enonce: t }) })
    expect(useOpenExercise.getState().undoDepth).toBe(1)
    act(() => useOpenExercise.getState().undo())
    expect(enonce()).toBe('')
    expect(useOpenExercise.getState().redoDepth).toBe(1)
    act(() => useOpenExercise.getState().redo())
    expect(enonce()).toBe('abc')
  })

  it('annule une suppression et un déplacement, et une nouvelle action vide le rétablissement', async () => {
    await openSheet()
    act(() => useOpenExercise.getState().reorder('b', -1))
    act(() => useOpenExercise.getState().removeById('c'))
    expect(ids()).toEqual(['b', 'a'])
    act(() => useOpenExercise.getState().undo())
    expect(ids()).toEqual(['b', 'a', 'c'])
    act(() => useOpenExercise.getState().undo())
    expect(ids()).toEqual(['a', 'b', 'c'])
    act(() => useOpenExercise.getState().reorder('c', -1))
    expect(useOpenExercise.getState().redoDepth).toBe(0)
  })

  it("ne fait rien sans historique, et repart de zéro à l'ouverture d'une autre fiche", async () => {
    await openSheet()
    act(() => useOpenExercise.getState().undo())
    expect(ids()).toEqual(['a', 'b', 'c'])
    act(() => useOpenExercise.getState().reorder('b', -1))
    await openSheet()
    expect(useOpenExercise.getState().undoDepth).toBe(0)
  })
})
