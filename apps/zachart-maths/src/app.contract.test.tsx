import { vi } from 'vitest'
import { describeAppContract } from '@suite/shared/testing'

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn(async () => null) }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  readDir: vi.fn(async () => []),
  remove: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appConfigDir: vi.fn(async () => '/config'),
  documentDir: vi.fn(async () => '/docs'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
}))

import App from './App'

describeAppContract(() => <App />, { name: 'Zach\'Math', reset: () => localStorage.clear() })
