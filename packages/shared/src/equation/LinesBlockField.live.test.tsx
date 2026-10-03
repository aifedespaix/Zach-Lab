import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LinesBlockField } from './LinesBlockField'
import type { SubLine } from './lines'

// Un `math-field` qui se comporte comme le vrai MathLive (0.110) pour le focus
// PROGRAMMATIQUE : `focus()` marque le champ focalisé tout de suite, mais ne
// déplace le vrai focus DOM qu'après un `setTimeout(…, 60)` (`_Mathfield.onFocus`).
// Pendant ce délai, les frappes vont encore au champ précédent. Le focus NATIF
// (un clic, ou `HTMLElement.prototype.focus`) est immédiat, comme dans le
// navigateur grâce à `delegatesFocus`.
vi.mock('mathlive', () => {
  if (!customElements.get('math-field')) {
    customElements.define(
      'math-field',
      class extends HTMLElement {
        value = ''
        connectedCallback() {
          this.tabIndex = 0
        }
        focus() {
          setTimeout(() => HTMLElement.prototype.focus.call(this), 60)
        }
        executeCommand() {
          return true
        }
      }
    )
  }
  return {}
})

const L = (id: string, latex = ''): SubLine => ({ id, latex })
const fields = () => [...document.querySelectorAll('math-field')] as HTMLElement[]

function Harness({ initial }: { initial: SubLine[] }) {
  const [lines, setLines] = useState(initial)
  return (
    <LinesBlockField
      lines={lines}
      onChange={setLines}
      ariaLabel="Calcul"
      onEnterBlock={vi.fn()}
      onDeleteEmpty={vi.fn()}
      onDeleteForward={vi.fn()}
      onExitBlock={vi.fn()}
      onFieldChange={vi.fn()}
    />
  )
}

async function mounted(initial: SubLine[]) {
  render(<Harness initial={initial} />)
  // L'import (simulé) de MathLive se règle, puis chaque ligne passe au vrai champ.
  await act(async () => {})
  await act(async () => {})
  expect(fields()).toHaveLength(initial.length)
}

const pressEnter = (field: HTMLElement) =>
  act(() => {
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  })

describe('LinesBlockField avec un vrai champ de formule (focus différé de MathLive)', () => {
  it('Entrée met le vrai focus dans la nouvelle ligne tout de suite, pas 60 ms plus tard', async () => {
    await mounted([L('a', '1+1')])
    HTMLElement.prototype.focus.call(fields()[0])
    await pressEnter(fields()[0])
    expect(fields()).toHaveLength(2)
    // La frappe suivante doit aller dans la nouvelle ligne, pas dans l'ancienne.
    expect(document.activeElement).toBe(fields()[1])
  })

  it('Entrée sur une ligne suivie d\'une ligne vide y met le vrai focus tout de suite', async () => {
    await mounted([L('a', 'x'), L('b')])
    HTMLElement.prototype.focus.call(fields()[0])
    await pressEnter(fields()[0])
    expect(fields()).toHaveLength(2)
    expect(document.activeElement).toBe(fields()[1])
  })
})
