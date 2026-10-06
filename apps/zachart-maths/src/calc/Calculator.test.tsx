import { render, screen } from '@testing-library/react'
import { TooltipProvider } from '@suite/shared/ui'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Calculator } from './Calculator'
import { useCalculatorStore } from './useCalculatorStore'

const setup = () => {
  render(<TooltipProvider><Calculator /></TooltipProvider>)
  return { user: userEvent.setup(), field: screen.getByLabelText('Calcul') as HTMLInputElement }
}

describe('Calculator', () => {
  beforeEach(() => useCalculatorStore.setState({ expression: '', history: [] }))

  it('au clavier : on tape, le résultat se montre en direct, Entrée le range', async () => {
    const { user, field } = setup()
    await user.type(field, '12,5×2')
    expect(screen.getByRole('status')).toHaveTextContent('= 25')
    await user.keyboard('{Enter}')
    expect(field).toHaveValue('25')
    expect(screen.getByRole('button', { name: 'Reprendre 12,5×2' })).toHaveTextContent('12,5×2 = 25')
  })

  it('à la souris : les touches insèrent, = calcule', async () => {
    const { user, field } = setup()
    for (const name of ['7', 'Multiplié par', '6']) await user.click(screen.getByRole('button', { name }))
    expect(field).toHaveValue('7×6')
    await user.click(screen.getByRole('button', { name: 'Calculer' }))
    expect(field).toHaveValue('42')
  })

  it('⌫ efface un caractère, C tout, Échap tout', async () => {
    const { user, field } = setup()
    await user.type(field, '123')
    await user.click(screen.getByRole('button', { name: 'Effacer un caractère' }))
    expect(field).toHaveValue('12')
    await user.click(screen.getByRole('button', { name: 'Tout effacer' }))
    expect(field).toHaveValue('')
    await user.type(field, '9{Escape}')
    expect(field).toHaveValue('')
  })

  it('√, x² et Rép', async () => {
    const { user, field } = setup()
    await user.type(field, '3')
    await user.click(screen.getByRole('button', { name: 'Au carré' }))
    await user.keyboard('{Enter}')
    expect(field).toHaveValue('9')
    await user.click(screen.getByRole('button', { name: 'Tout effacer' }))
    await user.click(screen.getByRole('button', { name: 'Dernier résultat' }))
    await user.click(screen.getByRole('button', { name: 'Plus' }))
    await user.click(screen.getByRole('button', { name: '1' }))
    expect(screen.getByRole('status')).toHaveTextContent('= 10')
  })

  it('une division par zéro est dite, un calcul incomplet seulement après Entrée', async () => {
    const { user, field } = setup()
    await user.type(field, '1÷0')
    expect(screen.getByRole('status')).toHaveTextContent('Calcul impossible')
    await user.clear(field)
    await user.type(field, '2+')
    expect(screen.getByRole('status')).toHaveTextContent('')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('Calcul incomplet')
  })

  it('le calcul en cours survit à un changement d\'onglet', async () => {
    const first = setup()
    await first.user.type(first.field, '8+')
    document.body.innerHTML = ''
    const second = setup()
    expect(second.field).toHaveValue('8+')
  })

  it('copie le résultat affiché, et se grise tant que le calcul est vide', async () => {
    const { user, field } = setup()
    const copy = screen.getByRole('button', { name: 'Copier le résultat' })
    expect(copy).toBeDisabled()
    await user.type(field, '12,5×2')
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await user.click(copy)
    expect(write).toHaveBeenCalledWith('25')
    expect(await screen.findByRole('button', { name: 'Résultat copié' })).toBeInTheDocument()
  })
})
