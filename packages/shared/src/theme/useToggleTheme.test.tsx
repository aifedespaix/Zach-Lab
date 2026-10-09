import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as reveal from './circularReveal'
import { ThemeToggle } from './ThemeToggle'
import { useThemeStore } from './useThemeStore'
import { useToggleTheme } from './useToggleTheme'

describe('useToggleTheme', () => {
  beforeEach(() => {
    useThemeStore.getState().setMode('light')
    document.documentElement.classList.remove('dark')
    vi.restoreAllMocks()
  })

  it('sans événement, le rond s\'ouvre en haut au centre', () => {
    const spy = vi.spyOn(reveal, 'startCircularThemeTransition').mockImplementation(({ apply }) => apply())
    const { result } = renderHook(() => useToggleTheme())
    act(() => result.current())
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ x: window.innerWidth / 2, y: 0 }))
    expect(useThemeStore.getState().mode).toBe('dark')
  })

  it('avec un événement, le rond s\'ouvre sous le pointeur ; deux appels reviennent au clair', () => {
    const spy = vi.spyOn(reveal, 'startCircularThemeTransition').mockImplementation(({ apply }) => apply())
    const { result } = renderHook(() => useToggleTheme())
    act(() => result.current({ clientX: 10, clientY: 20 }))
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ x: 10, y: 20 }))
    act(() => result.current())
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('le bouton bascule le thème', async () => {
    vi.spyOn(reveal, 'startCircularThemeTransition').mockImplementation(({ apply }) => apply())
    render(<ThemeToggle />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Basculer le thème' }))
    expect(useThemeStore.getState().mode).toBe('dark')
  })
})
