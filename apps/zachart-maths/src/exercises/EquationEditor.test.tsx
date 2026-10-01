import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EquationEditor } from './EquationEditor'
import type { EquationBlock } from './blocks'

// MathLive enregistre un élément personnalisé en important ; le vrai paquet est lourd et exige
// des API absentes de jsdom. On teste ce qui est à nous : le branchement et les étapes.
vi.mock('mathlive', () => {
  if (!customElements.get('math-field')) {
    customElements.define('math-field', class extends HTMLElement {
      value = ''
      connectedCallback() { this.tabIndex = 0 }
      insert = (fragment: string) => { this.value += fragment }
    })
  }
  return {}
})

let current: EquationBlock
function Harness({ initial }: { initial?: Partial<EquationBlock> }) {
  const [block, setBlock] = useState<EquationBlock>({
    id: 'q', type: 'equation', etapes: [{ id: 'a', action: '', latex: '2x+5=11' }], ...initial,
  })
  current = block
  return <EquationEditor block={block} onChange={patch => setBlock(b => ({ ...b, ...patch }))} />
}

const mathField = (label: string) => screen.findByLabelText(label) as Promise<HTMLElement & { value: string }>
const type = (field: HTMLElement & { value: string }, latex: string) => {
  field.value = latex
  fireEvent.input(field)
}

describe('EquationEditor', () => {
  it('affiche MathLive avec la formule de l\'étape, et répercute ce qui s\'y écrit', async () => {
    render(<Harness />)
    const field = await mathField('Étape 1')
    expect(field.tagName).toBe('MATH-FIELD')
    expect(field.value).toBe('2x+5=11')
    type(field, '2x+5=12')
    expect(current.etapes[0].latex).toBe('2x+5=12')
  })

  it('Entrée ajoute une étape juste en dessous, avec un champ d\'action entre les deux', async () => {
    render(<Harness />)
    const first = await mathField('Étape 1')
    expect(screen.queryByLabelText(/Action avant/)).not.toBeInTheDocument()
    fireEvent.keyDown(first, { key: 'Enter' })
    const second = await mathField('Étape 2')
    await waitFor(() => expect(second).toHaveFocus())
    expect(current.etapes).toHaveLength(2)
    await userEvent.setup().type(screen.getByLabelText("Action avant l'étape 2"), '− 5 des deux côtés')
    expect(current.etapes[1].action).toBe('− 5 des deux côtés')
  })

  it('Maj+Entrée est laissée à MathLive', async () => {
    render(<Harness />)
    fireEvent.keyDown(await mathField('Étape 1'), { key: 'Enter', shiftKey: true })
    expect(current.etapes).toHaveLength(1)
  })

  it('le bouton « Étape » ajoute en fin de résolution', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await mathField('Étape 1')
    await user.click(screen.getByRole('button', { name: /Étape$/ }))
    await user.click(screen.getByRole('button', { name: /Étape$/ }))
    expect(current.etapes).toHaveLength(3)
  })

  it('supprime une étape (bouton, ou retour arrière dans un champ vide), jamais la dernière', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ etapes: [
      { id: 'a', action: '', latex: 'x' }, { id: 'b', action: 'f', latex: '' }, { id: 'c', action: 'g', latex: 'y' },
    ] }} />)
    const second = await mathField('Étape 2')
    fireEvent.keyDown(second, { key: 'Backspace' })
    expect(current.etapes.map(s => s.id)).toEqual(['a', 'c'])
    await user.click(screen.getByRole('button', { name: "Supprimer l'étape 2" }))
    expect(current.etapes.map(s => s.id)).toEqual(['a'])
    expect(screen.getByRole('button', { name: "Supprimer l'étape 1" })).toBeDisabled()
  })

  it('le retour arrière dans un champ non vide ne supprime pas l\'étape', async () => {
    render(<Harness initial={{ etapes: [{ id: 'a', action: '', latex: 'x' }, { id: 'b', action: '', latex: 'y' }] }} />)
    fireEvent.keyDown(await mathField('Étape 2'), { key: 'Backspace' })
    expect(current.etapes).toHaveLength(2)
  })

  it('suit un changement venu d\'ailleurs (barre d\'outils) dans le champ', async () => {
    const { rerender } = render(<Harness />)
    const field = await mathField('Étape 1')
    await act(async () => { type(field, 'x'); })
    rerender(<Harness />)
    expect(field.value).toBe('x')
  })
})
