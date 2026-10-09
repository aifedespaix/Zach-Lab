import { useMemo } from 'react'
import { useAppId } from './appId'
import { viewStores } from './viewStores'
import { ZOOM_STEP } from './zoom'

/** The interface zoom: 50–150 %, steps of 10, remembered. Applied by `<SuiteApp>`. */
export function useUiZoom() {
  const store = viewStores(useAppId()).zoom
  const percent = store(state => state.value)
  return useMemo(
    () => ({
      percent,
      zoomIn: () => store.getState().set(current => current + ZOOM_STEP),
      zoomOut: () => store.getState().set(current => current - ZOOM_STEP),
      reset: () => store.getState().reset(),
      set: (next: number) => store.getState().set(next),
    }),
    [percent, store],
  )
}

/** The density: condensed or not, remembered. */
export function useDensity() {
  const store = viewStores(useAppId()).compact
  const compact = store(state => state.value)
  return useMemo(
    () => ({
      compact,
      toggle: () => store.getState().set(current => !current),
      set: (next: boolean) => store.getState().set(next),
    }),
    [compact, store],
  )
}

/** The interface font (a CSS `font-family`, empty = the theme's own), remembered. Applied by `<SuiteApp>`. */
export function useFontFamily() {
  const store = viewStores(useAppId()).font
  const fontFamily = store(state => state.value)
  return useMemo(
    () => ({ fontFamily, set: (next: string) => store.getState().set(next), reset: () => store.getState().reset() }),
    [fontFamily, store],
  )
}
