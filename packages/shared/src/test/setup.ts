import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

/*
 * @testing-library/react's async event wrapper (used by userEvent's `await user.click(...)`
 * etc.) drains the microtask queue with a real `setTimeout(fn, 0)`, then flushes it itself —
 * but only if it detects fake timers, and it only ever looks for Jest's, via a global `jest`
 * with a faked `setTimeout`. Vitest's `vi.useFakeTimers()` never defines a global `jest`, so
 * any `await user.<action>()` issued while fake timers are active hangs forever.
 *
 * This shim gives the detection a `jest` global that forwards to Vitest's real fake-timer
 * control (a no-op under real timers).
 */
if (typeof (globalThis as { jest?: unknown }).jest === 'undefined') {
  ;(globalThis as unknown as { jest: { advanceTimersByTime: typeof vi.advanceTimersByTime } }).jest = {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  }
}

// jsdom implements no ResizeObserver, and Radix measures with one.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
