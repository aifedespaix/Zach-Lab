import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@suite/shared/ui'
import type { EquationBlock } from './blocks'
import { EquationEditor, type SubBlockContext } from './EquationEditor'
import { useUnitColors } from './useUnitColors'

type Painted = { backgroundColor: string; range: [number, number] }

// Un `<math-field>` factice qui garde la valeur en clair et note les couleurs qu'on lui demande de peindre.
vi.mock('mathlive', () => {
  if (!customElements.get('math-field')) {
    customElements.define('math-field', class extends HTMLElement {
      value = ''
      painted: Painted[] = []
      get lastOffset() { return this.value.length }
      connectedCallback() { this.tabIndex = 0 }
      insert(fragment: string) { this.value += fragment.replace(/#[0?]/g, '') }
      getValue(start: number, end: number) { return this.value.slice(start, end) }
      applyStyle(style: { backgroundColor: string }, options: { range: [number, number] }) {
        if (style.backgroundColor !== 'none') this.painted.push({ backgroundColor: style.backgroundColor, range: options.range })
      }
    })
  }
  return {}
})

const block: EquationBlock = {
  id: 'e1',
  type: 'equation',
  etapes: [{ id: 's1', left: '3x+2y+1', right: '5x+3y-4', operation: '' }],
}

const ctx: SubBlockContext = {
  index: 0,
  onEnterBlock: vi.fn(),
  onDeleteEmpty: vi.fn(),
  onDeleteForward: vi.fn(),
  onExitBlock: vi.fn(),
  onFieldChange: vi.fn(),
  edge: { current: null },
}

async function setup(onChange = vi.fn()) {
  const view = render(
    <TooltipProvider>
      <EquationEditor block={block} onChange={onChange} ctx={ctx} />
    </TooltipProvider>,
  )
  const fields = async () => {
    await vi.waitFor(() => expect(view.container.querySelectorAll('math-field')).toHaveLength(2))
    return [...view.container.querySelectorAll('math-field')] as unknown as { painted: Painted[]; value: string }[]
  }
  return { ...view, onChange, fields }
}

describe('EquationEditor : termes semblables colorés dans les champs', () => {
  beforeEach(() => useUnitColors.setState({ enabled: true }))

  it('peint un fond par terme, directement dans le champ', async () => {
    const { fields } = await setup()
    const [left] = await fields()
    await vi.waitFor(() => expect(left.painted).toHaveLength(3))
    expect(left.painted.map(p => p.range)).toEqual([[0, 2], [2, 5], [5, 7]])
    expect(document.querySelector('[data-like-terms-help]')).toBeNull()
  })

  it('ne peint rien quand le réglage est coupé', async () => {
    useUnitColors.setState({ enabled: false })
    const { fields } = await setup()
    const [left] = await fields()
    expect(left.painted).toHaveLength(0)
  })

  it('ne modifie jamais la valeur de l\'élève', async () => {
    const { fields, onChange } = await setup()
    const [left] = await fields()
    await vi.waitFor(() => expect(left.painted).toHaveLength(3))
    expect(left.value).toBe('3x+2y+1')
    expect(onChange).not.toHaveBeenCalled()
  })
})
