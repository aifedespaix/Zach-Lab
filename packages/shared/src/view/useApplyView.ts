import { useEffect } from 'react'
import { viewStores } from './viewStores'
import { zoomStyle } from './zoom'

export interface ViewOptions {
  /** Interface zoom (commands, bar, settings). Default: on. */
  zoom?: boolean
  /** Condensed mode. Default: on. */
  density?: boolean
  /** Font choice in the settings. Default: on. */
  font?: boolean
}

/** Paints the view preferences on the root element: `zoom` and its variables, `--font-sans`. */
export function useApplyView(appId: string, view: ViewOptions = {}): void {
  const stores = viewStores(appId)
  const percent = stores.zoom(state => state.value)
  const font = stores.font(state => state.value)
  const zoomOn = view.zoom !== false
  const fontOn = view.font !== false

  useEffect(() => {
    if (!zoomOn) return
    const root = document.documentElement
    const style = zoomStyle(percent)
    root.style.zoom = style.zoom
    root.style.setProperty('--app-zoom', style.appZoom)
    root.style.setProperty('--app-height', style.appHeight)
    return () => {
      root.style.zoom = ''
      root.style.removeProperty('--app-zoom')
      root.style.removeProperty('--app-height')
    }
  }, [percent, zoomOn])

  useEffect(() => {
    if (!fontOn) return
    const root = document.documentElement
    if (font === '') root.style.removeProperty('--font-sans')
    else root.style.setProperty('--font-sans', font)
    return () => void root.style.removeProperty('--font-sans')
  }, [font, fontOn])
}
