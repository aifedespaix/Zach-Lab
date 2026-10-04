import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@suite/shared/ui'
import { BlockStack } from './BlockStack'
import type { Block } from './blocks'

// MathLive qui ne se charge pas : le champ LaTeX brut est l'éditeur complet.
vi.mock('mathlive', () => { throw new Error('indisponible') })

let current: unknown[] = []

function Harness({ initial = [] }: { initial?: unknown[] }) {
  const [value, setValue] = useState<unknown[]>(initial)
  current = value
  return <TooltipProvider><BlockStack value={value} onChange={(b: Block[]) => setValue(b)} /></TooltipProvider>
}

const names = () => screen.queryAllByRole('region').map(r => r.getAttribute('aria-label'))

describe('BlockStack', () => {
  it('invite à ajouter un premier bloc, puis empile les blocs dans l\'ordre', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText(/Par quoi veux-tu commencer/)).toBeInTheDocument()
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
    await user.type(screen.getByLabelText('Ligne 1 du calcul (LaTeX)'), '3+4')
    await user.type(screen.getByLabelText('Ligne 2, colonne 1'), 'x')
    await user.click(screen.getByRole('button', { name: 'Insérer une colonne après la colonne 2 du tableau 3' }))
    expect(current).toEqual([
      { id: 'a', type: 'texte', contenu: 'Je pars de' },
      { id: 'b', type: 'calcul', lignes: [{ id: expect.any(String), latex: '3+4' }] },
      { id: 'c', type: 'tableau', cellules: [['', '', ''], ['x', '', '']] },
    ])
  })

  it('insère et supprime lignes et colonnes par les poignées du tableau', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ id: 'c', type: 'tableau', cellules: [['', ''], ['', '']] }]} />)
    expect(screen.queryByRole('button', { name: 'Ajouter une ligne' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Insérer une colonne après la colonne 1 du tableau 1' }))
    expect((current as { cellules: string[][] }[])[0].cellules[0]).toHaveLength(3)
    // La poubelle se révèle au focus d'une cellule de sa colonne.
    await user.click(screen.getByLabelText('Ligne 1, colonne 2'))
    await user.click(screen.getByRole('button', { name: 'Supprimer la colonne 2 du tableau 1' }))
    await user.click(screen.getByLabelText('Ligne 2, colonne 2'))
    await user.click(screen.getByRole('button', { name: 'Supprimer la colonne 2 du tableau 1' }))
    expect((current as { cellules: string[][] }[])[0].cellules[0]).toHaveLength(1)
  })

  it('à 12 colonnes, les « + » de colonne sont désactivés et ne font rien ; ceux de ligne restent actifs', async () => {
    const user = userEvent.setup()
    const row = Array.from({ length: 12 }, () => '')
    render(<Harness initial={[{ id: 'c', type: 'tableau', cellules: [row, [...row]] }]} />)
    const plus = screen.getByRole('button', { name: 'Insérer une colonne après la colonne 1 du tableau 1' })
    expect(plus).toHaveAttribute('aria-disabled', 'true')
    await user.click(plus)
    await user.click(screen.getByRole('button', { name: 'Insérer une colonne avant la colonne 1 du tableau 1' }))
    expect((current as { cellules: string[][] }[])[0].cellules[0]).toHaveLength(12)
    expect(screen.getByRole('button', { name: 'Insérer une ligne après la ligne 1 du tableau 1' })).not.toHaveAttribute('aria-disabled')
  })

  it('laisse la place aux « + » de la dernière colonne et de la dernière ligne, que overflow-x:auto rognerait', () => {
    render(<Harness initial={[{ id: 'c', type: 'tableau', cellules: [['', ''], ['', '']] }]} />)
    const scroll = screen.getByTestId('table-scroll')
    // Ils débordent de 13px (HANDLE_STRADDLE) à droite et en bas de la grille.
    expect(parseFloat(scroll.style.paddingRight)).toBeGreaterThanOrEqual(13)
    expect(parseFloat(scroll.style.paddingBottom)).toBeGreaterThanOrEqual(13)
  })

  it('conserve un bloc inconnu, déplaçable et supprimable', async () => {
    const user = userEvent.setup()
    const unknown = { id: 'e', type: 'schema', etapes: [1] }
    render(<Harness initial={[unknown, { id: 'a', type: 'texte' }]} />)
    expect(screen.getByText(/pas encore pris en charge/)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Descendre le bloc' })[0])
    expect(current[1]).toEqual(unknown)
  })
})

describe('BlockStack — carte, gouttière et ajout', () => {
  it("chaque carte porte l'icône de son type, et la gouttière tient les trois actions", () => {
    render(<Harness initial={[{ id: 'a', type: 'texte', contenu: '' }, { id: 'b', type: 'equation', etapes: [] }]} />)
    const [first, second] = screen.getAllByRole('region')
    expect(within(first).getByRole('img', { name: 'Type : Texte' })).toBeInTheDocument()
    expect(within(second).getByRole('img', { name: 'Type : Équation' })).toBeInTheDocument()
    const gutter = within(first).getByRole('group', { name: 'Actions du bloc' })
    expect(within(gutter).getAllByRole('button').map(b => b.getAttribute('aria-label')))
      .toEqual(['Monter le bloc', 'Descendre le bloc', 'Supprimer le bloc'])
  })

  it("les boutons d'ajout ont une icône et le libellé du type", () => {
    render(<Harness />)
    const add = screen.getByRole('group', { name: 'Ajouter un bloc' })
    for (const label of ['Texte', 'Calcul', 'Tableau', 'Équation']) {
      const button = within(add).getByRole('button', { name: `Ajouter un bloc ${label}` })
      expect(button.querySelector('svg')).not.toBeNull()
      expect(button).toHaveTextContent(label)
    }
  })

  it("une zone vide garde ses boutons d'ajout", async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ id: 'a', type: 'texte', contenu: '' }]} />)
    await user.click(screen.getByRole('button', { name: 'Supprimer le bloc' }))
    expect(screen.queryAllByRole('region')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Ajouter un bloc Texte' })).toBeInTheDocument()
  })
})

