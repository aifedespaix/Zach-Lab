import { create } from 'zustand'

const ONLY_KEY = 'zachart-maths:only-to-correct'
const HIDE_KEY = 'zachart-maths:hide-corrected'

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'on'
  } catch {
    return false
  }
}

function write(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? 'on' : 'off')
  } catch {
    // Stockage indisponible : le choix vaut pour la session.
  }
}

interface CorrectionViewStore {
  /** L'arbre ne montre que les fiches qui ont des exercices à corriger. */
  onlyToCorrect: boolean
  /** Le plan de la fiche masque les exercices corrigés (sauf celui qui est ouvert). */
  hideCorrected: boolean
  /** Le mode révision est ouvert. */
  reviewOpen: boolean
  toggleOnlyToCorrect(): void
  toggleHideCorrected(): void
  setReviewOpen(open: boolean): void
}

export const useCorrectionView = create<CorrectionViewStore>((set, get) => ({
  onlyToCorrect: read(ONLY_KEY),
  hideCorrected: read(HIDE_KEY),
  reviewOpen: false,
  toggleOnlyToCorrect: () => {
    const next = !get().onlyToCorrect
    set({ onlyToCorrect: next })
    write(ONLY_KEY, next)
  },
  toggleHideCorrected: () => {
    const next = !get().hideCorrected
    set({ hideCorrected: next })
    write(HIDE_KEY, next)
  },
  setReviewOpen: reviewOpen => set({ reviewOpen }),
}))
