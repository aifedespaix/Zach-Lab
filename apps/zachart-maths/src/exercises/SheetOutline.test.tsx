import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SheetOutline } from './SheetOutline'
import { newExercise, type Sheet } from './types'
import { useOpenExercise } from './useOpenExercise'
import { useSheetSort } from './useSheetSort'

const sheet: Sheet = {
  version: 2, id: 'f', titre: 'Fractions p.45',
  exercices: [
    { ...newExercise(), id: '1', numero: '3.b', page: '45', enonce: 'Calcule la somme\nde deux fractions', reponse: '7/12' },
    { ...newExercise(), id: '2', enonce: 'Simplifie' },
  ],
}
const openSheet = () =>
  useOpenExercise.setState({ path: 'A/a.json', sheet, currentId: '1', exercise: sheet.exercices[0], status: 'saved' })

describe('SheetOutline', () => {
  beforeEach(() => useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' }))

  it("ne montre rien tant qu'aucune fiche n'est ouverte", () => {
    const { container } = render(<SheetOutline />)
    expect(container).toBeEmptyDOMElement()
  })

  it("liste les exercices : numéro ou position, page, début d'énoncé, coche si répondu", () => {
    openSheet()
    render(<SheetOutline />)
    const rows = within(screen.getByRole('region', { name: 'Exercices de la fiche' })).getAllByRole('button', { name: /^Exercice / })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('3.b')
    expect(rows[0]).toHaveTextContent('p.45')
    expect(rows[0]).toHaveTextContent('Calcule la somme')
    expect(rows[0]).not.toHaveTextContent('de deux fractions')
    expect(within(rows[0]).getByLabelText('Réponse remplie')).toBeInTheDocument()
    expect(rows[1]).toHaveTextContent('2')
    expect(within(rows[1]).queryByLabelText('Réponse remplie')).toBeNull()
  })

  it("met en évidence l'exercice affiché, et un clic en affiche un autre", async () => {
    openSheet()
    render(<SheetOutline />)
    const rows = screen.getAllByRole('button', { name: /^Exercice / })
    expect(rows[0]).toHaveAttribute('aria-current', 'true')
    await userEvent.setup().click(rows[1])
    expect(useOpenExercise.getState().currentId).toBe('2')
  })

  it('se replie et se déplie', async () => {
    openSheet()
    render(<SheetOutline />)
    const user = userEvent.setup()
    const toggle = screen.getByRole('button', { name: /Exercices de la fiche/ })
    await user.click(toggle)
    expect(screen.queryAllByRole('button', { name: /^Exercice / })).toHaveLength(0)
    await user.click(toggle)
    expect(screen.getAllByRole('button', { name: /^Exercice / })).toHaveLength(2)
  })
})

describe('SheetOutline — tri', () => {
  const many: Sheet = {
    version: 2, id: 'g', titre: 'Tri',
    exercices: ['10', '2', '1b', '1a'].map((numero, i) => ({ ...newExercise(), id: String(i), numero, enonce: `E${numero}` })),
  }
  beforeEach(() => {
    localStorage.clear()
    useSheetSort.setState({ sort: 'ordre' })
    useOpenExercise.setState({ path: 'A/a.json', sheet: many, currentId: '0', exercise: many.exercices[0], status: 'saved' })
  })

  it('trie par numéro croissant puis décroissant depuis le menu', async () => {
    render(<SheetOutline />)
    const user = userEvent.setup()
    const order = () => screen.getAllByRole('button', { name: /^Exercice / }).map(b => b.getAttribute('aria-label'))
    expect(order()).toEqual(['Exercice 10', 'Exercice 2', 'Exercice 1b', 'Exercice 1a'])
    await user.click(screen.getByRole('button', { name: 'Trier les exercices' }))
    await user.click(await screen.findByRole('menuitem', { name: /\(croissant\)/ }))
    expect(order()).toEqual(['Exercice 1a', 'Exercice 1b', 'Exercice 2', 'Exercice 10'])
    await user.click(screen.getByRole('button', { name: 'Trier les exercices' }))
    await user.click(await screen.findByRole('menuitem', { name: /\(décroissant\)/ }))
    expect(order()).toEqual(['Exercice 10', 'Exercice 2', 'Exercice 1b', 'Exercice 1a'])
  })
})
