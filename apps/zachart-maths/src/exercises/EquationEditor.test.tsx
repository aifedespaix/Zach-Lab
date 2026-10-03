import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EquationEditor } from './EquationEditor'
import type { EquationBlock } from './blocks'

// MathLive enregistre un élément personnalisé en important ; le vrai paquet est lourd et exige
// des API absentes de jsdom. On teste ce qui est à nous : le branchement, les étapes, la navigation.
vi.mock('mathlive', () => {
  if (!customElements.get('math-field')) {
    customElements.define('math-field', class extends HTMLElement {
      value = ''
      position = 0
      lastOffset = 0
      connectedCallback() { this.tabIndex = 0 }
      insert(fragment: string) { this.value += fragment }
    })
  }
  return {}
})

let current: EquationBlock
function Harness({ etapes }: { etapes: EquationBlock['etapes'] }) {
  const [block, setBlock] = useState<EquationBlock>({ id: 'q', type: 'equation', etapes })
  current = block
  return <EquationEditor block={block} onChange={patch => setBlock(b => ({ ...b, ...patch }))} />
}

const steps = (...s: [string, string, string?][]) => s.map(([left, right, operation = ''], i) => ({ id: `s${i}`, left, right, operation }))
type Field = HTMLElement & { value: string; position: number; lastOffset: number }
const mathField = (label: string) => screen.findByLabelText(label) as Promise<Field>
const type = (field: Field, latex: string) => {
  field.value = latex
  fireEvent.input(field)
}
const left = (n: number) => `Membre gauche de l'étape ${n}`
const right = (n: number) => `Membre droit de l'étape ${n}`

describe('EquationEditor', () => {
  it('affiche les deux membres de chaque étape et répercute la saisie', async () => {
    render(<Harness etapes={steps(['2x+5', '11'])} />)
    const l = await mathField(left(1))
    expect(l.value).toBe('2x+5')
    expect((await mathField(right(1))).value).toBe('11')
    type(l, '2x+6')
    expect(current.etapes[0].left).toBe('2x+6')
  })

  it('la dernière étape passe au vert quand la variable est isolée', async () => {
    render(<Harness etapes={steps(['2x+5', '11'], ['x', '3'])} />)
    await mathField(left(2))
    expect(screen.getByRole('group', { name: 'Étape 2' })).toHaveAttribute('data-solved', 'true')
    expect(screen.getByRole('group', { name: 'Étape 1' })).toHaveAttribute('data-solved', 'false')
  })

  it('Entrée ajoute une étape sous celle-ci, curseur dans son membre gauche', async () => {
    render(<Harness etapes={steps(['x', '1'])} />)
    fireEvent.keyDown(await mathField(left(1)), { key: 'Enter' })
    expect(current.etapes).toHaveLength(2)
    await waitFor(async () => expect(await mathField(left(2))).toHaveFocus())
  })

  it('Maj+Entrée est laissée à MathLive', async () => {
    render(<Harness etapes={steps(['x', '1'])} />)
    fireEvent.keyDown(await mathField(left(1)), { key: 'Enter', shiftKey: true })
    expect(current.etapes).toHaveLength(1)
  })

  it('le bouton « Étape » ajoute en fin de résolution', async () => {
    render(<Harness etapes={steps(['x', '1'])} />)
    await mathField(left(1))
    fireEvent.click(screen.getByRole('button', { name: 'Étape' }))
    expect(current.etapes).toHaveLength(2)
  })

  it('↓ depuis un membre à plat va à l\'opération, ↓ encore à l\'étape suivante', async () => {
    render(<Harness etapes={steps(['2x', '8'], ['x', '4'])} />)
    fireEvent.keyDown(await mathField(left(1)), { key: 'ArrowDown' })
    const operation = screen.getByLabelText("Opération après l'étape 1")
    expect(operation).toHaveFocus()
    fireEvent.keyDown(operation, { key: 'ArrowDown' })
    await waitFor(async () => expect(await mathField(left(2))).toHaveFocus())
  })

  it('→ au bord droit d\'un membre passe au membre droit', async () => {
    render(<Harness etapes={steps(['x', '1'])} />)
    const l = await mathField(left(1))
    Object.assign(l, { position: 1, lastOffset: 1 })
    fireEvent.keyDown(l, { key: 'ArrowRight' })
    expect(await mathField(right(1))).toHaveFocus()
  })

  it('→ au milieu d\'un membre reste dans le champ', async () => {
    render(<Harness etapes={steps(['xy', '1'])} />)
    const l = await mathField(left(1))
    Object.assign(l, { position: 1, lastOffset: 2 })
    fireEvent.keyDown(l, { key: 'ArrowRight' })
    expect(await mathField(right(1))).not.toHaveFocus()
  })

  it('Retour arrière : membre droit vide → membre gauche ; étape entièrement vide → supprimée', async () => {
    render(<Harness etapes={steps(['x', ''], ['', ''])} />)
    fireEvent.keyDown(await mathField(right(1)), { key: 'Backspace' })
    expect(await mathField(left(1))).toHaveFocus()
    fireEvent.keyDown(await mathField(left(2)), { key: 'Backspace' })
    expect(current.etapes).toHaveLength(1)
  })

  it('le retour arrière dans un membre gauche vide ne supprime pas une étape qui a un membre droit', async () => {
    render(<Harness etapes={steps(['x', '1'], ['', '2'])} />)
    fireEvent.keyDown(await mathField(left(2)), { key: 'Backspace' })
    expect(current.etapes).toHaveLength(2)
  })

  it('supprime une étape par son bouton, jamais la dernière', async () => {
    render(<Harness etapes={steps(['x', '1'], ['y', '2'])} />)
    await mathField(left(1))
    fireEvent.click(screen.getByRole('button', { name: "Supprimer l'étape 1" }))
    expect(current.etapes).toHaveLength(1)
    expect(screen.getByRole('button', { name: "Supprimer l'étape 1" })).toBeDisabled()
  })

  it('l\'opération après la dernière étape est cachée quand l\'étape est résolue et vide', async () => {
    render(<Harness etapes={steps(['x', '3'])} />)
    await mathField(left(1))
    expect(screen.queryByLabelText("Opération après l'étape 1")).not.toBeInTheDocument()
  })

  it('l\'ordre du DOM est l\'ordre de lecture : Tab le suit sans piéger', async () => {
    render(<Harness etapes={steps(['a', 'b'], ['c', 'd'])} />)
    await mathField(left(1))
    const labels = [...document.querySelectorAll('[aria-label^="Membre"], [aria-label^="Opération"]')].map(e => e.getAttribute('aria-label'))
    expect(labels).toEqual([left(1), right(1), "Opération après l'étape 1", left(2), right(2)])
  })

  it('suit un changement venu d\'ailleurs (barre d\'outils) dans le champ', async () => {
    const { rerender } = render(<EquationEditor block={{ id: 'q', type: 'equation', etapes: steps(['x', '1']) }} onChange={() => {}} />)
    const l = await mathField(left(1))
    rerender(<EquationEditor block={{ id: 'q', type: 'equation', etapes: steps(['x+9', '1']) }} onChange={() => {}} />)
    await waitFor(() => expect(l.value).toBe('x+9'))
  })
})
