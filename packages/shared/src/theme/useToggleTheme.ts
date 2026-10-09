import { useCallback } from 'react'
import { startCircularThemeTransition } from './circularReveal'
import { useResolvedTheme } from './useResolvedTheme'
import { useThemeStore } from './useThemeStore'

/**
 * Flips light ↔ dark with the circular reveal. It opens from `origin` (the click that asked for it)
 * when given, from the top centre of the window otherwise (a shortcut has no pointer).
 */
export function useToggleTheme(): (origin?: { clientX: number; clientY: number }) => void {
  const resolved = useResolvedTheme()
  return useCallback(
    origin => {
      startCircularThemeTransition({
        x: origin?.clientX ?? window.innerWidth / 2,
        y: origin?.clientY ?? 0,
        apply: () => useThemeStore.getState().setMode(resolved === 'dark' ? 'light' : 'dark'),
      })
    },
    [resolved],
  )
}
