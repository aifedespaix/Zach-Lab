import { create } from 'zustand'

export const COMPACT_KEY = 'zachart-maths:compact'

function readCompact(): boolean {
  try {
    return localStorage.getItem(COMPACT_KEY) === 'on'
  } catch {
    return false
  }
}

interface CompactStore {
  enabled: boolean
  toggle(): void
}

/** Le mode condensé : réduit marges et paddings de la zone centrale. Désactivé par défaut. */
export const useCompact = create<CompactStore>((set, get) => ({
  enabled: readCompact(),
  toggle: () => {
    const enabled = !get().enabled
    set({ enabled })
    try {
      localStorage.setItem(COMPACT_KEY, enabled ? 'on' : 'off')
    } catch {
      // Stockage indisponible : le choix vaut pour la session.
    }
  },
}))

/** Les espacements de la zone centrale, normal ou condensé. */
export function spacing(compact: boolean) {
  return compact
    ? { zone: 4, outer: 4, header: 6, footer: 6, stackGap: 3, cardPad: 3 }
    : { zone: 16, outer: 8, header: 12, footer: 12, stackGap: 8, cardPad: 8 }
}
