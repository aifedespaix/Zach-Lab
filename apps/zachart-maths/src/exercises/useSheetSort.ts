import { create } from 'zustand'
import { isSheetSort, type SheetSort } from './sheetSort'

const KEY = 'zachart-maths:sheet-sort'

function read(): SheetSort {
  try {
    const value = localStorage.getItem(KEY)
    return isSheetSort(value) ? value : 'ordre'
  } catch {
    return 'ordre'
  }
}

interface SheetSortStore {
  sort: SheetSort
  setSort(sort: SheetSort): void
}

/** Le tri du plan de la fiche : une vue, retenue d'une session à l'autre. */
export const useSheetSort = create<SheetSortStore>(set => ({
  sort: read(),
  setSort: sort => {
    set({ sort })
    try {
      localStorage.setItem(KEY, sort)
    } catch {
      // Stockage indisponible : le choix vaut pour la session.
    }
  },
}))
