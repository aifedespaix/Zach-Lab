import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BlockStack } from './BlockStack'
import type { Block } from './blocks'

let current: unknown[] = []

function Harness({ initial = [] }: { initial?: unknown[] }) {
  const [value, setValue] = useState<unknown[]>(initial)
  current = value
  return <BlockStack value={value} onChange={(b: Block[]) => setValue(b)} />
}

const names = () => screen.queryAllByRole('region').map(r => r.getAttribute('aria-label'))

describe('BlockStack', () => {
  it('invite à ajouter un premier bloc, puis empile les blocs dans l\'ordre', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText(/Aucun bloc/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Texte/ }))
    await user.click(screen.getByRole('button', { name: /Calcul/ }))
    await user.click(screen.getByRole('button', { name: /Tableau/ }))
    expect(names()).toEqual(['Bloc Texte, 1 sur 3', 'Bloc Calcul, 2 sur 3', 'Bloc Tableau, 3 sur 3'])
  })

  it('déplace un bloc vers le haut et vers le bas, et bloque aux extrémités', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ id: 'a', type: 'texte', contenu: 'A' }, { id: 'b', type: 'calcul' }]} />)
    const first = () => screen.getAllByRole('region')[0]
    expect(within(first()).getByRole('button', { name: 'Monter le bloc' })).toBeDisabled()
    await user.click(within(screen.getAllByRole('region')[1]).getByRole('button', { name: 'Monter le bloc' }))
    expect(names()[0]).toMatch(/Calcul/)
    await user.click(within(first()).getByRole('button', { name: 'Descendre le bloc' }))
    expect(names()[0]).toMatch(/Texte/)
  })

  it('supprime un bloc', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ id: 'a', type: 'texte' }, { id: 'b', type: 'calcul' }]} />)
    await user.click(within(screen.getAllByRole('region')[0]).getByRole('button', { name: 'Supprimer le bloc' }))
    expect(names()).toEqual(['Bloc Calcul, 1 sur 1'])
  })

  it('édite le texte, le calcul et les cellules du tableau', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[
      { id: 'a', type: 'texte' }, { id: 'b', type: 'calcul' }, { id: 'c', type: 'tableau', cellules: [['', ''], ['', '']] },
    ]} />)
    await user.type(screen.getByLabelText('Texte'), 'Je pars de')
    await user.type(screen.getByLabelText('Calcul'), '3+4')
    await user.type(screen.getByLabelText('Résultat du calcul'), '7')
    await user.type(screen.getByLabelText('Ligne 2, colonne 1'), 'x')
    await user.click(screen.getByRole('button', { name: 'Ajouter une colonne' }))
    expect(current).toEqual([
      { id: 'a', type: 'texte', contenu: 'Je pars de' },
      { id: 'b', type: 'calcul', expression: '3+4', resultat: '7' },
      { id: 'c', type: 'tableau', cellules: [['', '', ''], ['x', '', '']] },
    ])
  })

  it('conserve un bloc inconnu, déplaçable et supprimable', async () => {
    const user = userEvent.setup()
    const unknown = { id: 'e', type: 'equation', etapes: [1] }
    render(<Harness initial={[unknown, { id: 'a', type: 'texte' }]} />)
    expect(screen.getByText(/pas encore pris en charge/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Descendre le bloc' })[0])
    expect(current[1]).toEqual(unknown)
  })
})
