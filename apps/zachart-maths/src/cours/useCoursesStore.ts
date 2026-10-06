import { create } from 'zustand'

const NOTES_KEY = 'zachart-maths:notes-visible'

function readNotesVisible(): boolean {
  try {
    return localStorage.getItem(NOTES_KEY) !== 'false'
  } catch {
    return true // stockage indisponible : les notes restent là, c'est le défaut sûr
  }
}

const TAB_KEY = 'zachart-maths:bottom-tab'

export type BottomTab = 'notes' | 'calculatrice'

function readTab(): BottomTab {
  try {
    return localStorage.getItem(TAB_KEY) === 'calculatrice' ? 'calculatrice' : 'notes'
  } catch {
    return 'notes'
  }
}

interface CoursesStore {
  selectedId: string | null
  searchOpen: boolean
  /** La moitié basse est-elle là ? (le nom vient de l'époque où elle ne contenait que les notes.) */
  notesVisible: boolean
  bottomTab: BottomTab
  select(id: string | null): void
  setSearchOpen(open: boolean): void
  setNotesVisible(visible: boolean): void
  setBottomTab(tab: BottomTab): void
  /** Le bouton d'un onglet : l'ouvre ; sur l'onglet déjà affiché, il referme la moitié basse. */
  toggleBottom(tab: BottomTab): void
}

export const useCoursesStore = create<CoursesStore>((set, get) => ({
  selectedId: null,
  searchOpen: false,
  notesVisible: readNotesVisible(),
  bottomTab: readTab(),
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
  setBottomTab(tab) {
    set({ bottomTab: tab })
    try {
      localStorage.setItem(TAB_KEY, tab)
    } catch {
      // Idem : un confort.
    }
  },
  toggleBottom(tab) {
    const { notesVisible, bottomTab, setNotesVisible, setBottomTab } = get()
    if (notesVisible && bottomTab === tab) return setNotesVisible(false)
    setBottomTab(tab)
    setNotesVisible(true)
  },
}))
