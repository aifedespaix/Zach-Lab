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
  setExpression(expression: string): void
  push(entry: CalcEntry): void
}

/** Dans un store, pas dans le composant : changer d'onglet (Notes) démonte la calculatrice, pas son calcul en cours. */
export const useCalculatorStore = create<CalculatorStore>(set => ({
  expression: '',
  history: [],
  setExpression: expression => set({ expression }),
  push: entry => set(s => ({ history: [entry, ...s.history].slice(0, KEPT), expression: entry.text })),
}))
