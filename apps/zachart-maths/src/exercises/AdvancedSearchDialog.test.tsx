import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AdvancedSearchDialog, useAdvancedSearch } from './AdvancedSearchDialog'
import { createMemoryFs } from './memoryFs'
import { newExercise, SHEET_VERSION } from './types'
import { useExerciseStore } from './useExerciseStore'

const file = JSON.stringify({
  version: SHEET_VERSION, id: 'f', titre: 'Somme',
  exercices: [{ ...newExercise(), id: 'a', numero: '1a', enonce: 'Calcule la somme de deux fractions' }],
})

describe('AdvancedSearchDialog', () => {
  beforeEach(() => useAdvancedSearch.setState({ open: false }))

  it('cherche dans tous les exercices et ouvre le résultat choisi', async () => {
    const fs = createMemoryFs({ 'Fractions/Somme.json': file })
    render(<AdvancedSearchDialog />)
    await act(async () => useExerciseStore.getState().init(fs))
    await act(async () => useAdvancedSearch.getState().setOpen(true))
    const user = userEvent.setup()
    await user.type(await screen.findByRole('textbox', { name: 'Mots à chercher' }), 'fraction')
    const hit = await screen.findByRole('button', { name: /1a/ })
    await user.click(hit)
    expect(useExerciseStore.getState().selected).toBe('Fractions/Somme.json')
    expect(useAdvancedSearch.getState().open).toBe(false)
  })
})
