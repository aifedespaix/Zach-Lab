import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BlockStack } from './BlockStack'
import type { Block } from './blocks'

let current: unknown[] = []
function Harness({ initial, onSend, split = false, onToggleSplit }: {
  initial: unknown[]
  onSend?: (id: string) => void
  split?: boolean
  onToggleSplit?: () => void
}) {
  const [value, setValue] = useState(initial)
  current = value
  return <BlockStack value={value} onChange={(b: Block[]) => setValue(b)} onSend={onSend} split={split} onToggleSplit={onToggleSplit} />
}
const two = [{ id: 'a', type: 'texte', contenu: 'A' }, { id: 'b', type: 'calcul', expression: '', resultat: '' }]
const menuItem = (name: RegExp) => screen.findByRole('menuitem', { name })

describe('clic droit sur un bloc', () => {
  it('monter, descendre, dupliquer, supprimer ; « monter » grisé au premier', async () => {
    render(<Harness initial={two} />)
    fireEvent.contextMenu(screen.getAllByRole('region')[0])
    expect(await menuItem(/Monter/)).toHaveAttribute('aria-disabled', 'true')
    expect(await menuItem(/Descendre/)).not.toHaveAttribute('aria-disabled', 'true')
    expect(await menuItem(/Dupliquer/)).toBeInTheDocument()
    expect(await menuItem(/Supprimer/)).toBeInTheDocument()
  })

  it('« Dupliquer » insère une copie juste en dessous', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    fireEvent.contextMenu(screen.getAllByRole('region')[0])
    await user.click(await menuItem(/Dupliquer/))
    expect(current).toHaveLength(3)
    expect((current[1] as { contenu: string }).contenu).toBe('A')
  })

  it('« Changer de type » convertit', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    fireEvent.contextMenu(screen.getAllByRole('region')[0])
    // Au clavier : les sous-menus Radix ne s'activent pas au clic sous jsdom, mais ils sont pleinement
    // utilisables à la flèche droite puis Entrée, ce qui est aussi le chemin d'accessibilité.
    const trigger = await menuItem(/Changer de type/)
    trigger.focus()
    await user.keyboard('{ArrowRight}')
    const calcul = await menuItem(/Calcul/)
    calcul.focus()
    await user.keyboard('{Enter}')
    expect((current[0] as { type: string }).type).toBe('calcul')
  })

  it('un bloc de type inconnu : ni conversion, mais duplication et suppression', async () => {
    render(<Harness initial={[{ id: 'u', type: 'futur' }]} />)
    fireEvent.contextMenu(screen.getByRole('region'))
    expect(await menuItem(/Supprimer/)).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Changer de type/ })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /Dupliquer/ })).toBeInTheDocument()
  })

  it("« Envoyer dans l'autre zone » n'apparaît que si l'exercice est scindé, et appelle onSend", async () => {
    const user = userEvent.setup()
    const sent: string[] = []
    const { unmount } = render(<Harness initial={two} />)
    fireEvent.contextMenu(screen.getAllByRole('region')[0])
    await screen.findByRole('menuitem', { name: /Supprimer/ })
    expect(screen.queryByRole('menuitem', { name: /autre zone/ })).toBeNull()
    unmount()
    render(<Harness initial={two} onSend={id => sent.push(id)} />)
    fireEvent.contextMenu(screen.getAllByRole('region')[1])
    await user.click(await menuItem(/autre zone/))
    expect(sent).toEqual(['b'])
  })
})

describe('clic droit dans un champ et sur le vide', () => {
  it('dans un champ : couper/copier/coller seulement, pas le menu du bloc', async () => {
    render(<Harness initial={two} />)
    fireEvent.contextMenu(screen.getByLabelText('Texte'))
    expect(await menuItem(/Copier/)).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Dupliquer/ })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /Ajouter un bloc/ })).toBeNull()
  })

  it("sur le vide d'une zone sans bloc : ajouter un bloc de chaque type", async () => {
    const user = userEvent.setup()
    render(<Harness initial={[]} />)
    fireEvent.contextMenu(screen.getByTestId('zone-vide'))
    await user.click(await menuItem(/Ajouter un bloc Équation/))
    expect((current[0] as { type: string }).type).toBe('equation')
  })

  it("sur le vide : scinder ou réunir selon l'état, absent sans bascule", async () => {
    const toggles: string[] = []
    const { unmount } = render(<Harness initial={[]} split={false} onToggleSplit={() => toggles.push('x')} />)
    fireEvent.contextMenu(screen.getByTestId('zone-vide'))
    await userEvent.setup().click(await menuItem(/Scinder/))
    expect(toggles).toEqual(['x'])
    unmount()
    render(<Harness initial={[]} split onToggleSplit={() => {}} />)
    fireEvent.contextMenu(screen.getByTestId('zone-vide'))
    expect(await menuItem(/Réunir/)).toBeInTheDocument()
  })
})
