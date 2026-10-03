import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SheetOutline } from './SheetOutline'
import { newExercise, type Exercise, type Sheet } from './types'
import { useOpenExercise } from './useOpenExercise'

const exercices = (): Exercise[] => ['a', 'b', 'c'].map(id => ({ ...newExercise(), id }))
const open = (list: Exercise[] = exercices()) => {
  const sheet: Sheet = { version: 2, id: 'f', titre: 'Fiche', exercices: list }
  useOpenExercise.setState({ path: 'A/a.json', sheet, currentId: list[0].id, exercise: list[0], status: 'saved' })
}
const item = (name: RegExp) => screen.findByRole('menuitem', { name })
const ids = () => useOpenExercise.getState().sheet!.exercices.map(e => e.id)

describe('clic droit sur la fiche ouverte', () => {
  beforeEach(() => useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' }))

  it('Monter / Descendre sont grisés aux bords et réordonnent ailleurs', async () => {
    const user = userEvent.setup()
    open()
    render(<SheetOutline />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 1' }))
    expect(await item(/Monter/)).toHaveAttribute('aria-disabled', 'true')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 2' }))
    await user.click(await item(/Monter/))
    expect(ids()).toEqual(['b', 'a', 'c'])
  })

  it("« Aller à cet exercice » l'affiche", async () => {
    const user = userEvent.setup()
    open()
    render(<SheetOutline />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 3' }))
    await user.click(await item(/Aller à cet exercice/))
    expect(useOpenExercise.getState().currentId).toBe('c')
  })

  it("« Nouvel exercice après » insère au bon endroit et l'affiche", async () => {
    const user = userEvent.setup()
    open()
    render(<SheetOutline />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 2' }))
    await user.click(await item(/Nouvel exercice après/))
    const { sheet, currentId } = useOpenExercise.getState()
    expect(sheet!.exercices.map(e => e.id).slice(0, 2)).toEqual(['a', 'b'])
    expect(sheet!.exercices[2].id).toBe(currentId)
  })

  it('« Supprimer » demande confirmation ; refusé, rien ne part', async () => {
    const user = userEvent.setup()
    open()
    render(<SheetOutline />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 2' }))
    await user.click(await item(/Supprimer/))
    expect(await screen.findByText(/Supprimer cet exercice/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(ids()).toHaveLength(3)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 2' }))
    await user.click(await item(/Supprimer/))
    await user.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(ids()).toEqual(['a', 'c'])
  })

  it("le seul exercice d'une fiche ne peut pas être supprimé : l'entrée est grisée", async () => {
    open([exercices()[0]])
    render(<SheetOutline />)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Exercice 1' }))
    expect(await item(/Supprimer/)).toHaveAttribute('aria-disabled', 'true')
  })
})
