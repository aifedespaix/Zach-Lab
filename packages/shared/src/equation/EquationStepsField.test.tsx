import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EquationStepsField, type PlainEquationStep } from './EquationStepsField'

// MathLive qui ne se charge pas : le champ LaTeX brut doit suffire, c'est un éditeur complet.
vi.mock('mathlive', () => { throw new Error('indisponible') })

function Harness({ initial, onEnterBlock = vi.fn(), onDeleteEmpty = vi.fn() }: {
  initial: PlainEquationStep[]
  onEnterBlock?: (place: string) => void
  onDeleteEmpty?: () => void
}) {
  const [steps, setSteps] = useState(initial)
  return (
    <EquationStepsField
      steps={steps}
      onChange={setSteps}
      index={0}
      onEnterBlock={onEnterBlock}
      onDeleteEmpty={onDeleteEmpty}
      onDeleteForward={vi.fn()}
      onExitBlock={vi.fn()}
      onFieldChange={vi.fn()}
    />
  )
}
const left = (n: number) => screen.getByLabelText(`Membre gauche de l'étape ${n} du bloc 1 (LaTeX)`)

describe('EquationStepsField (repli brut)', () => {
  it('Entrée crée une étape et jamais un bloc', async () => {
    const onEnterBlock = vi.fn()
    render(<Harness initial={[{ left: '2x', right: '8' }]} onEnterBlock={onEnterBlock} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('{Enter}')
    expect(left(2)).toHaveFocus()
    expect(onEnterBlock).not.toHaveBeenCalled()
  })

  it("Entrée saute à l'étape suivante si elle est vide", async () => {
    render(<Harness initial={[{ left: 'a', right: 'b' }, { left: '', right: '' }]} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('{Enter}')
    expect(screen.getAllByLabelText(/Membre gauche/)).toHaveLength(2)
    expect(left(2)).toHaveFocus()
  })

  it("« = » dans le membre gauche n'écrit rien et passe au membre droit", async () => {
    render(<Harness initial={[{ left: '2x', right: '' }]} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('=')
    expect(left(1)).toHaveValue('2x')
    expect(screen.getByLabelText("Membre droit de l'étape 1 du bloc 1 (LaTeX)")).toHaveFocus()
  })

  it('« = » reste un caractère normal dans le membre droit', async () => {
    render(<Harness initial={[{ left: 'a', right: 'b' }]} />)
    const right = screen.getByLabelText("Membre droit de l'étape 1 du bloc 1 (LaTeX)")
    await userEvent.click(right)
    await userEvent.keyboard('=')
    expect(right).toHaveValue('b=')
  })

  it('Ctrl+Entrée demande un bloc après (outside), Ctrl+Maj+Entrée dedans (inside)', async () => {
    const onEnterBlock = vi.fn()
    render(<Harness initial={[{ left: 'a', right: 'b' }]} onEnterBlock={onEnterBlock} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(onEnterBlock).toHaveBeenLastCalledWith('outside')
    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}')
    expect(onEnterBlock).toHaveBeenLastCalledWith('inside')
  })

  it('Retour arrière dans une étape vide la supprime', async () => {
    render(<Harness initial={[{ left: 'a', right: 'b' }, { left: '', right: '' }]} />)
    await userEvent.click(left(2))
    await userEvent.keyboard('{Backspace}')
    expect(screen.getAllByLabelText(/Membre gauche/)).toHaveLength(1)
  })

  it("Retour arrière sur l'unique étape vide demande la suppression du bloc ; pas si elle a du contenu", async () => {
    const onDeleteEmpty = vi.fn()
    const { unmount } = render(<Harness initial={[{ left: '', right: '' }]} onDeleteEmpty={onDeleteEmpty} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('{Backspace}')
    expect(onDeleteEmpty).toHaveBeenCalledTimes(1)
    unmount()
    const again = vi.fn()
    render(<Harness initial={[{ left: '', right: '3' }]} onDeleteEmpty={again} />)
    await userEvent.click(left(1))
    await userEvent.keyboard('{Backspace}')
    expect(again).not.toHaveBeenCalled()
  })

  it('un Retour arrière MAINTENU ne traverse pas dans le champ du dessus', async () => {
    render(<Harness initial={[{ left: 'abc', right: 'def' }, { left: '', right: '' }]} />)
    await userEvent.click(left(2))
    await userEvent.keyboard('{Backspace>3/}')
    expect(screen.getByLabelText("Membre droit de l'étape 1 du bloc 1 (LaTeX)")).toHaveValue('def')
    expect(left(1)).toHaveValue('abc')
  })

  describe("bouton « Ajouter une étape » (l'équivalent d'Entrée, un seul par bloc)", () => {
    it('ajoute une étape en fin de bloc et met le curseur sur son membre gauche', async () => {
      render(<Harness initial={[{ left: '2x', right: '8' }]} />)
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter une étape' }))
      expect(screen.getAllByLabelText(/Membre gauche/)).toHaveLength(2)
      expect(left(2)).toHaveFocus()
    })

    it("si la dernière étape est déjà vide, il y va au lieu d'en empiler une autre", async () => {
      render(<Harness initial={[{ left: 'a', right: 'b' }, { left: '', right: '' }]} />)
      await userEvent.click(screen.getByRole('button', { name: 'Ajouter une étape' }))
      expect(screen.getAllByLabelText(/Membre gauche/)).toHaveLength(2)
      expect(left(2)).toHaveFocus()
    })

    it("il n'y en a qu'un par bloc", () => {
      render(<Harness initial={[{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }, { left: '', right: '' }]} />)
      expect(screen.getAllByRole('button', { name: 'Ajouter une étape' })).toHaveLength(1)
    })
  })
})
