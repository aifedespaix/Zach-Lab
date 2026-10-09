import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusBannerStack } from './StatusBannerStack'
import { useAppStatus, useAppStatusStore } from './useAppStatus'

describe('pile de bandeaux', () => {
  beforeEach(() => useAppStatusStore.setState({ entries: [] }))

  it('affiche les bandeaux dans l\'ordre où ils sont poussés', () => {
    const { result } = renderHook(() => useAppStatus())
    render(<StatusBannerStack />)
    act(() => {
      result.current.push({ id: 'a', kind: 'info', text: 'Premier' })
      result.current.push({ id: 'b', kind: 'error', text: 'Second' })
    })
    const texts = [...document.querySelectorAll('.status-banner')].map(node => node.textContent)
    expect(texts).toEqual(['Premier', 'Second'])
  })

  it('pousser deux fois le même id remplace le bandeau sans changer son rang', () => {
    const { result } = renderHook(() => useAppStatus())
    render(<StatusBannerStack />)
    act(() => {
      result.current.push({ id: 'a', kind: 'info', text: 'Un' })
      result.current.push({ id: 'b', kind: 'info', text: 'Deux' })
      result.current.push({ id: 'a', kind: 'info', text: 'Un bis' })
    })
    expect([...document.querySelectorAll('.status-banner')].map(node => node.textContent)).toEqual(['Un bis', 'Deux'])
  })

  it('la croix appelle dismiss puis retire le bandeau ; remove le retire aussi', async () => {
    const user = userEvent.setup()
    const dismiss = vi.fn()
    const { result } = renderHook(() => useAppStatus())
    render(<StatusBannerStack />)
    act(() => {
      result.current.push({ id: 'a', kind: 'info', text: 'Un', dismiss, dismissLabel: 'Fermer' })
      result.current.push({ id: 'b', kind: 'error', text: 'Deux' })
    })
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(dismiss).toHaveBeenCalledOnce()
    expect(screen.queryByText('Un')).not.toBeInTheDocument()
    act(() => result.current.remove('b'))
    expect(screen.queryByText('Deux')).not.toBeInTheDocument()
  })
})
