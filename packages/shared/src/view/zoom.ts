export const ZOOM_MIN = 50
export const ZOOM_MAX = 150
export const ZOOM_STEP = 10
export const ZOOM_DEFAULT = 100

/** What the root element carries for a zoom level (S1, voie A : `zoom` CSS + the variables the stylesheet reads). */
export function zoomStyle(percent: number): { zoom: string; appZoom: string; appHeight: string } {
  const factor = percent / 100
  return {
    zoom: percent === ZOOM_DEFAULT ? '' : `${percent}%`,
    // Read by `theme.css`: Radix places its popovers with screen coordinates, which `zoom` would multiply a second time.
    appZoom: String(factor),
    // `vh` is not scaled by `zoom`: without the division, zoomed out a band is left empty at the bottom, zoomed in the page scrolls.
    appHeight: `calc(100vh / ${factor})`,
  }
}
