import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppBoot } from './AppBoot'

describe('AppBoot', () => {
  afterEach(() => vi.useRealTimers())

  it('reste affiché jusqu\'au plancher, même prêt', () => {
    vi.useFakeTimers()
    render(<AppBoot ready floorMs={1000}><i>marque</i></AppBoot>)
    expect(screen.getByRole('status', { name: 'Chargement de l’application' })).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(999))
    expect(screen.getByText('marque')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(1))
    expect(screen.queryByText('marque')).not.toBeInTheDocument()
  })

  it('reste affiché après le plancher tant que l\'app n\'est pas prête, puis disparaît', () => {
    vi.useFakeTimers()
    const { rerender } = render(<AppBoot ready={false} floorMs={100}><i>marque</i></AppBoot>)
    act(() => void vi.advanceTimersByTime(5000))
    expect(screen.getByText('marque')).toBeInTheDocument()
    rerender(<AppBoot ready floorMs={100}><i>marque</i></AppBoot>)
    expect(screen.queryByText('marque')).not.toBeInTheDocument()
  })

  it('sans plancher, disparaît dès que l\'app est prête', () => {
    render(<AppBoot ready floorMs={0}><i>marque</i></AppBoot>)
    expect(screen.queryByText('marque')).not.toBeInTheDocument()
  })
})
