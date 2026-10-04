import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@suite/shared/ui'
import type { EquationBlock } from './blocks'
import { EquationEditor, type SubBlockContext } from './EquationEditor'
import { useUnitColors } from './useUnitColors'

vi.mock('mathlive', () => {
  if (!customElements.get('math-field')) {
    customElements.define('math-field', class extends HTMLElement {
      value = ''
      connectedCallback() { this.tabIndex = 0 }
      insert(fragment: string) { this.value += fragment.replace(/#[0?]/g, '') }
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

function setup(onChange = vi.fn()) {
  const view = render(
    <TooltipProvider>
      <EquationEditor block={block} onChange={onChange} ctx={ctx} />
    </TooltipProvider>,
  )
  const root = view.container.querySelector('[data-like-terms-root]') as HTMLElement
  return { ...view, root, onChange, help: () => view.container.querySelector('[data-like-terms-help]') }
}

describe('EquationEditor : aide des termes semblables', () => {
  beforeEach(() => useUnitColors.setState({ enabled: true }))

  it('n\'affiche rien tant que le bloc n\'a pas le focus', () => {
    const { help } = setup()
    expect(help()).toBeNull()
  })

  it('affiche la ligne colorée quand le bloc a le focus, et la retire quand il le perd', () => {
    const { root, help, container } = setup()
    fireEvent.focusIn(root)
    expect(help()).not.toBeNull()
    expect(container.querySelectorAll('[data-like-terms-line]')).toHaveLength(1)
    fireEvent.focusOut(root, { relatedTarget: null })
    expect(help()).toBeNull()
  })

  it('garde l\'aide quand le focus passe d\'un champ à l\'autre du même bloc', () => {
    const { root, help } = setup()
    fireEvent.focusIn(root)
    fireEvent.focusOut(root, { relatedTarget: root.firstElementChild })
    expect(help()).not.toBeNull()
  })

  it('n\'affiche rien quand le réglage est coupé', () => {
    useUnitColors.setState({ enabled: false })
    const { root, help } = setup()
    fireEvent.focusIn(root)
    expect(help()).toBeNull()
  })

  it('ne modifie jamais la valeur de l\'élève', () => {
    const { root, onChange } = setup()
    fireEvent.focusIn(root)
    fireEvent.focusOut(root, { relatedTarget: null })
    expect(onChange).not.toHaveBeenCalled()
  })
})
