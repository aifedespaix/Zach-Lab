import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TwoStepButton } from './TwoStepButton'

afterEach(() => vi.useRealTimers())

describe('TwoStepButton', () => {
  it('arme au premier clic, exécute au second', () => {
    const onConfirm = vi.fn()
    render(<TwoStepButton label="Supprimer" onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
  })

  it('se désarme après 4 s', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    render(<TwoStepButton label="Supprimer" onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    act(() => { vi.advanceTimersByTime(4001) })
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
