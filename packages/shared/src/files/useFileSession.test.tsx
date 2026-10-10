import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentPort } from './port'
import { createSessionStore } from './session'
import { useFileSession } from './useFileSession'

function memoryPort(initial: Record<string, string>) {
  const files = new Map(Object.entries(initial))
  const writes: [string, string][] = []
  const port: DocumentPort<string> & { fail: boolean; delayWrite: Promise<void> | null } = {
    fail: false,
    delayWrite: null,
    async read(path) {
      return files.get(path) ?? null
    },
    async write(path, doc) {
      if (port.delayWrite) await port.delayWrite
      if (port.fail) throw new Error('disque plein')
      writes.push([path, doc])
      files.set(path, doc)
    },
    validate: raw => (raw === 'INVALIDE' ? { ok: false, issues: ['x'] } : { ok: true }),
    create: async name => {
      files.set(String(name), '')
      return String(name)
    },
  }
  return { port, files, writes }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

const setup = (initial: Record<string, string>) => {
  const mem = memoryPort(initial)
  const session = createSessionStore('t')
  const hook = renderHook(() => useFileSession(mem.port, { session, delay: 600 }))
  return { ...mem, session, hook }
}

describe('useFileSession', () => {
  it('ouvre un fichier : charge, valide, note le récent, n\'écrit rien', async () => {
    const { hook, session, writes } = setup({ a: 'un' })
    await act(() => hook.result.current.open('a'))
    expect(hook.result.current.path).toBe('a')
    expect(hook.result.current.doc).toBe('un')
    expect(hook.result.current.status).toBe('ready')
    expect(session.getState().recentFiles[0].path).toBe('a')
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(writes).toEqual([])
  })

  it('une modification est écrite après le délai, pas avant', async () => {
    const { hook, writes } = setup({ a: 'un' })
    await act(() => hook.result.current.open('a'))
    act(() => hook.result.current.edit('deux'))
    expect(hook.result.current.saveStatus).toBe('dirty')
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect(writes).toEqual([])
    await act(() => vi.advanceTimersByTimeAsync(200))
    expect(writes).toEqual([['a', 'deux']])
    expect(hook.result.current.saveStatus).toBe('saved')
  })

  it('changer de fichier écrit d\'abord le fichier quitté, au bon chemin', async () => {
    const { hook, writes } = setup({ a: 'un', b: 'autre' })
    await act(() => hook.result.current.open('a'))
    act(() => hook.result.current.edit('deux'))
    await act(() => hook.result.current.open('b'))
    expect(writes).toEqual([['a', 'deux']])
    expect(hook.result.current.doc).toBe('autre')
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(writes).toEqual([['a', 'deux']])
  })

  it('un fichier introuvable ou invalide laisse le précédent ouvert', async () => {
    const { hook } = setup({ a: 'un', bad: 'INVALIDE' })
    await act(() => hook.result.current.open('a'))
    await act(() => hook.result.current.open('absent'))
    expect(hook.result.current.failure?.kind).toBe('missing')
    expect(hook.result.current.path).toBe('a')
    await act(() => hook.result.current.open('bad'))
    expect(hook.result.current.failure?.kind).toBe('invalid')
    expect(hook.result.current.path).toBe('a')
    expect(hook.result.current.doc).toBe('un')
  })

  it('un premier fichier introuvable ramène à l\'accueil (pas d\'« ouverture » sans fin)', async () => {
    const { hook } = setup({})
    await act(() => hook.result.current.open('absent'))
    expect(hook.result.current.status).toBe('idle')
    expect(hook.result.current.path).toBeNull()
  })

  it('une écriture ratée avant de changer de fichier pose la question ; « quand même » ouvre', async () => {
    const { hook, port } = setup({ a: 'un', b: 'autre' })
    await act(() => hook.result.current.open('a'))
    act(() => hook.result.current.edit('deux'))
    port.fail = true
    await act(() => hook.result.current.open('b'))
    expect(hook.result.current.path).toBe('a')
    expect(hook.result.current.prompt?.message).toMatch(/disque plein/)
    await act(async () => hook.result.current.prompt!.onContinue())
    await waitFor(() => expect(hook.result.current.path).toBe('b'))
  })

  it('annuler / rétablir réécrivent le fichier', async () => {
    const { hook, writes } = setup({ a: 'un' })
    await act(() => hook.result.current.open('a'))
    act(() => hook.result.current.edit('deux'))
    await act(() => vi.advanceTimersByTimeAsync(700))
    act(() => hook.result.current.undo())
    expect(hook.result.current.doc).toBe('un')
    expect(hook.result.current.canRedo).toBe(true)
    await act(() => vi.advanceTimersByTimeAsync(700))
    expect(writes[writes.length - 1]).toEqual(['a', 'un'])
  })

  it('renommage pendant l\'édition : le changement en attente va à l\'ANCIEN chemin, la suite au nouveau', async () => {
    const { hook, writes } = setup({ a: 'un' })
    await act(() => hook.result.current.open('a'))
    act(() => hook.result.current.edit('deux'))
    await act(() => hook.result.current.relocate('a', 'c'))
    expect(writes).toEqual([['a', 'deux']])
    expect(hook.result.current.path).toBe('c')
    act(() => hook.result.current.edit('trois'))
    await act(() => vi.advanceTimersByTimeAsync(700))
    expect(writes).toEqual([['a', 'deux'], ['c', 'trois']])
  })

  it('fermer écrit puis revient à l\'accueil', async () => {
    const { hook, writes } = setup({ a: 'un' })
    await act(() => hook.result.current.open('a'))
    act(() => hook.result.current.edit('deux'))
    await act(() => hook.result.current.close())
    expect(writes).toEqual([['a', 'deux']])
    expect(hook.result.current.path).toBeNull()
    expect(hook.result.current.doc).toBeNull()
  })

  it('une édition sans fichier ouvert est ignorée', async () => {
    const { hook, writes } = setup({})
    act(() => hook.result.current.edit('x'))
    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(writes).toEqual([])
  })

  it('create ouvre le fichier créé', async () => {
    const { hook } = setup({})
    await act(() => hook.result.current.create('neuf'))
    expect(hook.result.current.path).toBe('neuf')
  })
})