describe('BlockStack — calcul', () => {
  it('Entrée ajoute une ligne et pas un bloc ; Ctrl+Entrée crée un bloc Calcul juste en dessous', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ id: 'a', type: 'calcul', lignes: [{ id: 'l', latex: '' }] }]} />)
    await user.type(screen.getByLabelText('Ligne 1 du calcul (LaTeX)'), '3x4{Enter}')
    expect(names()).toEqual(['Bloc Calcul, 1 sur 1'])
    expect(screen.getByLabelText('Ligne 2 du calcul (LaTeX)')).toHaveFocus()
    await user.keyboard('12{Control>}{Enter}{/Control}')
    expect(names()).toEqual(['Bloc Calcul, 1 sur 2', 'Bloc Calcul, 2 sur 2'])
    await waitFor(() => expect(screen.getAllByLabelText('Ligne 1 du calcul (LaTeX)')[1]).toHaveFocus())
  })
})

describe('BlockStack — halo', () => {
  it("le bloc déplacé reçoit un halo, pas les autres", async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ id: 'a', type: 'texte', contenu: '' }, { id: 'b', type: 'calcul' }]} />)
    await user.click(within(screen.getAllByRole('region')[1]).getByRole('button', { name: 'Monter le bloc' }))
    expect(document.querySelector('[data-block-id="b"]')!.classList.contains('block-halo')).toBe(true)
    expect(document.querySelector('[data-block-id="a"]')!.classList.contains('block-halo')).toBe(false)
    expect(names()[0]).toMatch(/Calcul/)
  })

  it("un bloc arrivé de l'autre zone reçoit halo et curseur", () => {
    render(<BlockStack value={[{ id: 'z', type: 'texte', contenu: '' }]} onChange={() => {}} arrivedId="z" />)
    expect(document.querySelector('[data-block-id="z"]')!.classList.contains('block-halo')).toBe(true)
    expect(screen.getByLabelText('Texte')).toHaveFocus()
  })

  describe('clic droit sur une case du tableau', () => {
    const cells = (): string[][] => (current as { cellules: string[][] }[])[0].cellules
    const rightClick = (user: ReturnType<typeof userEvent.setup>, label: string) =>
      user.pointer({ keys: '[MouseRight]', target: screen.getByLabelText(label) })

    it('insère une ligne au-dessus ou en dessous de la case', async () => {
      const user = userEvent.setup()
      render(<Harness initial={[{ id: 'c', type: 'tableau', cellules: [['a', 'b'], ['c', 'd']] }]} />)
      await rightClick(user, 'Ligne 2, colonne 1')
      await user.click(await screen.findByRole('menuitem', { name: 'Insérer une ligne au-dessus' }))
      expect(cells()).toEqual([['a', 'b'], ['', ''], ['c', 'd']])
      await rightClick(user, 'Ligne 1, colonne 2')
      await user.click(await screen.findByRole('menuitem', { name: 'Insérer une ligne en dessous' }))
      expect(cells()).toEqual([['a', 'b'], ['', ''], ['', ''], ['c', 'd']])
    })

    it('insère une colonne à gauche ou à droite de la case', async () => {
      const user = userEvent.setup()
      render(<Harness initial={[{ id: 'c', type: 'tableau', cellules: [['a', 'b'], ['c', 'd']] }]} />)
      await rightClick(user, 'Ligne 1, colonne 1')
      await user.click(await screen.findByRole('menuitem', { name: 'Insérer une colonne à gauche' }))
      expect(cells()).toEqual([['', 'a', 'b'], ['', 'c', 'd']])
      await rightClick(user, 'Ligne 2, colonne 3')
      await user.click(await screen.findByRole('menuitem', { name: 'Insérer une colonne à droite' }))
      expect(cells()).toEqual([['', 'a', 'b', ''], ['', 'c', 'd', '']])
    })

    it('supprime la ligne ou la colonne de la case, jamais la dernière', async () => {
      const user = userEvent.setup()
      render(<Harness initial={[{ id: 'c', type: 'tableau', cellules: [['a', 'b'], ['c', 'd']] }]} />)
      await rightClick(user, 'Ligne 1, colonne 2')
      await user.click(await screen.findByRole('menuitem', { name: 'Supprimer la colonne' }))
      expect(cells()).toEqual([['a'], ['c']])
      await rightClick(user, 'Ligne 2, colonne 1')
      await user.click(await screen.findByRole('menuitem', { name: 'Supprimer la ligne' }))
      expect(cells()).toEqual([['a']])
      await rightClick(user, 'Ligne 1, colonne 1')
      expect(await screen.findByRole('menuitem', { name: 'Supprimer la ligne' })).toHaveAttribute('aria-disabled', 'true')
      expect(screen.getByRole('menuitem', { name: 'Supprimer la colonne' })).toHaveAttribute('aria-disabled', 'true')
    })

    it('garde les gestes de champ (copier, coller) dans le même menu', async () => {
      const user = userEvent.setup()
      render(<Harness initial={[{ id: 'c', type: 'tableau', cellules: [['a']] }]} />)
      await rightClick(user, 'Ligne 1, colonne 1')
      expect(await screen.findByRole('menuitem', { name: /Copier/ })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Insérer une ligne au-dessus' })).toBeInTheDocument()
    })
  })
})
