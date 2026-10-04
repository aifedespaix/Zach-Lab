import { create } from 'zustand'

const HIDDEN_KEY = 'zachart-maths:toolbar-hidden'

function readHidden(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : []
  } catch {
    return [] // stockage absent ou corrompu : toutes les familles restent visibles
  }
}

interface ToolbarFamiliesStore {
  /** Les familles masquées, et non les visibles : une famille ajoutée au catalogue apparaît d'elle-même. */
  hidden: string[]
  setVisible(family: string, visible: boolean): void
  /** Les trois ci-dessous sont la `SettingsSource` de la fenêtre : aperçu en direct, écriture sur « Enregistrer ». */
  snapshot(): string[]
  restore(hidden: string[]): void
  commit(): Promise<void>
}

export const useToolbarFamilies = create<ToolbarFamiliesStore>((set, get) => ({
  hidden: readHidden(),
  setVisible: (family, visible) =>
    set(state => ({
      hidden: visible ? state.hidden.filter(name => name !== family) : [...state.hidden.filter(name => name !== family), family],
    })),
  snapshot: () => get().hidden,
  restore: hidden => set({ hidden }),
  async commit() {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(get().hidden))
    } catch {
      throw new Error('toolbar families could not be saved') // la fenêtre reste ouverte et le dit
    }
  },
}))
