import type { PointerEvent as ReactPointerEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DRAG_THRESHOLD_PX, HOVER_EXPAND_MS, beginTreeDrag, consumeSwallowedClick, dropTargetAt, type TreeDragHandlers } from './treeDrag'
import { useTreeDragStore } from './useTreeDragStore'

const originalElementFromPoint = document.elementFromPoint as ((x: number, y: number) => Element | null) | undefined

/** jsdom has no `elementFromPoint` at all, so it is installed rather than spied on. */
function installElementFromPoint() {
  Object.defineProperty(document, 'elementFromPoint', { value: vi.fn(() => null), writable: true, configurable: true })
}
function restoreElementFromPoint() {
  if (originalElementFromPoint === undefined) delete (document as unknown as Record<string, unknown>).elementFromPoint
  else document.elementFromPoint = originalElementFromPoint
}
const pointAt = (element: Element | null) => vi.mocked(document.elementFromPoint).mockReturnValue(element)

function pointerEvent(type: string, init: PointerEventInit): Event {
  const Constructor = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent
  return new Constructor(type, init)
}
const press = (x = 10, y = 10, button = 0) => ({ button, clientX: x, clientY: y }) as ReactPointerEvent<HTMLElement>
const move = (x: number, y: number) => window.dispatchEvent(pointerEvent('pointermove', { clientX: x, clientY: y }))
const release = () => window.dispatchEvent(pointerEvent('pointerup', {}))

const FILE = { path: 'A/un.json', name: 'Un', kind: 'file' }

function handlers(over: Partial<TreeDragHandlers> = {}): TreeDragHandlers {
  return {
    canDrop: vi.fn(() => true),
    isExpanded: vi.fn(() => true),
    expand: vi.fn(),
    onDrop: vi.fn(),
    ...over,
  }
}

describe('dropTargetAt', () => {
  beforeEach(() => {
    installElementFromPoint()
    document.body.innerHTML = `
      <div data-drop-folder="B">
        <button data-tree-row="B" data-tree-kind="folder">B</button>
        <button data-tree-row="B/deux.json" data-tree-kind="file">Deux</button>
      </div>`
  })
  afterEach(() => {
    document.body.innerHTML = ''
    restoreElementFromPoint()
  })

  it('reads the folder header under the pointer', () => {
    pointAt(document.querySelector('[data-tree-row="B"]'))
    expect(dropTargetAt(1, 1)).toBe('B')
  })
  it('resolves a file to the folder that encloses it', () => {
    pointAt(document.querySelector('[data-tree-row="B/deux.json"]'))
    expect(dropTargetAt(1, 1)).toBe('B')
  })
  it('finds no destination over empty space, or where the engine has no elementFromPoint', () => {
    pointAt(null)
    expect(dropTargetAt(1, 1)).toBeNull()
    delete (document as unknown as Record<string, unknown>).elementFromPoint
    expect(dropTargetAt(1, 1)).toBeNull()
  })
})

