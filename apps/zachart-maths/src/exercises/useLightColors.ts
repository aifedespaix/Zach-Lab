import { create } from 'zustand'

export const LIGHT_COLORS_KEY = 'zachart-maths:light-colors'

/** Éteint tant qu'on n'a pas écrit `on` : par défaut l'interface garde ses fonds colorés. */
function readEnabled(): boolean {
  try {
    return localStorage.getItem(LIGHT_COLORS_KEY) === 'on'
  } catch {
    return false
  }
}

interface LightColorsStore {
  enabled: boolean
  toggle(): void
}

/**
 * Le bouton « Couleurs légères » de la barre du haut : les fonds teintés (barre d'outils, blocs, énoncé, réponse)
 * s'effacent, les bordures de couleur restent. `App` pose l'attribut `data-light-colors` sur la racine, `index.css`
 * et `toneOf` font le reste.
 */
export const useLightColors = create<LightColorsStore>((set, get) => ({
  enabled: readEnabled(),
  toggle: () => {
    const enabled = !get().enabled
    set({ enabled })
    try {
      localStorage.setItem(LIGHT_COLORS_KEY, enabled ? 'on' : 'off')
    } catch {
      // Stockage indisponible : le choix vaut pour la session.
    }
  },
}))
