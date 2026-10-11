import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useWindowTitle } from './useWindowTitle'

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn() }))

const setTitle = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  setTitle.mockClear()
  vi.mocked(getCurrentWindow).mockReturnValue({ setTitle } as unknown as ReturnType<typeof getCurrentWindow>)
})

describe('useWindowTitle', () => {
  it('pose le titre donné, et le remet à jour quand il change', () => {
    const { rerender } = renderHook(({ title }) => useWindowTitle(title), { initialProps: { title: 'App' } })
    expect(setTitle).toHaveBeenLastCalledWith('App')
    rerender({ title: 'App - notes' })
    expect(setTitle).toHaveBeenLastCalledWith('App - notes')
  })

  it("ne lève rien hors d'une fenêtre Tauri", () => {
    vi.mocked(getCurrentWindow).mockImplementation(() => {
      throw new Error('not in tauri')
    })
    expect(() => renderHook(() => useWindowTitle('App'))).not.toThrow()
  })
})
