import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./shortcutSettingsPersistence', () => ({
  loadShortcutSettings: vi.fn(),
  saveShortcutSettings: vi.fn(),
}))

import { defaultBindings, defineCommandCatalog, resetCommandCatalog, type CommandCatalog } from './catalog'
import { loadShortcutSettings, saveShortcutSettings } from './shortcutSettingsPersistence'
import { buildLookup, conflictsIn, createShortcutSettingsStore, resolveBindings } from './useShortcutSettingsStore'

const CATALOG: CommandCatalog = {
  categories: [{ id: 'edit', label: 'Édition' }],
  commands: [
    { id: 'edit.undo', label: 'Annuler', description: 'Annule.', category: 'edit', defaultBinding: 'Mod+Z' },
    {
      id: 'edit.redo',
      label: 'Rétablir',
      description: 'Rétablit.',
      category: 'edit',
      defaultBinding: 'Mod+Shift+Z',
      aliases: ['Mod+Y'],
    },
    { id: 'card.openFiche', label: 'Ouvrir la fiche', description: 'Ouvre.', category: 'edit', defaultBinding: null },
  ],
}

beforeEach(() => defineCommandCatalog(CATALOG))
afterEach(() => resetCommandCatalog())

describe('useShortcutSettingsStore', () => {
  beforeEach(() => {
    vi.mocked(loadShortcutSettings).mockReset()
    vi.mocked(saveShortcutSettings).mockReset()
  })

  it('starts on the shipped defaults, with nothing stored', () => {
    const store = createShortcutSettingsStore()
    expect(store.getState().overrides).toEqual({})
    expect(store.getState().bindings['edit.undo']).toBe('Mod+Z')
  })

  it('resolves a chord to its command, aliases included', () => {
    const store = createShortcutSettingsStore()
    expect(store.getState().lookup.get('Mod+Z')).toBe('edit.undo')
    expect(store.getState().lookup.get('Mod+Shift+Z')).toBe('edit.redo')
    // Ctrl+Y is the redo synonym every Windows app accepts.
    expect(store.getState().lookup.get('Mod+Y')).toBe('edit.redo')
  })

  it('records a rebinding as an override and re-indexes the lookup', () => {
    const store = createShortcutSettingsStore()
    store.getState().setBinding('edit.undo', 'Mod+U')
    expect(store.getState().bindings['edit.undo']).toBe('Mod+U')
    expect(store.getState().lookup.get('Mod+U')).toBe('edit.undo')
    expect(store.getState().lookup.has('Mod+Z')).toBe(false)
  })

  it('takes the chord away from whoever held it, rather than leaving two commands on one key', () => {
    const store = createShortcutSettingsStore()
    store.getState().setBinding('card.openFiche', 'Mod+Z')
    expect(store.getState().bindings['card.openFiche']).toBe('Mod+Z')
    // Silently dead is the failure mode this avoids: the displaced command is
    // explicitly unbound, and the panel says whose shortcut just moved.
    expect(store.getState().bindings['edit.undo']).toBeNull()
    expect(store.getState().lookup.get('Mod+Z')).toBe('card.openFiche')
  })

  it('stores an explicit null when a shipped shortcut is deliberately removed', () => {
    const store = createShortcutSettingsStore()
    store.getState().setBinding('edit.undo', null)
    expect(store.getState().overrides['edit.undo']).toBeNull()
    expect(store.getState().bindings['edit.undo']).toBeNull()
  })

  it('does not store an override that just repeats the default', () => {
    // Storing it would pin the command to today's key forever, past any later
    // change to the catalogue.
    const store = createShortcutSettingsStore()
    store.getState().setBinding('edit.undo', 'Mod+U')
    store.getState().setBinding('edit.undo', defaultBindings()['edit.undo']!)
    expect(store.getState().overrides).not.toHaveProperty('edit.undo')
    expect(store.getState().bindings['edit.undo']).toBe('Mod+Z')
  })

  it('normalises what it is given, and ignores what it cannot parse', () => {
    const store = createShortcutSettingsStore()
    store.getState().setBinding('edit.undo', 'Shift+Mod+U')
    expect(store.getState().bindings['edit.undo']).toBe('Mod+Shift+U')
    store.getState().setBinding('edit.undo', 'Super+Q')
    expect(store.getState().bindings['edit.undo']).toBe('Mod+Shift+U')
  })

  it('puts one command, or all of them, back to the shipped keys', () => {
    const store = createShortcutSettingsStore()
    store.getState().setBinding('edit.undo', 'Mod+U')
    store.getState().setBinding('edit.redo', 'Mod+R')

    store.getState().resetCommand('edit.undo')
    expect(store.getState().bindings['edit.undo']).toBe('Mod+Z')
    expect(store.getState().bindings['edit.redo']).toBe('Mod+R')

    store.getState().resetAll()
    expect(store.getState().overrides).toEqual({})
    expect(store.getState().bindings['edit.redo']).toBe('Mod+Shift+Z')
  })

  it('recomputes its bindings when the app registers its catalogue after the store exists', () => {
    // The store is created when its module loads — before main.tsx has had a
    // chance to register anything. Left alone it would keep an empty table.
    resetCommandCatalog()
    const store = createShortcutSettingsStore()
    expect(store.getState().bindings).toEqual({})
    defineCommandCatalog(CATALOG)
    expect(store.getState().bindings['edit.undo']).toBe('Mod+Z')
    expect(store.getState().lookup.get('Mod+Z')).toBe('edit.undo')
  })

  it('keeps the overrides of the user when the catalogue is registered again', () => {
    const store = createShortcutSettingsStore()
    store.getState().setBinding('edit.undo', 'Mod+U')
    defineCommandCatalog(CATALOG)
    expect(store.getState().bindings['edit.undo']).toBe('Mod+U')
  })

  it('ignores an override for a command the catalogue does not have', () => {
    const bindings = resolveBindings({ 'constructor': 'Mod+K', 'edit.gone': 'Mod+G' })
    expect(bindings).not.toHaveProperty('edit.gone')
    expect(Object.keys(bindings).sort()).toEqual(['card.openFiche', 'edit.redo', 'edit.undo'])
  })

  it('falls back to the defaults rather than throwing when the file is unreadable', () => {
    // Losing your customisations is bad; losing every shortcut in the app,
    // through an unhandled rejection on startup, is worse.
    const store = createShortcutSettingsStore()
    vi.mocked(loadShortcutSettings).mockRejectedValue(new Error('EACCES'))
    return store
      .getState()
      .init()
      .then(() => {
        expect(store.getState().bindings['edit.undo']).toBe('Mod+Z')
      })
  })

  it('writes only the differences, and survives a failed write', async () => {
    const store = createShortcutSettingsStore()
    store.getState().setBinding('edit.undo', 'Mod+U')
    vi.mocked(saveShortcutSettings).mockResolvedValue(undefined)
    await store.getState().commit()
    expect(saveShortcutSettings).toHaveBeenCalledWith({ bindings: { 'edit.undo': 'Mod+U' } })

    vi.mocked(saveShortcutSettings).mockRejectedValue(new Error('disk full'))
    await expect(store.getState().commit()).resolves.toBeUndefined()
  })

  it('replays a snapshot, which is what « Annuler » in the settings window does', () => {
    const store = createShortcutSettingsStore()
    const snapshot = store.getState().snapshot()
    store.getState().setBinding('edit.undo', 'Mod+U')
    store.getState().applyDraft(snapshot)
    expect(store.getState().bindings['edit.undo']).toBe('Mod+Z')
  })
})

describe('conflictsIn', () => {
  it('finds nothing to report when no default shadows another', () => {
    expect([...conflictsIn(resolveBindings({})).keys()]).toEqual([])
  })

  it('reports a collision arriving from a hand-edited file', () => {
    const bindings = resolveBindings({ 'card.openFiche': 'Mod+Z' })
    expect(conflictsIn(bindings).get('Mod+Z')).toEqual(['edit.undo', 'card.openFiche'])
  })
})

describe('buildLookup', () => {
  it('lets a real binding win over another command’s alias', () => {
    const bindings = resolveBindings({ 'card.openFiche': 'Mod+Y' })
    // Ctrl+Y is redo's alias — but an alias must never shadow a chord the user
    // deliberately assigned.
    expect(buildLookup(bindings).get('Mod+Y')).toBe('card.openFiche')
  })
})
