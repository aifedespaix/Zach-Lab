import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { insertAtCursor, isTextField } from './insertAtCursor'

function Controlled({ multiline = false }: { multiline?: boolean }) {
  const [value, setValue] = useState('abcd')
  return (
    <>
      {multiline
        ? <textarea aria-label="champ" value={value} onChange={e => setValue(e.target.value)} />
        : <input aria-label="champ" value={value} onChange={e => setValue(e.target.value)} />}
      <output>{value}</output>
    </>
  )
}

describe('insertAtCursor', () => {
  it.each([false, true])('insère au curseur d\'un champ contrôlé (multiligne : %s)', multiline => {
    render(<Controlled multiline={multiline} />)
    const field = screen.getByLabelText('champ') as HTMLInputElement
    field.setSelectionRange(2, 2)
    insertAtCursor(field, '×')
    expect(field).toHaveValue('ab×cd')
    expect(field.selectionStart).toBe(3)
    // L'état React a suivi : sans onChange, le prochain rendu effacerait le signe.
    expect(screen.getByRole('status')).toHaveTextContent('ab×cd')
  })

  it('remplace la sélection', async () => {
    render(<Controlled />)
    const field = screen.getByLabelText('champ') as HTMLInputElement
    await userEvent.setup().click(field)
    field.setSelectionRange(1, 3)
    insertAtCursor(field, '≠')
    expect(field).toHaveValue('a≠d')
  })

  it('ne reconnaît comme champ de texte ni une case à cocher ni un bouton', () => {
    render(<><input type="checkbox" aria-label="c" /><button>b</button><input aria-label="t" /></>)
    expect(isTextField(screen.getByLabelText('c'))).toBe(false)
    expect(isTextField(screen.getByRole('button'))).toBe(false)
    expect(isTextField(screen.getByLabelText('t'))).toBe(true)
  })
})
