import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { type DocumentPort, useFileSession } from './useFileSession'

function memoryPort(initial: Record<string, string>, extra: Partial<DocumentPort<string>> = {}) {
  const disk = new Map(Object.entries(initial))
  const port: DocumentPort<string> = {
    read: async path => disk.get(path) ?? null,
    write: async (path, doc) => { disk.set(path, doc) },
    ...extra,
  }
  return { disk, port }
}

describe('useFileSession', () => {
  it('ouvre un fichier : charge, puis prêt', async () => {
    const { port } = memoryPort({ a: 'A' })
    const { result } = renderHook(() => useFileSession(port))
    expect(result.current.status).toBe('idle')
    await act(() => result.current.open('a'))
    expect(result.current).toMatchObject({ status: 'ready', path: 'a', doc: 'A', error: null })
  })

  it('un fichier disparu laisse le fichier précédent ouvert', async () => {
    const { port } = memoryPort({ a: 'A' })
    const { result } = renderHook(() => useFileSession(port))
    await act(() => result.current.open('a'))
    await act(() => result.current.open('gone'))
    expect(result.current).toMatchObject({ status: 'ready', path: 'a', doc: 'A' })
    expect(result.current.error).toEqual({ kind: 'missing', path: 'gone' })
  })

  it('un fichier invalide ne devient jamais le fichier chargé, ni écrit', async () => {
    const { port, disk } = memoryPort({ a: 'A', bad: 'X' }, { validate: raw => (raw === 'X' ? { ok: false, issues: ['x'] } : { ok: true }) })
    const { result } = renderHook(() => useFileSession(port, { delay: 10 }))
    await act(() => result.current.open('a'))
    await act(() => result.current.open('bad'))
    expect(result.current.path).toBe('a')
    expect(result.current.error).toEqual({ kind: 'invalid', path: 'bad', issues: ['x'] })
    await new Promise(r => setTimeout(r, 40))
    expect(disk.get('bad')).toBe('X')
  })

  it('changer de fichier écrit d’abord les modifications en attente', async () => {
    const { port, disk } = memoryPort({ a: 'A', b: 'B' })
    const { result } = renderHook(() => useFileSession(port, { delay: 10_000 }))
    await act(() => result.current.open('a'))
    act(() => result.current.setDoc('A2'))
    await act(() => result.current.open('b'))
    expect(disk.get('a')).toBe('A2')
    expect(result.current).toMatchObject({ path: 'b', doc: 'B' })
  })

  it('si l’écriture échoue, on reste sur le fichier courant', async () => {
    const { port } = memoryPort({ a: 'A', b: 'B' }, { write: async () => { throw new Error('disque plein') } })
    const { result } = renderHook(() => useFileSession(port, { delay: 10_000 }))
    await act(() => result.current.open('a'))
    act(() => result.current.setDoc('A2'))
    await act(() => result.current.open('b'))
    expect(result.current).toMatchObject({ path: 'a', doc: 'A2' })
    expect(result.current.error?.kind).toBe('save')
  })

  it('n’écrit pas un fichier qu’on vient d’ouvrir sans le modifier', async () => {
    const write = vi.fn(async () => {})
    const { port } = memoryPort({ a: 'A' }, { write })
    const { result } = renderHook(() => useFileSession(port, { delay: 10 }))
    await act(() => result.current.open('a'))
    await new Promise(r => setTimeout(r, 40))
    expect(write).not.toHaveBeenCalled()
  })

  it('autosave : écrit après le délai', async () => {
    const { port, disk } = memoryPort({ a: 'A' })
    const { result } = renderHook(() => useFileSession(port, { delay: 10 }))
    await act(() => result.current.open('a'))
    act(() => result.current.setDoc('A2'))
    await waitFor(() => expect(disk.get('a')).toBe('A2'))
  })

  it('renommage pendant l’édition : écrit l’ancien, puis suit le nouveau chemin', async () => {
    const { port, disk } = memoryPort({ a: 'A' })
    const { result } = renderHook(() => useFileSession(port, { delay: 10_000 }))
    await act(() => result.current.open('a'))
    act(() => result.current.setDoc('A2'))
    await act(() => result.current.follow('a', 'z'))
    expect(disk.get('a')).toBe('A2')
    expect(result.current.path).toBe('z')
    act(() => result.current.setDoc('A3'))
    await act(() => result.current.flush())
    expect(disk.get('z')).toBe('A3')
    expect(disk.get('a')).toBe('A2')
  })

  it('follow ignore un autre fichier que celui d’ouvert', async () => {
    const { port } = memoryPort({ a: 'A' })
    const { result } = renderHook(() => useFileSession(port))
    await act(() => result.current.open('a'))
    await act(() => result.current.follow('q', 'z'))
    expect(result.current.path).toBe('a')
  })

  it('close écrit puis revient à idle', async () => {
    const { port, disk } = memoryPort({ a: 'A' })
    const { result } = renderHook(() => useFileSession(port, { delay: 10_000 }))
    await act(() => result.current.open('a'))
    act(() => result.current.setDoc('A2'))
    await act(() => result.current.close())
    expect(disk.get('a')).toBe('A2')
    expect(result.current).toMatchObject({ status: 'idle', path: null, doc: null })
  })

  it('historique : annuler / rétablir remettent le document', async () => {
    const { port } = memoryPort({ a: 'A' })
    const { result } = renderHook(() => useFileSession(port, { delay: 10_000 }))
    await act(() => result.current.open('a'))
    act(() => result.current.setDoc('A2', 'k'))
    expect(result.current.canUndo).toBe(true)
    act(() => result.current.undo())
    expect(result.current.doc).toBe('A')
    act(() => result.current.redo())
    expect(result.current.doc).toBe('A2')
  })
})
