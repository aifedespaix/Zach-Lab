import { readJsonConfig, writeJsonConfig } from '../storage'
import type { ShortcutSettings } from './shortcutSettingsTypes'
import { DEFAULT_SHORTCUT_SETTINGS } from './shortcutSettingsTypes'
import { commandIdAliases, isCommandId } from './catalog'
import { normalizeBinding } from './keys'

const SETTINGS_FILE_NAME = 'shortcuts.json'

/**
 * Keeps only entries this version can act on: a known command id, and either
 * `null` or a binding that parses.
 *
 * The file is plain JSON in the config folder, so it can be hand-edited and it
 * survives downgrades. An override for a command that no longer exists, or a
 * binding string a later version wrote and this one cannot parse, is dropped
 * rather than allowed to shadow a working default with something unusable.
 */
export function sanitizeShortcutSettings(raw: unknown): ShortcutSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SHORTCUT_SETTINGS
  const bindings = (raw as { bindings?: unknown }).bindings
  if (typeof bindings !== 'object' || bindings === null) return DEFAULT_SHORTCUT_SETTINGS

  const entries = Object.entries(bindings as Record<string, unknown>)
  const kept: Record<string, string | null> = {}
  // Entries under a current id first, then the ones under a former id, which only
  // fill what is still free: if a file holds both, the new id's value wins.
  const aliases = commandIdAliases()
  const current = entries.filter(([id]) => !aliases.has(id))
  const former = entries.filter(([id]) => aliases.has(id)).map(([id, value]) => [aliases.get(id)!, value] as const)
  for (const [id, value] of [...current, ...former]) {
    if (!isCommandId(id)) continue
    if (Object.prototype.hasOwnProperty.call(kept, id)) continue
    if (value === null) {
      kept[id] = null
      continue
    }
    if (typeof value !== 'string') continue
    const normalized = normalizeBinding(value)
    if (normalized !== null) kept[id] = normalized
  }
  return { bindings: kept }
}

export async function loadShortcutSettings(): Promise<ShortcutSettings> {
  return readJsonConfig(SETTINGS_FILE_NAME, { fallback: DEFAULT_SHORTCUT_SETTINGS, parse: sanitizeShortcutSettings })
}

export async function saveShortcutSettings(settings: ShortcutSettings): Promise<void> {
  await writeJsonConfig(SETTINGS_FILE_NAME, settings)
}
