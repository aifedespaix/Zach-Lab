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
