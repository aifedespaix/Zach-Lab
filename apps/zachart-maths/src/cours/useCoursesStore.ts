import { create } from 'zustand'

const NOTES_KEY = 'zachart-maths:notes-visible'

function readNotesVisible(): boolean {
  try {
    return localStorage.getItem(NOTES_KEY) !== 'false'
  } catch {
    return true // stockage indisponible : les notes restent là, c'est le défaut sûr
  }
}

interface CoursesStore {
  selectedId: string | null
  searchOpen: boolean
  notesVisible: boolean
  select(id: string | null): void
  setSearchOpen(open: boolean): void
  setNotesVisible(visible: boolean): void
}

export const useCoursesStore = create<CoursesStore>(set => ({
  selectedId: null,
  searchOpen: false,
  notesVisible: readNotesVisible(),
  select: id => set({ selectedId: id }),
  setSearchOpen: open => set({ searchOpen: open }),
  setNotesVisible(visible) {
    set({ notesVisible: visible })
    try {
      localStorage.setItem(NOTES_KEY, String(visible))
    } catch {
      // Se souvenir du choix est un confort ; l'échouer ne doit rien casser.
    }
  },
}))
