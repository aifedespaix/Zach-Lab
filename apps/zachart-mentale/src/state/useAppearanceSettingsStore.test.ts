import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useThemeStore } from '@suite/shared/theme'
import { createAppearanceSettingsStore, useAppearanceSettingsStore } from './useAppearanceSettingsStore'
import { DEFAULT_APPEARANCE_SETTINGS } from '../types/appearanceSettings'

vi.mock('../persistence/appearanceSettings', () => ({
  loadAppearanceSettings: vi.fn(),
  saveAppearanceSettings: vi.fn(),
}))

import { loadAppearanceSettings, saveAppearanceSettings } from '../persistence/appearanceSettings'

describe('useAppearanceSettingsStore', () => {
  beforeEach(() => {
    vi.mocked(loadAppearanceSettings).mockReset()
    vi.mocked(saveAppearanceSettings).mockReset().mockResolvedValue(undefined)
  })

  it('starts with the defaults before init resolves', () => {
    const store = createAppearanceSettingsStore()
    expect(store.getState().levels).toEqual(DEFAULT_APPEARANCE_SETTINGS.levels)
    expect(store.getState().fontFamily).toBe(DEFAULT_APPEARANCE_SETTINGS.fontFamily)
    expect(store.getState().themeMode).toBe('system')
  })

  it('init loads persisted settings into the store', async () => {
    const persisted = { ...DEFAULT_APPEARANCE_SETTINGS, themeMode: 'dark' as const }
    vi.mocked(loadAppearanceSettings).mockResolvedValue(persisted)
    const store = createAppearanceSettingsStore()

    await store.getState().init()

    expect(store.getState().themeMode).toBe('dark')
  })

  it('falls back to defaults if loading settings throws', async () => {
    vi.mocked(loadAppearanceSettings).mockRejectedValue(new Error('disk error'))
    const store = createAppearanceSettingsStore()

    await store.getState().init()

    expect(store.getState().themeMode).toBe('system')
  })

  it('setFontFamily updates the store and persists it', async () => {
    const store = createAppearanceSettingsStore()

    await store.getState().setFontFamily('Georgia, serif')

    expect(store.getState().fontFamily).toBe('Georgia, serif')
    expect(saveAppearanceSettings).toHaveBeenCalledWith(expect.objectContaining({ fontFamily: 'Georgia, serif' }))
  })

  it('setThemeMode updates the store and persists it', async () => {
    const store = createAppearanceSettingsStore()

    await store.getState().setThemeMode('dark')

    expect(store.getState().themeMode).toBe('dark')
    expect(saveAppearanceSettings).toHaveBeenCalledWith(expect.objectContaining({ themeMode: 'dark' }))
  })

  it('keeps the in-memory value even if persisting it fails', async () => {
    vi.mocked(saveAppearanceSettings).mockRejectedValue(new Error('disk error'))
    const store = createAppearanceSettingsStore()

    await store.getState().setThemeMode('dark')

    expect(store.getState().themeMode).toBe('dark')
  })
})

describe('useAppearanceSettingsStore — thème partagé', () => {
  beforeEach(() => {
    vi.mocked(loadAppearanceSettings).mockReset()
    vi.mocked(saveAppearanceSettings).mockReset().mockResolvedValue(undefined)
    useAppearanceSettingsStore.setState(DEFAULT_APPEARANCE_SETTINGS)
    useThemeStore.setState({ mode: 'system' })
  })

  it('recopie chaque changement de mode dans le store de thème que tout le monde lit', () => {
    useAppearanceSettingsStore.setState({ themeMode: 'dark' })
    expect(useThemeStore.getState().mode).toBe('dark')
    useAppearanceSettingsStore.setState({ themeMode: 'light' })
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('ne touche pas au thème quand un autre réglage change', () => {
    useAppearanceSettingsStore.setState({ themeMode: 'dark' })
    useThemeStore.setState({ mode: 'light' })
    useAppearanceSettingsStore.setState({ fontFamily: 'Georgia, serif' })
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('applique au démarrage le mode du fichier d\'un utilisateur existant', async () => {
    vi.mocked(loadAppearanceSettings).mockResolvedValue({ ...DEFAULT_APPEARANCE_SETTINGS, themeMode: 'dark' })
    await useAppearanceSettingsStore.getState().init()
    expect(useThemeStore.getState().mode).toBe('dark')
  })

  it('un aperçu annulé (applyDraft du snapshot) remet aussi le thème d\'avant', () => {
    useAppearanceSettingsStore.setState({ themeMode: 'light' })
    const snapshot = useAppearanceSettingsStore.getState().snapshot()
    useAppearanceSettingsStore.getState().applyDraft({ ...snapshot, themeMode: 'dark' })
    expect(useThemeStore.getState().mode).toBe('dark')
    useAppearanceSettingsStore.getState().applyDraft(snapshot)
    expect(useThemeStore.getState().mode).toBe('light')
  })
})
