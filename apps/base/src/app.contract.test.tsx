import { vi } from 'vitest'
import { describeAppContract } from '@suite/shared/testing'

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn(async () => null) }))
// A disk in memory: the first launch of a real install finds nothing, and what the app writes is read back.
const disk = vi.hoisted(() => new Map<string, string>())
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => disk.has(path) || path === '/documents/Base'),
  readTextFile: vi.fn(async (path: string) => disk.get(path) ?? ''),
  writeTextFile: vi.fn(async (path: string, text: string) => void disk.set(path, text)),
  mkdir: vi.fn(async () => {}),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appConfigDir: vi.fn(async () => '/config'),
  documentDir: vi.fn(async () => '/documents'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

import App from './App'

describeAppContract(() => <App />, { name: 'base', reset: () => { localStorage.clear(); disk.clear() }, adoptedLots: ['L1', 'L3', 'L4', 'L5', 'L6'] })
