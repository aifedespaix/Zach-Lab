import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LinesBlockField } from './LinesBlockField'
import type { SubLine } from './lines'

vi.mock('mathlive', () => { throw new Error('indisponible') })

const L = (id: string, latex = ''): SubLine => ({ id, latex })
const line = (n: number) => screen.getByLabelText(`Ligne ${n} du calcul (LaTeX)`)

function Harness({ initial, onEnterBlock = vi.fn(), onDeleteEmpty = vi.fn(), onExitBlock = vi.fn() }: {
  initial: SubLine[]
  onEnterBlock?: (place: string) => void
  onDeleteEmpty?: () => void
  onExitBlock?: (side: string) => void
}) {
  const [lines, setLines] = useState(initial)
  return (
    <LinesBlockField
      lines={lines}
      onChange={setLines}
      ariaLabel="Calcul"
      onEnterBlock={onEnterBlock}
      onDeleteEmpty={onDeleteEmpty}
      onDeleteForward={vi.fn()}
      onExitBlock={onExitBlock}
      onFieldChange={vi.fn()}
    />
  )
}

describe('LinesBlockField', () => {
  it('Entrée crée une ligne juste en dessous, avec le curseur, sans créer de bloc', async () => {
    const onEnterBlock = vi.fn()
    render(<Harness initial={[L('a', '1+1'), L('b', '3')]} onEnterBlock={onEnterBlock} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{Enter}')
    expect(screen.getAllByLabelText(/Ligne \d du calcul/)).toHaveLength(3)
    expect(line(2)).toHaveValue('')
    expect(line(2)).toHaveFocus()
    expect(line(3)).toHaveValue('3')
    expect(onEnterBlock).not.toHaveBeenCalled()
  })

  it("Entrée donne le curseur à la nouvelle ligne même si le parent applique le changement plus tard (store, autosave)", async () => {
    function AsyncHarness({ initial }: { initial: SubLine[] }) {
      const [lines, setLines] = useState(initial)
      return (
        <LinesBlockField
          lines={lines}
          onChange={next => void setTimeout(() => setLines(next), 0)}
          ariaLabel="Calcul"
          onEnterBlock={vi.fn()}
          onDeleteEmpty={vi.fn()}
          onDeleteForward={vi.fn()}
          onExitBlock={vi.fn()}
          onFieldChange={vi.fn()}
        />
      )
    }
    render(<AsyncHarness initial={[L('a', '1+1')]} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{Enter}')
    await screen.findByLabelText('Ligne 2 du calcul (LaTeX)')
    expect(line(2)).toHaveFocus()
  })

  it('Entrée saute à la ligne suivante si elle est déjà vide', async () => {
    render(<Harness initial={[L('a', 'x'), L('b')]} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{Enter}')
    expect(screen.getAllByLabelText(/Ligne \d du calcul/)).toHaveLength(2)
    expect(line(2)).toHaveFocus()
  })

  it('↑ ↓ passent de ligne en ligne ; ↑ sur la première sort par le haut, ↓ sur la dernière par le bas', async () => {
    const onExitBlock = vi.fn()
    render(<Harness initial={[L('a', 'x'), L('b', 'y')]} onExitBlock={onExitBlock} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{ArrowDown}')
    expect(line(2)).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(onExitBlock).toHaveBeenLastCalledWith('after')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(onExitBlock).toHaveBeenLastCalledWith('before')
  })

  it("← au tout début d'une ligne va à la fin de la précédente", async () => {
    render(<Harness initial={[L('a', 'xy'), L('b', 'z')]} />)
    await userEvent.click(line(2))
    ;(line(2) as HTMLInputElement).setSelectionRange(0, 0)
    await userEvent.keyboard('{ArrowLeft}')
    expect(line(1)).toHaveFocus()
  })

  it('Retour arrière sur une ligne vide la supprime et remonte', async () => {
    render(<Harness initial={[L('a', 'x'), L('b')]} />)
    await userEvent.click(line(2))
    await userEvent.keyboard('{Backspace}')
    expect(screen.getAllByLabelText(/Ligne \d du calcul/)).toHaveLength(1)
    expect(line(1)).toHaveFocus()
  })

  it("l'unique ligne vide d'un bloc vide demande la suppression du bloc, pas celle d'un bloc non vide", async () => {
    const onDeleteEmpty = vi.fn()
    const { unmount } = render(<Harness initial={[L('a')]} onDeleteEmpty={onDeleteEmpty} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{Backspace}')
    expect(onDeleteEmpty).toHaveBeenCalledTimes(1)
    unmount()
    const other = vi.fn()
    render(<Harness initial={[L('a', 'x'), L('b')]} onDeleteEmpty={other} />)
    await userEvent.click(line(2))
    await userEvent.keyboard('{Backspace}')
    expect(other).not.toHaveBeenCalled()
  })

  it('un Retour arrière maintenu ne traverse pas dans la ligne du dessus', async () => {
    render(<Harness initial={[L('a', 'abc'), L('b')]} />)
    await userEvent.click(line(2))
    await userEvent.keyboard('{Backspace>3/}')
    expect(line(1)).toHaveValue('abc')
  })

  it('Ctrl+Entrée demande un bloc après', async () => {
    const onEnterBlock = vi.fn()
    render(<Harness initial={[L('a', 'x')]} onEnterBlock={onEnterBlock} />)
    await userEvent.click(line(1))
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(onEnterBlock).toHaveBeenCalledWith('outside')
  })

  // Le clavier suffit toujours (Entrée) ; un seul bouton discret par BLOC — pas un par ligne — en est
  // l'équivalent à la souris. Demandé par l'utilisateur, il remplace l'ancienne règle « aucun bouton ».
  describe("bouton « Ajouter une ligne » (l'équivalent d'Entrée, un seul par bloc)", () => {
    it('ajoute une ligne en fin de bloc et lui donne le curseur', async () => {
      render(<Harness initial={[L('a', '1+1'), L('b', '3')]} />)
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne' }))
      expect(screen.getAllByLabelText(/Ligne \d du calcul/)).toHaveLength(3)
      expect(line(3)).toHaveValue('')
      expect(line(3)).toHaveFocus()
    })

    it("comme Entrée sur la dernière ligne : si elle est déjà vide, il y va au lieu d'en empiler une autre", async () => {
      render(<Harness initial={[L('a', '1+1'), L('b')]} />)
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne' }))
      expect(screen.getAllByLabelText(/Ligne \d du calcul/)).toHaveLength(2)
      expect(line(2)).toHaveFocus()
    })

    it("il n'y en a qu'un par bloc, pas un par ligne", () => {
      render(<Harness initial={[L('a'), L('b'), L('c')]} />)
      expect(screen.getAllByRole('button', { name: 'Ajouter une ligne' })).toHaveLength(1)
    })
  })
})
