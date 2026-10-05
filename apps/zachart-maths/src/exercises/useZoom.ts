import { create } from 'zustand'

export const ZOOM_KEY = 'zachart-maths:zoom'
export const ZOOM_MIN = 50
export const ZOOM_MAX = 150
export const ZOOM_STEP = 10

const clamp = (percent: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(percent / ZOOM_STEP) * ZOOM_STEP))

function readZoom(): number {
  try {
    const stored = Number(localStorage.getItem(ZOOM_KEY))
    return Number.isFinite(stored) && stored > 0 ? clamp(stored) : 100
  } catch {
    return 100
  }
}

interface ZoomStore {
  /** Taille de l'application en %, de 50 à 150, par pas de 10. */
  percent: number
  zoomIn(): void
  zoomOut(): void
  reset(): void
}

/** Le zoom de la barre du haut : un réglage immédiat, retenu d'un lancement à l'autre. */
export const useZoom = create<ZoomStore>((set, get) => {
  const apply = (percent: number) => {
    set({ percent })
    try {
      localStorage.setItem(ZOOM_KEY, String(percent))
    } catch {
      // Stockage indisponible : le choix vaut pour la session.
    }
  }
  return {
    percent: readZoom(),
    zoomIn: () => apply(clamp(get().percent + ZOOM_STEP)),
    zoomOut: () => apply(clamp(get().percent - ZOOM_STEP)),
    reset: () => apply(100),
  }
})
