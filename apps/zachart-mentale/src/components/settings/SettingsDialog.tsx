import { SlidersHorizontal, Palette, GraduationCap, Keyboard, RefreshCw } from 'lucide-react'
import { useShortcutSettingsStore, type ShortcutSettings } from '@suite/shared/commands'
import {
  SettingsDialog as SharedSettingsDialog,
  ShortcutSettingsPanel,
  type SettingsPanelDef,
  type SettingsSource,
} from '@suite/shared/settings'
import type { UpdateCheckHandle } from '@suite/shared/update'
import { useAppearanceSettingsStore } from '../../state/useAppearanceSettingsStore'
import { useQuizSettingsStore } from '../../state/useQuizSettingsStore'
import type { AppearanceSettings } from '../../types/appearanceSettings'
import type { QuizSettings } from '../../types/quizSettings'
import { GeneralSettingsPanel } from './GeneralSettingsPanel'
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel'
import { QuizSettingsPanel } from './QuizSettingsPanel'
import { SyncSettingsPanel } from './SyncSettingsPanel'

export type SettingsTab = 'general' | 'appearance' | 'quiz' | 'shortcuts' | 'sync'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  updateCheck: Partial<UpdateCheckHandle> & { status: UpdateCheckHandle['status']; checkNow: () => Promise<void> }
  /** Which tab the window opens on — « Raccourcis clavier » lands straight on its own. */
  initialTab?: SettingsTab
}

/** The stores the window previews, saves and undoes — the same three the tabs edit. */
const SOURCES: SettingsSource<any>[] = [
  {
    snapshot: () => useAppearanceSettingsStore.getState().snapshot(),
    restore: (snapshot: AppearanceSettings) => useAppearanceSettingsStore.getState().applyDraft(snapshot),
    commit: () => useAppearanceSettingsStore.getState().commit(),
  },
  {
    snapshot: () => useQuizSettingsStore.getState().snapshot(),
    restore: (snapshot: QuizSettings) => useQuizSettingsStore.getState().applyDraft(snapshot),
    commit: () => useQuizSettingsStore.getState().commit(),
  },
  {
    snapshot: () => useShortcutSettingsStore.getState().snapshot(),
    restore: (snapshot: ShortcutSettings) => useShortcutSettingsStore.getState().applyDraft(snapshot),
    commit: () => useShortcutSettingsStore.getState().commit(),
    // The shortcuts tab writes straight into its own store (a recorder cannot
    // hand a draft back up through a callback the way a slider can), so the
    // window watches for the change instead of being told about it.
    changedSince: {
      subscribe: listener => useShortcutSettingsStore.subscribe(() => listener()),
      isChanged: (snapshot: ShortcutSettings) =>
        JSON.stringify(useShortcutSettingsStore.getState().overrides) !== JSON.stringify(snapshot.bindings),
    },
  },
]

/**
 * The app's settings window: the shared frame (tabs, live preview, save and
 * undo) filled with this app's five panels.
 */
export function SettingsDialog({ open, onOpenChange, updateCheck, initialTab = 'general' }: SettingsDialogProps) {
  // One subscription per field, assembled below. Selecting an OBJECT here
  // would build a new one on every store read, and zustand v5 compares
  // snapshots by identity — that is an infinite render loop, not a slow path.
  const levels = useAppearanceSettingsStore(s => s.levels)
  const fontFamily = useAppearanceSettingsStore(s => s.fontFamily)
  const themeMode = useAppearanceSettingsStore(s => s.themeMode)
  const similarityThreshold = useQuizSettingsStore(s => s.similarityThreshold)
  const lengthGuideEnabled = useQuizSettingsStore(s => s.lengthGuideEnabled)
  const liveLetterFeedback = useQuizSettingsStore(s => s.liveLetterFeedback)
  const lastQuizConfig = useQuizSettingsStore(s => s.lastQuizConfig)
  const appearance: AppearanceSettings = { levels, fontFamily, themeMode }
  const quiz: QuizSettings = { similarityThreshold, lengthGuideEnabled, liveLetterFeedback, lastQuizConfig }

  const panels: SettingsPanelDef[] = [
    {
      id: 'general',
      label: 'Général',
      hint: 'Thème et police',
      icon: SlidersHorizontal,
      render: ({ markDirty }) => (
        <GeneralSettingsPanel
          settings={appearance}
          onChange={next => {
            useAppearanceSettingsStore.getState().applyDraft(next)
            markDirty()
          }}
          updateCheck={updateCheck}
        />
      ),
    },
    {
      id: 'appearance',
      label: 'Apparence',
      hint: 'Couleurs des niveaux',
      icon: Palette,
      render: ({ markDirty }) => (
        <AppearanceSettingsPanel
          settings={appearance}
          onChange={next => {
            useAppearanceSettingsStore.getState().applyDraft(next)
            markDirty()
          }}
        />
      ),
    },
    {
      id: 'quiz',
      label: 'Quiz',
      hint: 'Correction et aides',
      icon: GraduationCap,
      render: ({ markDirty }) => (
        <QuizSettingsPanel
          settings={quiz}
          onChange={next => {
            useQuizSettingsStore.getState().applyDraft(next)
            markDirty()
          }}
        />
      ),
    },
    { id: 'shortcuts', label: 'Raccourcis', hint: 'Toutes les actions', icon: Keyboard, render: () => <ShortcutSettingsPanel /> },
    { id: 'sync', label: 'Synchronisation', hint: 'Compte et serveur', icon: RefreshCw, render: () => <SyncSettingsPanel /> },
  ]

  return (
    <SharedSettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      panels={panels}
      sources={SOURCES}
      initialPanel={initialTab}
    />
  )
}
