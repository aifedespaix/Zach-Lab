import { beforeEach, describe, expect, it, vi } from 'vitest'

const files = new Map<string, string>()
const dirs = new Set<string>()
let renameAllowed = true

vi.mock('@tauri-apps/api/path', () => ({
  appConfigDir: vi.fn(async () => '/config'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => files.has(path) || dirs.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    const text = files.get(path)
    if (text === undefined) throw new Error('not found')
    return text
  }),
  writeTextFile: vi.fn(async (path: string, text: string) => void files.set(path, text)),
  mkdir: vi.fn(async (path: string) => void dirs.add(path)),
  rename: vi.fn(async (from: string, to: string) => {
    if (!renameAllowed) throw new Error('forbidden')
    files.set(to, files.get(from)!)
    files.delete(from)
  }),
}))

import { readJsonConfig, writeJsonConfig } from './jsonConfig'

const numberList = (raw: unknown) => (Array.isArray(raw) ? (raw as number[]) : undefined)

beforeEach(() => {
  files.clear()
  dirs.clear()
  renameAllowed = true
})

describe('readJsonConfig / writeJsonConfig', () => {
  it('donne le repli quand le fichier est absent', async () => {
    expect(await readJsonConfig('x.json', { fallback: [], parse: numberList })).toEqual([])
  })

  it('relit ce qui a été écrit, dossier créé, sans fichier temporaire', async () => {
    await writeJsonConfig('x.json', [1, 2])
    expect(dirs.has('/config')).toBe(true)
    expect(JSON.parse(files.get('/config/x.json')!)).toEqual([1, 2])
    expect([...files.keys()]).toEqual(['/config/x.json'])
    expect(await readJsonConfig('x.json', { fallback: [], parse: numberList })).toEqual([1, 2])
  })

  it('écrit quand même quand le renommage n\'est pas permis', async () => {
    renameAllowed = false
    await writeJsonConfig('x.json', [3])
    expect(JSON.parse(files.get('/config/x.json')!)).toEqual([3])
  })

  it('met de côté un fichier illisible (.bak) au lieu de le perdre', async () => {
    files.set('/config/x.json', '{ tronqué')
    expect(await readJsonConfig('x.json', { fallback: [9], parse: numberList })).toEqual([9])
    expect(files.has('/config/x.json')).toBe(false)
    expect(files.get('/config/x.json.bak')).toBe('{ tronqué')
  })

  it('traite un JSON valide mais de la mauvaise forme comme illisible', async () => {
    files.set('/config/x.json', '{"a":1}')
    expect(await readJsonConfig('x.json', { fallback: [], parse: numberList })).toEqual([])
    expect(files.has('/config/x.json.bak')).toBe(true)
  })

  it('ne lève pas quand le .bak lui-même est refusé', async () => {
    renameAllowed = false
    files.set('/config/x.json', 'nope')
    await expect(readJsonConfig('x.json', { fallback: [], parse: numberList })).resolves.toEqual([])
  })
})
