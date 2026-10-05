import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { newExercise, newSheet } from './types'
import { TreeRailLabel } from './TreeRailLabel'
import { useOpenExercise } from './useOpenExercise'

const empty = { path: null, sheet: null, currentId: null, exercise: null, status: 'empty' } as const

describe('TreeRailLabel', () => {
  beforeEach(() => useOpenExercise.setState(empty))

  it('sans fiche ouverte : « Arborescence »', () => {
    render(<TreeRailLabel />)
    expect(screen.getByText('Arborescence')).toBeInTheDocument()
  })

  it('la fiche ouverte et ses compteurs, sans les zéros', () => {
    const sheet = newSheet('Fractions')
    const done = { ...newExercise(), corrige: true, rate: true }
    const waiting = { ...newExercise(), enonce: 'commencé' }
    sheet.exercices = [done, waiting, { ...newExercise(), enonce: 'commencé aussi' }]
    act(() => useOpenExercise.setState({ path: 'A/f.json', sheet, currentId: done.id, exercise: done, status: 'saved' }))
    render(<TreeRailLabel />)
    expect(screen.getByText('Fractions')).toBeInTheDocument()
    expect(screen.getByText(/1 corrigé · 1 à revoir · 2 à corriger/)).toBeInTheDocument()
  })

  it('une fiche vierge n’affiche aucun compteur', () => {
    const sheet = newSheet('Vide')
    act(() => useOpenExercise.setState({ path: 'A/v.json', sheet, currentId: sheet.exercices[0].id, exercise: sheet.exercices[0], status: 'saved' }))
    const { container } = render(<TreeRailLabel />)
    expect(container).toHaveTextContent(/^Vide$/)
  })
})
