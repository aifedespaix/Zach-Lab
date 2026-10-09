import { appConfigDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs'

/*
 * JSON files of the app's config folder (`appConfigDir`): `shortcuts.json`,
 * `workspace.json`, the quiz / appearance / sync settings.
 *
 * Reading never throws and never loses a file: a missing file reads as the
 * fallback, and an unreadable one (truncated by a crash, hand-edited wrong)
 * is moved to `<name>.bak` — not overwritten by the next save — before the
 * fallback is returned.
 */

async function pathOf(name: string): Promise<string> {
  return join(await appConfigDir(), name)
}

export interface ReadJsonConfigOptions<T> {
  fallback: T
  /** Validates the parsed JSON and returns the value; throw (or return `undefined`) when it is not one. */
  parse: (raw: unknown) => T | undefined
}

export async function readJsonConfig<T>(name: string, { fallback, parse }: ReadJsonConfigOptions<T>): Promise<T> {
  let path: string
  try {
    path = await pathOf(name)
    if (!(await exists(path))) return fallback
  } catch {
    return fallback
  }

  try {
    const value = parse(JSON.parse(await readTextFile(path)) as unknown)
    if (value !== undefined) return value
  } catch {
    // unreadable: handled below
  }
  await keepUnreadable(path)
  return fallback
}

async function keepUnreadable(path: string): Promise<void> {
  try {
    await rename(path, `${path}.bak`)
  } catch {
    // Not allowed or not possible: the file stays where it is, and the caller still gets its fallback.
  }
}

/**
 * Writes `value` as indented JSON, creating the folder. Written beside the file
 * and renamed over it, so a crash mid-write cannot leave half a file; when the
 * rename is not available the file is written directly.
 */
export async function writeJsonConfig(name: string, value: unknown): Promise<void> {
  const dir = await appConfigDir()
  if (!(await exists(dir))) await mkdir(dir, { recursive: true })
  const path = await join(dir, name)
  const text = JSON.stringify(value, null, 2)
  const temporary = `${path}.tmp`
  try {
    await writeTextFile(temporary, text)
    await rename(temporary, path)
  } catch {
    await writeTextFile(path, text)
  }
}
