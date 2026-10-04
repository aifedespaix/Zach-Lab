import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { HighlightedTextarea, UnitHuesContext } from './HighlightedTextarea'
import { assignHues } from './unitColors'
import { useUnitColors } from './useUnitColors'

const marks = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('mark')]

function Field({ text, hues }: { text: string; hues: ReadonlyMap<string, number> }) {
  return (
    <UnitHuesContext value={hues}>
      <HighlightedTextarea aria-label="champ" value={text} onChange={() => {}} className="w-full" />
    </UnitHuesContext>
  )
}

/** Un champ contrôlé dont les teintes viennent de son propre texte, comme dans l'app. */
function Live() {
  const [value, setValue] = useState('')
  return (
    <UnitHuesContext value={assignHues([value])}>
      <HighlightedTextarea aria-label="champ" value={value} onChange={e => setValue(e.target.value)} />
    </UnitHuesContext>
  )
}

describe('HighlightedTextarea', () => {
  beforeEach(() => useUnitColors.setState({ enabled: true }))

  it('marque chaque grandeur du texte, avec la teinte de son unité', () => {
    const text = '3 km/h et 16 km, puis 4 km'
    const { container } = render(<Field text={text} hues={assignHues([text])} />)
    const found = marks(container)
    expect(found.map(m => m.textContent)).toEqual(['3 km/h', '16 km', '4 km'])
    expect(found.map(m => m.dataset.unit)).toEqual(['km/h', 'km', 'km'])
    expect(found[1].style.background).toBe(found[2].style.background)
    expect(found[0].style.background).not.toBe(found[1].style.background)
  })

  it('rend le texte des marques invisible : seul le champ au-dessus s\'écrit', () => {
    const text = '16 km'
    const { container } = render(<Field text={text} hues={assignHues([text])} />)
    // jsdom normalise `transparent` en `rgba(0, 0, 0, 0)` dans le style calculé : on lit le style posé.
    expect(marks(container)[0].style.color).toBe('transparent')
  })

  it('reproduit exactement le texte du champ dans le miroir', () => {
    const text = 'Il fait 16 km\npuis 4 km.'
    const { container } = render(<Field text={text} hues={assignHues([text])} />)
    expect(container.querySelector('[data-unit-mirror]')!.textContent).toBe(text)
  })

  it('garde la hauteur de la dernière ligne quand le texte finit par un saut de ligne', () => {
    const text = '16 km\n'
    const { container } = render(<Field text={text} hues={assignHues([text])} />)
    expect(container.querySelector('[data-unit-mirror]')!.textContent).toBe('16 km\n​')
  })

  it('ne marque rien sans teinte connue pour l\'unité', () => {
    const { container } = render(<Field text="16 km" hues={new Map()} />)
    expect(marks(container)).toHaveLength(0)
  })

  it('réglage coupé : un simple champ, sans miroir ni marque', () => {
    useUnitColors.setState({ enabled: false })
    const text = '16 km'
    const { container } = render(<Field text={text} hues={assignHues([text])} />)
    expect(container.querySelector('[data-unit-mirror]')).toBeNull()
    expect(marks(container)).toHaveLength(0)
    expect(screen.getByLabelText('champ')).toHaveValue(text)
  })

  it('transmet ses props au champ (libellé, valeur)', () => {
    render(<Field text="abc" hues={new Map()} />)
    expect(screen.getByLabelText('champ')).toHaveValue('abc')
  })

  it('garde le focus quand la toute première unité apparaît en tapant', async () => {
    const user = userEvent.setup()
    const { container } = render(<Live />)
    const field = screen.getByLabelText('champ')
    await user.click(field)
    await user.type(field, '3 km')
    expect(field).toHaveFocus()
    expect(screen.getByLabelText('champ')).toBe(field)
    expect(marks(container).map(m => m.textContent)).toEqual(['3 km'])
  })
})
