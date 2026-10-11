import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutosave } from './useAutosave'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useAutosave', () => {
  it('writes the latest value once the delay has passed', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(({ v }) => useAutosave(save, v, { delay: 500 }), { initialProps: { v: 'a' } })
    rerender({ v: 'b' })
    act(() => void vi.advanceTimersByTime(499))
    expect(save).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith('b')
  })

  it('never writes while disabled (a slow or failed load must not overwrite the file)', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(save, 'transient', { enabled: false }))
    act(() => void vi.advanceTimersByTime(5000))
    expect(save).not.toHaveBeenCalled()
    return act(async () => { await result.current.flush() }).then(() => expect(save).not.toHaveBeenCalled())
  })

  it('flush writes at once and cancels the pending timer', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(save, 'a'))
    await act(async () => { await result.current.flush() })
    expect(save).toHaveBeenCalledOnce()
    act(() => void vi.advanceTimersByTime(5000))
    expect(save).toHaveBeenCalledOnce()
    // Rien de nouveau : un second flush ne réécrit pas.
    await act(async () => { await result.current.flush() })
    expect(save).toHaveBeenCalledOnce()
  })

  it('reports a failed write and stays flushable', async () => {
    const onError = vi.fn()
    const save = vi.fn().mockRejectedValueOnce(new Error('disk')).mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave(save, 'a', { onError }))
    await act(async () => void vi.advanceTimersByTime(600))
    expect(onError).toHaveBeenCalledOnce()
    await act(async () => { await result.current.flush() })
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('flush rejects (and reports) when the write fails', async () => {
    const onError = vi.fn()
    const save = vi.fn().mockRejectedValue(new Error('disk'))
    const { result } = renderHook(() => useAutosave(save, 'a', { onError }))
    await act(async () => { await expect(result.current.flush()).rejects.toThrow('disk') })
    expect(onError).toHaveBeenCalledOnce()
  })

  it('re-arms when the scope (the path) changes', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(({ s }) => useAutosave(save, 'same', { scope: s }), { initialProps: { s: 'x' } })
    act(() => void vi.advanceTimersByTime(600))
    rerender({ s: 'y' })
    act(() => void vi.advanceTimersByTime(600))
    expect(save).toHaveBeenCalledTimes(2)
  })
})
