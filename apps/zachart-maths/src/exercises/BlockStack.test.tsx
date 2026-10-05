import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@suite/shared/ui'
import { BlockStack } from './BlockStack'
import { UnitHuesContext } from './HighlightedTextarea'
import { useUnitColors } from './useUnitColors'
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

async function moveVia(user: ReturnType<typeof userEvent.setup>, region: HTMLElement, item: string) {
  await user.click(within(region).getByRole('button', { name: /^Actions du bloc / }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

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
    await user.click(within(first()).getByRole('button', { name: /^Actions du bloc / }))
    expect(await screen.findByRole('menuitem', { name: 'Monter' })).toHaveAttribute('aria-disabled', 'true')
    await user.keyboard('{Escape}')
    await moveVia(user, screen.getAllByRole('region')[1], 'Monter')
    expect(names()[0]).toMatch(/Calcul/)
    await moveVia(user, first(), 'Descendre')
    expect(names()[0]).toMatch(/Texte/)
  })

  it('supprime un bloc', async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ id: 'a', type: 'texte' }, { id: 'b', type: 'calcul' }]} />)
    await moveVia(user, screen.getAllByRole('region')[0], 'Supprimer')
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
    await moveVia(user, screen.getAllByRole('region')[0], 'Descendre')
    expect(current[1]).toEqual(unknown)
  })
})

describe('BlockStack — carte, gouttière et ajout', () => {
  it("la gouttière tient un seul bouton, l'icône du type, qui ouvre le menu", async () => {
    const user = userEvent.setup()
    render(<Harness initial={[{ id: 'a', type: 'texte', contenu: '' }, { id: 'b', type: 'equation', etapes: [] }]} />)
    const [first] = screen.getAllByRole('region')
    const gutter = within(first).getByRole('group', { name: 'Actions du bloc' })
    expect(within(gutter).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Actions du bloc Texte'])
    await user.click(within(gutter).getByRole('button'))
    expect((await screen.findAllByRole('menuitem')).map(m => m.textContent)).toEqual(['Monter', 'Descendre', 'Supprimer'])
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
    await moveVia(user, screen.getByRole('region'), 'Supprimer')
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
    await moveVia(user, screen.getAllByRole('region')[1], 'Monter')
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

describe('BlockStack : tableau coloré par unité d\'en-tête', () => {
  // km → teinte 150, h → teinte 30 : ce que `assignExerciseHues` donnerait à cet exercice.
  const hues = new Map([['km', 150], ['h', 30]])

  function TableHarness({ cells }: { cells: string[][] }) {
    const [value, setValue] = useState<unknown[]>([{ id: 't', type: 'tableau', cellules: cells }])
    return (
      <TooltipProvider>
        <UnitHuesContext value={hues}>
          <BlockStack value={value} onChange={(b: Block[]) => setValue(b)} />
        </UnitHuesContext>
      </TooltipProvider>
    )
  }
  const cell = (row: number, column: number) => screen.getByLabelText(`Ligne ${row}, colonne ${column}`) as HTMLInputElement
  const fill = (row: number, column: number) => cell(row, column).style.background

  beforeEach(() => useUnitColors.setState({ enabled: true }))

  it('colore chaque colonne dont l\'en-tête est une unité, l\'en-tête un cran plus soutenu', () => {
    render(<TableHarness cells={[['Grandeur', 'Distance (km)', 'Temps (h)'], ['A', '10', '2'], ['B', '20', '4']]} />)
    expect(fill(2, 2)).not.toBe('')
    expect(fill(2, 2)).toBe(fill(3, 2))
    expect(fill(2, 3)).toBe(fill(3, 3))
    expect(fill(2, 2)).not.toBe(fill(2, 3))
    expect(fill(1, 2)).not.toBe('')
    expect(fill(1, 2)).not.toBe(fill(2, 2))
    expect(fill(1, 3)).not.toBe(fill(2, 3))
  })

  it('ne colore ni le coin ni la colonne sans unité', () => {
    render(<TableHarness cells={[['Grandeur', 'Distance (km)', 'Remarque'], ['A', '10', 'ok']]} />)
    expect(fill(1, 1)).toBe('')
    expect(fill(2, 1)).toBe('')
    expect(fill(1, 3)).toBe('')
    expect(fill(2, 3)).toBe('')
    expect(fill(2, 2)).not.toBe('')
  })

  it('colore les lignes quand les unités sont dans la première colonne', () => {
    render(<TableHarness cells={[['', 'a', 'b'], ['Distance (km)', '10', '20'], ['Temps (h)', '2', '4']]} />)
    expect(fill(2, 2)).not.toBe('')
    expect(fill(2, 2)).toBe(fill(2, 3))
    expect(fill(3, 2)).toBe(fill(3, 3))
    expect(fill(2, 2)).not.toBe(fill(3, 2))
    expect(fill(2, 1)).not.toBe(fill(2, 2))
    expect(fill(1, 2)).toBe('')
  })

  it('colore chaque ligne d\'un tableau de proportionnalité, coin compris', () => {
    render(<TableHarness cells={[['Distance (km)', '10', '20'], ['Temps (h)', '1', '2']]} />)
    expect(fill(1, 2)).not.toBe('')
    expect(fill(1, 2)).toBe(fill(1, 3))
    expect(fill(2, 2)).toBe(fill(2, 3))
    expect(fill(1, 2)).not.toBe(fill(2, 2))
    // Le coin est l'en-tête de sa ligne : plus soutenu que le corps, et plus que le corps de l'autre ligne.
    expect(fill(1, 1)).not.toBe('')
    expect(fill(1, 1)).not.toBe(fill(1, 2))
    expect(fill(2, 1)).not.toBe(fill(2, 2))
    expect(fill(1, 1)).not.toBe(fill(2, 1))
  })

  it('quand les deux ont des unités, la première ligne l\'emporte', () => {
    render(<TableHarness cells={[['', 'Distance (km)'], ['Temps (h)', '2']]} />)
    expect(fill(1, 2)).not.toBe('')
    expect(fill(2, 2)).not.toBe('')
    expect(fill(2, 1)).toBe('')
  })

  it('ne colore rien sans en-tête d\'unité', () => {
    render(<TableHarness cells={[['a', 'b'], ['16 km', '3 h']]} />)
    for (const [row, column] of [[1, 1], [1, 2], [2, 1], [2, 2]]) expect(fill(row, column)).toBe('')
  })

  it('ne colore rien quand le réglage est coupé', () => {
    useUnitColors.setState({ enabled: false })
    render(<TableHarness cells={[['', 'Distance (km)'], ['a', '10']]} />)
    for (const [row, column] of [[1, 1], [1, 2], [2, 1], [2, 2]]) expect(fill(row, column)).toBe('')
  })

  it('ne colore pas une unité que l\'exercice n\'a pas (pas de teinte connue)', () => {
    render(<TableHarness cells={[['', 'Poids (g)'], ['a', '10']]} />)
    expect(fill(1, 2)).toBe('')
    expect(fill(2, 2)).toBe('')
  })

  it('garde la valeur des cellules : colorer ne change aucun texte', () => {
    render(<TableHarness cells={[['', 'Distance (km)'], ['a', '10']]} />)
    expect(cell(1, 2)).toHaveValue('Distance (km)')
    expect(cell(2, 2)).toHaveValue('10')
  })
})
