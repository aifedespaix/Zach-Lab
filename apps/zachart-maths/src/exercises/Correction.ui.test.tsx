import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@suite/shared/ui'
import '../commands'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runCommand } from '@suite/shared/commands'
import '../commands'
import { ExerciseTree } from './ExerciseTree'
import { ExerciseWorkspace } from './ExerciseWorkspace'
import { ReviewDialog } from './ReviewDialog'
import { SheetOutline } from './SheetOutline'
import { createMemoryFs } from './memoryFs'
import { useCorrectionView } from './useCorrectionView'
import { useExerciseStore } from './useExerciseStore'
import { goToExercise, useOpenExercise } from './useOpenExercise'

vi.mock('mathlive', () => {
  if (!customElements.get('math-field')) customElements.define('math-field', class extends HTMLElement {})
  return {}
})

const ex = (id: string, extra: object = {}) => ({ id, numero: '', enonce: `Question ${id}`, page: '', blocs: [], reponse: '', notes: '', ...extra })
const file = (titre: string, exercices: object[]) => JSON.stringify({ version: 2, id: titre, titre, exercices })
const FILES = {
  'Fractions/a.json': file('Fiche A', [ex('a1'), ex('a2', { corrige: true, corrigeLe: new Date().toISOString() })]),
  'Fractions/b.json': file('Fiche B', [ex('b1', { corrige: true, rate: true, corrigeLe: new Date().toISOString() })]),
  'Géométrie/c.json': file('Fiche C', [ex('c1'), ex('c2')]),
}

async function setup(ui: React.ReactNode) {
  const fs = createMemoryFs(FILES)
  render(<TooltipProvider>{ui}</TooltipProvider>)
  await act(async () => useExerciseStore.getState().init(fs))
  return userEvent.setup()
}

describe('correction : arbre, plan, révision', () => {
  beforeEach(() => {
    useExerciseStore.setState({ fs: null, tree: [], loaded: false, selected: null, recent: [], error: null })
    useOpenExercise.setState({ path: null, sheet: null, currentId: null, exercise: null, status: 'empty' })
    useCorrectionView.setState({ onlyToCorrect: false, hideCorrected: false, reviewOpen: false })
  })

  it('le filtre « à corriger seulement » masque les fiches finies et les chapitres vides', async () => {
    await setup(<ExerciseTree />)
    expect(screen.getByRole('button', { name: /Fiche B/ })).toBeInTheDocument()
    expect(screen.getByLabelText('1 à revoir')).toBeInTheDocument()
    await act(async () => void runCommand('tree.onlyToCorrect'))
    expect(screen.queryByRole('button', { name: /Fiche B/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fiche A/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Fiche C/ })).toBeInTheDocument()
    await act(async () => void runCommand('tree.onlyToCorrect'))
    expect(screen.getByRole('button', { name: /Fiche B/ })).toBeInTheDocument()
  })

  it('le plan grise les corrigés et peut les masquer (sauf l’exercice ouvert)', async () => {
    await setup(<SheetOutline />)
    await act(async () => useExerciseStore.getState().select('Fractions/a.json'))
    await waitFor(() => expect(useOpenExercise.getState().sheet).not.toBeNull())
    const region = screen.getByRole('region', { name: 'Exercices de la fiche' })
    const done = within(region).getByRole('button', { name: 'Exercice 2' })
    expect(done).toHaveAttribute('data-corrige', 'true')
    await userEvent.click(within(region).getByRole('button', { name: 'Masquer les exercices corrigés' }))
    expect(within(region).queryByRole('button', { name: 'Exercice 2' })).not.toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Exercice 1' })).toBeInTheDocument()
  })

  it('« Prochain à corriger » saute vers l’exercice suivant, d’une fiche à l’autre', async () => {
    await setup(<ExerciseWorkspace />)
    await act(async () => useExerciseStore.getState().select('Fractions/a.json'))
    await waitFor(() => expect(useOpenExercise.getState().currentId).toBe('a1'))
    await userEvent.click(screen.getByRole('button', { name: 'Prochain exercice à corriger' }))
    await waitFor(() => expect(useOpenExercise.getState().path).toBe('Géométrie/c.json'))
    await waitFor(() => expect(useOpenExercise.getState().currentId).toBe('c1'))
  })

  it('« À revoir » n’apparaît qu’une fois corrigé, et colore le cadre autrement', async () => {
    await setup(<ExerciseWorkspace />)
    await act(async () => useExerciseStore.getState().select('Fractions/a.json'))
    await waitFor(() => expect(useOpenExercise.getState().currentId).toBe('a1'))
    expect(screen.queryByRole('button', { name: 'À revoir' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Exercice corrigé' }))
    await userEvent.click(screen.getByRole('button', { name: 'À revoir' }))
    expect(screen.getByRole('contentinfo', { name: 'Zone de réponse' })).toHaveAttribute('data-corrige', 'revoir')
    expect(useOpenExercise.getState().exercise?.corrigeLe).toBeTypeOf('string')
    await userEvent.click(screen.getByRole('button', { name: 'Exercice corrigé' }))
    expect(useOpenExercise.getState().exercise).not.toHaveProperty('rate', true)
  })

  it('l’accueil sépare « à finir » des autres et affiche le bilan', async () => {
    await setup(<ExerciseWorkspace />)
    const now = new Date().toISOString()
    await act(async () => useExerciseStore.setState({ recent: [
      { path: 'Fractions/b.json', openedAt: now }, { path: 'Géométrie/c.json', openedAt: now },
    ] }))
    expect(screen.getByText(/À finir/)).toBeInTheDocument()
    expect(screen.getByText('Exercices ouverts récemment')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Bilan des corrections' })).toHaveTextContent('2 corrigés cette semaine')
  })

  it('le mode révision liste les corrigés, filtre par chapitre et sur « à revoir »', async () => {
    const user = await setup(<ReviewDialog courses={[]} />)
    await act(async () => useCorrectionView.getState().setReviewOpen(true))
    const region = await screen.findByRole('region', { name: 'Exercices corrigés' })
    await waitFor(() => expect(within(region).getAllByRole('button')).toHaveLength(2))
    await user.click(screen.getByLabelText('À revoir seulement'))
    expect(within(region).getAllByRole('button')).toHaveLength(1)
    await user.selectOptions(screen.getByLabelText('Chapitre'), 'Fractions')
    expect(within(region).getAllByRole('button')).toHaveLength(1)
    await user.click(screen.getByLabelText('À revoir seulement'))
    expect(within(region).getAllByRole('button')).toHaveLength(2)
    await user.click(screen.getByLabelText('À revoir seulement'))
    await user.click(within(region).getByRole('button'))
    expect(useCorrectionView.getState().reviewOpen).toBe(false)
    await waitFor(() => expect(useExerciseStore.getState().selected).toBe('Fractions/b.json'))
  })

  it('goToExercise ouvre la fiche sur l’exercice demandé', async () => {
    await setup(<SheetOutline />)
    await act(async () => goToExercise('Géométrie/c.json', 'c2'))
    await waitFor(() => expect(useOpenExercise.getState().currentId).toBe('c2'))
  })
})
