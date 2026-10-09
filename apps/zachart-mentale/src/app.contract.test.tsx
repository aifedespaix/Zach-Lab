import { vi } from 'vitest'
import { describeAppContract } from '@suite/shared/testing'

vi.mock('./persistence/fileStore', () => ({
  loadMindMap: vi.fn(),
  saveMindMap: vi.fn(),
  mindMapExists: vi.fn(),
  loadMindMapMeta: vi.fn().mockResolvedValue(null),
}))
vi.mock('./persistence/fileOps', () => ({ duplicateMap: vi.fn() }))
vi.mock('./persistence/workspaceConfig', () => ({
  loadWorkspaceConfig: vi.fn(),
  saveWorkspaceConfig: vi.fn(),
}))
vi.mock('./persistence/quizSettings', () => ({
  loadQuizSettings: vi.fn().mockResolvedValue({ similarityThreshold: 100, lengthGuideEnabled: true, liveLetterFeedback: false }),
  saveQuizSettings: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./persistence/appearanceSettings', async () => {
  const { DEFAULT_APPEARANCE_SETTINGS } = await import('./types/appearanceSettings')
  return {
    loadAppearanceSettings: vi.fn().mockResolvedValue(DEFAULT_APPEARANCE_SETTINGS),
    saveAppearanceSettings: vi.fn().mockResolvedValue(undefined),
  }
})
vi.mock('./persistence/fileTree', async importOriginal => {
  const actual = await importOriginal<typeof import('./persistence/fileTree')>()
  return { ...actual, scanFolder: vi.fn() }
})
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn().mockResolvedValue(null) }))
vi.mock('./persistence/sessionState', () => ({
  loadSessionState: vi.fn(),
  saveSessionState: vi.fn(),
}))
vi.mock('./hooks/useMindMapFormatValid', () => ({ useMindMapFormatValid: vi.fn() }))
// `useSyncStore.init()` is now called from App's bootstrap effect on every
// render. Left unmocked, it would make real Tauri fs calls (via
// `loadSyncSettings`) on every single test in this file, regardless of
// whether that test cares about sync at all — this keeps it inert with a
// default-settings resolution, matching `init()`'s own "stay at defaults"
// behaviour for a load it can't make.
vi.mock('./persistence/syncSettings', () => ({
  loadSyncSettings: vi.fn().mockResolvedValue({ settings: { serverUrl: '', syncFolderPath: null, autoSyncOnLaunch: false }, problem: null }),
  saveSyncSettings: vi.fn().mockResolvedValue(undefined),
}))

import App from './App'
import { loadWorkspaceConfig } from './persistence/workspaceConfig'
import { loadSessionState } from './persistence/sessionState'
import { scanFolder } from './persistence/fileTree'

describeAppContract(() => <App />, {
  name: 'Zachar\'t Mentale',
  // L1 donnera à Mentale l'id commun ; en attendant, l'ancien nom.
  commandIds: { 'app.toggleTheme': 'view.toggleTheme' },
  reset: () => {
    localStorage.clear()
    vi.mocked(loadWorkspaceConfig).mockResolvedValue({ rootFolders: [] })
    vi.mocked(loadSessionState).mockReturnValue({ currentFilePath: null, expandedPaths: [], recentFiles: [] })
    vi.mocked(scanFolder).mockResolvedValue([])
  },
})
