import { create } from 'zustand'

export interface CalcEntry {
  expression: string
  text: string
  value: number
}

const KEPT = 20

interface CalculatorStore {
  expression: string
  history: CalcEntry[]
  /** Vrai entre l'ouverture de la calculatrice et son montage : le champ prend alors le focus. */
  focusPending: boolean
  setExpression(expression: string): void
  push(entry: CalcEntry): void
  requestFocus(): void
  clearFocusRequest(): void
}

/** Dans un store, pas dans le composant : changer d'onglet (Notes) démonte la calculatrice, pas son calcul en cours. */
export const useCalculatorStore = create<CalculatorStore>(set => ({
  expression: '',
  history: [],
  focusPending: false,
  setExpression: expression => set({ expression }),
  push: entry => set(s => ({ history: [entry, ...s.history].slice(0, KEPT), expression: entry.text })),
  requestFocus: () => set({ focusPending: true }),
  clearFocusRequest: () => set({ focusPending: false }),
}))
