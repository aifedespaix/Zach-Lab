import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EquationEditor } from './EquationEditor'
import type { EquationBlock } from './blocks'

// MathLive qui ne se charge pas (hors ligne, fichier manquant) : le champ LaTeX brut doit suffire.
vi.mock('mathlive', () => { throw new Error('indisponible') })

let current: EquationBlock
function Harness() {
  const [block, setBlock] = useState<EquationBlock>({ id: 'q', type: 'equation', etapes: [{ id: 'a', action: '', latex: '' }] })
  current = block
  return <EquationEditor block={block} onChange={patch => setBlock(b => ({ ...b, ...patch }))} />
}

describe('EquationEditor sans MathLive', () => {
  it('reste utilisable : champ LaTeX brut, aperçu composé, étape suivante sur Entrée', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    const raw = screen.getByLabelText('Étape 1 (LaTeX)')
    await user.type(raw, '\\frac{{1}{{2}')
    expect(current.etapes[0].latex).toBe('\\frac{1}{2}')
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull())
    await user.keyboard('{Enter}')
    expect(current.etapes).toHaveLength(2)
    await waitFor(() => expect(screen.getByLabelText('Étape 2 (LaTeX)')).toHaveFocus())
  })
})
