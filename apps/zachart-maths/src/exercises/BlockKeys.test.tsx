import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BlockStack } from './BlockStack'
import type { Block } from './blocks'

// MathLive qui ne se charge pas : le champ LaTeX brut est l'éditeur complet.
vi.mock('mathlive', () => { throw new Error('indisponible') })

let current: unknown[] = []
function Harness({ initial }: { initial: unknown[] }) {
  const [value, setValue] = useState<unknown[]>(initial)
  current = value
  return <BlockStack value={value} onChange={(b: Block[]) => setValue(b)} />
}
const names = () => screen.queryAllByRole('region').map(r => r.getAttribute('aria-label'))
const eq = (id: string, left = '', right = '') => ({ id, type: 'equation', etapes: [{ id: `${id}-s`, left, right, operation: '' }] })
const calc = (id: string, ...latex: string[]) => ({ id, type: 'calcul', lignes: latex.map((l, i) => ({ id: `${id}-${i}`, latex: l })) })

describe('Zach\'Math — blocs et sous-blocs au clavier', () => {
  it('Entrée dans une équation ajoute une étape et pas un bloc ; Ctrl+Entrée en ajoute un juste après', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[eq('e', '2x', '8'), { id: 't', type: 'texte', contenu: 'fin' }]} />)
    await user.click(screen.getByLabelText("Membre gauche de l'étape 1 du bloc 1 (LaTeX)"))
    await user.keyboard('{Enter}')
    expect(names()).toHaveLength(2)
    expect(screen.getAllByLabelText(/Membre gauche/)).toHaveLength(2)
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(names()).toHaveLength(3)
    expect((current[1] as { type: string }).type).toBe('equation')
    expect((current[2] as { type: string }).type).toBe('texte')
    await waitFor(() => expect(screen.getByLabelText("Membre gauche de l'étape 1 du bloc 2 (LaTeX)")).toHaveFocus())
  })

  it('↓ depuis la dernière ligne du bloc 1 entre dans le bloc 2 ; ↑ revient', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[calc('c', '1'), calc('d', '2')]} />)
    await user.click(screen.getAllByLabelText('Ligne 1 du calcul (LaTeX)')[0])
    await user.keyboard('{ArrowDown}')
    expect(screen.getAllByLabelText('Ligne 1 du calcul (LaTeX)')[1]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getAllByLabelText('Ligne 1 du calcul (LaTeX)')[0]).toHaveFocus()
  })

  it("Retour arrière dans l'unique ligne vide d'un bloc vide supprime le bloc ; pas si le bloc a du contenu", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness initial={[{ id: 't', type: 'texte', contenu: 'avant' }, calc('c', '')]} />)
    await user.click(screen.getByLabelText('Ligne 1 du calcul (LaTeX)'))
    await user.keyboard('{Backspace}')
    expect(names()).toEqual(['Bloc Texte, 1 sur 1'])
    unmount()
    render(<Harness initial={[{ id: 't', type: 'texte', contenu: 'avant' }, calc('c', 'x')]} />)
    await user.click(screen.getByLabelText('Ligne 1 du calcul (LaTeX)'))
    ;(screen.getByLabelText('Ligne 1 du calcul (LaTeX)') as HTMLInputElement).setSelectionRange(0, 0)
    await user.keyboard('{Backspace}')
    expect(names()).toHaveLength(2)
  })

  it('aucun bouton ✕, « + Étape » ni « Opération » parasite à droite des champs', () => {
    render(<Harness initial={[eq('e', 'a', 'b')]} />)
    expect(screen.queryByRole('button', { name: /Supprimer l'étape/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Étape/ })).toBeNull()
  })
})
