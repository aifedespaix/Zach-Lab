import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePanelCollapsed } from './usePanelCollapsed'

const KEY = 'test:collapsed'

describe('usePanelCollapsed', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('est déplié par défaut', () => {
    expect(renderHook(() => usePanelCollapsed(KEY)).result.current[0]).toBe(false)
  })

  it('mémorise le rangement et le relit au montage suivant', () => {
    const first = renderHook(() => usePanelCollapsed(KEY))
    act(() => first.result.current[1](true))
    expect(first.result.current[0]).toBe(true)
    first.unmount()
    expect(renderHook(() => usePanelCollapsed(KEY)).result.current[0]).toBe(true)
  })

  it('accepte une fonction, pour basculer', () => {
    const { result } = renderHook(() => usePanelCollapsed(KEY))
    act(() => result.current[1](c => !c))
    expect(result.current[0]).toBe(true)
    act(() => result.current[1](c => !c))
    expect(result.current[0]).toBe(false)
  })

  it('une valeur stockée absurde laisse le panneau déplié', () => {
    localStorage.setItem(KEY, 'peut-être')
    expect(renderHook(() => usePanelCollapsed(KEY)).result.current[0]).toBe(false)
  })

  it('un stockage bloqué ne lève jamais, en lecture comme en écriture', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqué')
    })
    const { result } = renderHook(() => usePanelCollapsed(KEY))
    expect(result.current[0]).toBe(false)
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
  })
})
