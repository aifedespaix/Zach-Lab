import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { hasExtension, useFileDropZone } from './useFileDropZone'

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn() }))

type DragHandler = (event: { payload: unknown }) => void
let handler: DragHandler | undefined

const zone = { current: document.createElement('div') }
const rect = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) }
const options = { extensions: ['.zmap', '.json'], onDrop: vi.fn(), rejectMessage: 'Refusé' }

beforeEach(() => {
  options.onDrop.mockClear()
  handler = undefined
  zone.current.getBoundingClientRect = () => rect as DOMRect
  vi.mocked(getCurrentWindow).mockReturnValue({
    onDragDropEvent: (fn: DragHandler) => {
      handler = fn
      return Promise.resolve(() => {})
    },
  } as unknown as ReturnType<typeof getCurrentWindow>)
})

describe('hasExtension', () => {
  it('compare sans tenir compte de la casse', () => {
    expect(hasExtension('C:/a/Carte.ZMAP', ['.zmap'])).toBe(true)
    expect(hasExtension('C:/a/notes.pdf', ['.zmap'])).toBe(false)
  })
})

describe('useFileDropZone', () => {
  it('ouvre le premier fichier accepté déposé dans la zone', async () => {
    const { result } = renderHook(() => useFileDropZone(zone, options))
    await act(async () => {})
    act(() => handler?.({ payload: { type: 'drop', position: { x: 10, y: 10 }, paths: ['a.pdf', 'b.zmap'] } }))
    expect(options.onDrop).toHaveBeenCalledWith('b.zmap')
    expect(result.current.dropError).toBeNull()
  })

  it('refuse un dépôt sans fichier accepté, avec le message fourni', async () => {
    const { result } = renderHook(() => useFileDropZone(zone, options))
    await act(async () => {})
    act(() => handler?.({ payload: { type: 'drop', position: { x: 10, y: 10 }, paths: ['a.pdf'] } }))
    expect(options.onDrop).not.toHaveBeenCalled()
    expect(result.current.dropError).toBe('Refusé')
  })

  it('ignore un dépôt hors de la zone', async () => {
    const { result } = renderHook(() => useFileDropZone(zone, options))
    await act(async () => {})
    act(() => handler?.({ payload: { type: 'drop', position: { x: 500, y: 500 }, paths: ['b.zmap'] } }))
    expect(options.onDrop).not.toHaveBeenCalled()
    expect(result.current.dropError).toBeNull()
  })

  it('signale le survol de la zone', async () => {
    const { result } = renderHook(() => useFileDropZone(zone, options))
    await act(async () => {})
    act(() => handler?.({ payload: { type: 'over', position: { x: 10, y: 10 } } }))
    expect(result.current.isDragActive).toBe(true)
    act(() => handler?.({ payload: { type: 'leave' } }))
    expect(result.current.isDragActive).toBe(false)
  })
})
