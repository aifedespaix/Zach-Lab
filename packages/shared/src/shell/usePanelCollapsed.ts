import { useCallback, useState } from 'react'

/**
 * Whether a side panel is folded away, remembered between launches.
 *
 * Same contract as `createPanelWidthStorage`: read synchronously on the first render (an effect
 * would paint the panel open for a frame and then fold it), a garbage value means "open", and a
 * blocked `localStorage` only costs the next launch its remembered state.
 */
export function usePanelCollapsed(key: string) {
  const [collapsed, set] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })

  const setCollapsed = useCallback(
    (next: boolean | ((current: boolean) => boolean)) => {
      set(current => {
        const value = typeof next === 'function' ? next(current) : next
        try {
          localStorage.setItem(key, value ? '1' : '0')
        } catch {
          // Best-effort: see the contract above.
        }
        return value
      })
    },
    [key],
  )

  return [collapsed, setCollapsed] as const
}
