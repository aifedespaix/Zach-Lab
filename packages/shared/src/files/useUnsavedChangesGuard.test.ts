import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn() }))

const destroy = vi.fn()
let onClose: ((event: { preventDefault: () => void }) => Promise<void>) | undefined

beforeEach(() => {
  destroy.mockReset().mockResolvedValue(undefined)
  onClose = undefined
  vi.mocked(getCurrentWindow).mockReturnValue({
    destroy,
    onCloseRequested: (fn: typeof onClose) => {
      onClose = fn
      return Promise.resolve(() => {})
    },
  } as unknown as ReturnType<typeof getCurrentWindow>)
})

const closeEvent = () => ({ preventDefault: vi.fn() })

describe('useUnsavedChangesGuard — ouverture', () => {
  it("lance l'action une fois la sauvegarde réussie", async () => {
    const flush = vi.fn().mockResolvedValue(undefined)
    const action = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(flush))
    act(() => result.current.guard(action))
    await waitFor(() => expect(action).toHaveBeenCalledOnce())
    expect(result.current.prompt).toBeNull()
  })

  it("ne lance pas l'action et propose de continuer si la sauvegarde échoue", async () => {
    const flush = vi.fn().mockRejectedValue(new Error('disque plein'))
    const action = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(flush))
    act(() => result.current.guard(action))
    await waitFor(() => expect(result.current.prompt).not.toBeNull())
    expect(action).not.toHaveBeenCalled()
    expect(result.current.prompt?.message).toContain('disque plein')
    expect(result.current.prompt?.continueLabel).toBe('Ouvrir quand même')
    act(() => result.current.prompt?.onContinue?.())
    expect(action).toHaveBeenCalledOnce()
    expect(result.current.prompt).toBeNull()
  })
})

describe('useUnsavedChangesGuard — fermeture', () => {
  it('annule la fermeture, sauvegarde, puis détruit la fenêtre', async () => {
    const flush = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useUnsavedChangesGuard(flush))
    await waitFor(() => expect(onClose).toBeDefined())
    const event = closeEvent()
    await act(async () => {
      await onClose?.(event)
    })
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(flush).toHaveBeenCalledOnce()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('propose de quitter quand même si la sauvegarde échoue, sans détruire la fenêtre', async () => {
    const flush = vi.fn().mockRejectedValue(new Error('réseau'))
    const { result } = renderHook(() => useUnsavedChangesGuard(flush))
    await waitFor(() => expect(onClose).toBeDefined())
    await act(async () => {
      await onClose?.(closeEvent())
    })
    expect(destroy).not.toHaveBeenCalled()
    expect(result.current.prompt?.continueLabel).toBe('Quitter quand même')
    await act(async () => {
      result.current.prompt?.onContinue?.()
    })
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('attend beforeClose avec l’indicateur `closing`, puis ferme même si beforeClose échoue', async () => {
    const flush = vi.fn().mockResolvedValue(undefined)
    let finishSync: () => void = () => {}
    const beforeClose = vi.fn(() => new Promise<void>((_resolve, reject) => {
      finishSync = () => reject(new Error('sync'))
    }))
    const { result } = renderHook(() => useUnsavedChangesGuard(flush, { beforeClose }))
    await waitFor(() => expect(onClose).toBeDefined())
    let closing: Promise<void> = Promise.resolve()
    act(() => {
      closing = onClose?.(closeEvent()) ?? Promise.resolve()
    })
    await waitFor(() => expect(result.current.closing).toBe(true))
    expect(destroy).not.toHaveBeenCalled()
    await act(async () => {
      finishSync()
      await closing
    })
    expect(destroy).toHaveBeenCalledOnce()
    expect(result.current.closing).toBe(false)
  })
})
