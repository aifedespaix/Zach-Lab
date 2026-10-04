import { create } from 'zustand'

export const UNIT_COLORS_KEY = 'zachart-maths:unit-colors'

/** Activé tant qu'on n'a pas écrit `off` : un stockage absent ou illisible ne coupe pas la fonction. */
function readEnabled(): boolean {
  try {
    return localStorage.getItem(UNIT_COLORS_KEY) !== 'off'
  } catch {
    return true
  }
}

interface UnitColorsStore {
  enabled: boolean
  toggle(): void
}

/**
 * Le bouton « Colorer unités et termes » de la barre du haut. Un réglage immédiat : il ne passe pas par
 * « Enregistrer » de la fenêtre des Paramètres, comme le thème.
 */
export const useUnitColors = create<UnitColorsStore>((set, get) => ({
  enabled: readEnabled(),
  toggle: () => {
    const enabled = !get().enabled
    set({ enabled })
    try {
      localStorage.setItem(UNIT_COLORS_KEY, enabled ? 'on' : 'off')
    } catch {
      // Stockage indisponible : le choix vaut pour la session, il ne survivra pas au redémarrage.
    }
  },
}))
