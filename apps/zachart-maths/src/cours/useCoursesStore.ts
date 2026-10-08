import { create } from 'zustand'
import { setPanelCollapsed } from '@suite/shared/shell'
import { useCalculatorStore } from '../calc/useCalculatorStore'

/** La clé de repli du panneau de droite (`App.tsx`) : activer une pastille le déplie. */
export const RIGHT_COLLAPSED_KEY = 'zachart-maths:right-collapsed'
const COURSES_KEY = 'zachart-maths:courses-visible'

function readCoursesVisible(): boolean {
  try {
    return localStorage.getItem(COURSES_KEY) !== 'false'
  } catch {
    return true
  }
}

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
  /** La moitié haute (les cours) est-elle là ? */
  coursesVisible: boolean
  select(id: string | null): void
  setSearchOpen(open: boolean): void
  setNotesVisible(visible: boolean): void
  setBottomTab(tab: BottomTab): void
  /** Le bouton d'un onglet : l'ouvre ; sur l'onglet déjà affiché, il referme la moitié basse. */
  setCoursesVisible(visible: boolean): void
  /** Idem pour les cours (la moitié haute) : l'allumer déplie le panneau de droite, l'éteindre ne le replie pas. */
  toggleCourses(): void
  toggleBottom(tab: BottomTab): void
}

/** Plus rien d'allumé (ni cours, ni notes, ni calculatrice) : la sidebar droite n'a rien à montrer, on la range. */
const foldWhenEmpty = (state: { notesVisible: boolean; coursesVisible: boolean }) => {
  if (!state.notesVisible && !state.coursesVisible) setPanelCollapsed(RIGHT_COLLAPSED_KEY, true)
}

export const useCoursesStore = create<CoursesStore>((set, get) => ({
  selectedId: null,
  searchOpen: false,
  notesVisible: readNotesVisible(),
  bottomTab: readTab(),
  coursesVisible: readCoursesVisible(),
  select: id => set({ selectedId: id }),
  setSearchOpen: open => set({ searchOpen: open }),
  setNotesVisible(visible) {
    set({ notesVisible: visible })
    foldWhenEmpty(get())
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
  setCoursesVisible(visible) {
    set({ coursesVisible: visible })
    foldWhenEmpty(get())
    try {
      localStorage.setItem(COURSES_KEY, String(visible))
    } catch {
      // Idem : un confort.
    }
  },
  toggleBottom(tab) {
    const { notesVisible, bottomTab, setNotesVisible, setBottomTab } = get()
    if (notesVisible && bottomTab === tab) return setNotesVisible(false)
    setBottomTab(tab)
    setNotesVisible(true)
    setPanelCollapsed(RIGHT_COLLAPSED_KEY, false)
    if (tab === 'calculatrice') useCalculatorStore.getState().requestFocus()
  },
  toggleCourses() {
    const { coursesVisible, setCoursesVisible } = get()
    setCoursesVisible(!coursesVisible)
    if (!coursesVisible) setPanelCollapsed(RIGHT_COLLAPSED_KEY, false)
  },
}))