describe('beginTreeDrag', () => {
  beforeEach(() => {
    installElementFromPoint()
    document.body.innerHTML = '<div data-drop-folder="B"><button data-tree-row="B" data-tree-kind="folder">B</button></div>'
    pointAt(document.querySelector('[data-tree-row="B"]'))
    useTreeDragStore.setState({ source: null, pointer: null, targetPath: null })
    consumeSwallowedClick() // start from a clean module state
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    restoreElementFromPoint()
  })

  it('does not start below the threshold, and the click that follows is not swallowed', () => {
    const h = handlers()
    beginTreeDrag(press(10, 10), FILE, h)
    move(10 + DRAG_THRESHOLD_PX - 1, 10)
    expect(useTreeDragStore.getState().source).toBeNull()
    release()
    expect(h.onDrop).not.toHaveBeenCalled()
    expect(consumeSwallowedClick()).toBe(false)
  })

  it('starts past the threshold and the pointer follows', () => {
    beginTreeDrag(press(10, 10), FILE, handlers())
    move(40, 25)
    const { source, pointer } = useTreeDragStore.getState()
    expect(source).toEqual(FILE)
    expect(pointer).toEqual({ x: 40, y: 25 })
    release()
  })

  it('keeps the target only if canDrop accepts it', () => {
    const h = handlers({ canDrop: vi.fn(() => false) })
    beginTreeDrag(press(), FILE, h)
    move(60, 60)
    expect(useTreeDragStore.getState().targetPath).toBeNull()
    release()
    expect(h.onDrop).not.toHaveBeenCalled()
  })

  it('drops once on a valid target, then swallows exactly one click', () => {
    const h = handlers()
    beginTreeDrag(press(), FILE, h)
    move(60, 60)
    expect(useTreeDragStore.getState().targetPath).toBe('B')
    release()
    expect(h.onDrop).toHaveBeenCalledTimes(1)
    expect(h.onDrop).toHaveBeenCalledWith(FILE, 'B')
    expect(useTreeDragStore.getState().source).toBeNull()
    expect(consumeSwallowedClick()).toBe(true)
    expect(consumeSwallowedClick()).toBe(false)
  })

  it('a drag that ends over empty space drops nothing, and the next press clears the swallowed click', () => {
    pointAt(null)
    const h = handlers()
    beginTreeDrag(press(), FILE, h)
    move(60, 60)
    release()
    expect(h.onDrop).not.toHaveBeenCalled()
    // The tail click of that drag would be swallowed… but a fresh press must not inherit it.
    beginTreeDrag(press(), FILE, handlers())
    expect(consumeSwallowedClick()).toBe(false)
    release()
  })

  it.each([
    ['Escape', () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
    ['blur', () => window.dispatchEvent(new Event('blur'))],
    ['pointercancel', () => window.dispatchEvent(pointerEvent('pointercancel', {}))],
  ])('%s cancels without dropping, clears the store and the listeners', (_name, cancel) => {
    const h = handlers()
    beginTreeDrag(press(), FILE, h)
    move(60, 60)
    cancel()
    expect(useTreeDragStore.getState()).toMatchObject({ source: null, pointer: null, targetPath: null })
    release()
    expect(h.onDrop).not.toHaveBeenCalled()
    const calls = vi.mocked(h.canDrop).mock.calls.length
    move(90, 90)
    expect(vi.mocked(h.canDrop).mock.calls.length).toBe(calls)
    expect(consumeSwallowedClick()).toBe(true)
  })

  it('ignores a non-primary press (a right-click opens the menu, it never drags)', () => {
    const h = handlers()
    beginTreeDrag(press(10, 10, 2), FILE, h)
    move(80, 80)
    release()
    expect(useTreeDragStore.getState().source).toBeNull()
    expect(h.onDrop).not.toHaveBeenCalled()
    expect(consumeSwallowedClick()).toBe(false)
  })

  describe('hover-to-expand', () => {
    it('opens a closed folder after the delay, once', () => {
      vi.useFakeTimers()
      const h = handlers({ isExpanded: vi.fn(() => false) })
      beginTreeDrag(press(), FILE, h)
      move(60, 60)
      vi.advanceTimersByTime(HOVER_EXPAND_MS - 1)
      expect(h.expand).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(h.expand).toHaveBeenCalledTimes(1)
      expect(h.expand).toHaveBeenCalledWith('B')
      move(61, 61)
      vi.advanceTimersByTime(HOVER_EXPAND_MS * 2)
      expect(h.expand).toHaveBeenCalledTimes(1)
      release()
    })

    it('never opens a folder that is already open', () => {
      vi.useFakeTimers()
      const h = handlers({ isExpanded: vi.fn(() => true) })
      beginTreeDrag(press(), FILE, h)
      move(60, 60)
      vi.advanceTimersByTime(HOVER_EXPAND_MS * 2)
      expect(h.expand).not.toHaveBeenCalled()
      release()
    })

    it('does not open a folder the pointer left in the meantime', () => {
      vi.useFakeTimers()
      const h = handlers({ isExpanded: vi.fn(() => false) })
      beginTreeDrag(press(), FILE, h)
      move(60, 60)
      vi.advanceTimersByTime(HOVER_EXPAND_MS - 100)
      pointAt(null)
      move(70, 70)
      vi.advanceTimersByTime(HOVER_EXPAND_MS)
      expect(h.expand).not.toHaveBeenCalled()
      release()
    })

    it('does not open anything once the drop has happened', () => {
      vi.useFakeTimers()
      const h = handlers({ isExpanded: vi.fn(() => false) })
      beginTreeDrag(press(), FILE, h)
      move(60, 60)
      release()
      vi.advanceTimersByTime(HOVER_EXPAND_MS * 2)
      expect(h.expand).not.toHaveBeenCalled()
    })
  })
})
