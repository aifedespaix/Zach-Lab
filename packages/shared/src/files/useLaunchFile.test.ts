import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useLaunchFile } from './useLaunchFile'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))

const options = { command: 'launch_file', event: 'open-file' }
let emit: ((payload: string) => void) | undefined
const stop = vi.fn()

beforeEach(() => {
  emit = undefined
  stop.mockClear()
  vi.mocked(listen).mockImplementation(async (_event, handler) => {
    emit = payload => handler({ payload } as never)
    return stop
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useLaunchFile', () => {
  it('ouvre le fichier rendu par la commande de lancement', async () => {
    vi.mocked(invoke).mockResolvedValue('C:/cours/a.txt')
    const openFile = vi.fn()
    renderHook(() => useLaunchFile(openFile, options))
    await waitFor(() => expect(openFile).toHaveBeenCalledWith('C:/cours/a.txt'))
    expect(invoke).toHaveBeenCalledWith('launch_file')
    expect(listen).toHaveBeenCalledWith('open-file', expect.any(Function))
  })

  it('ne fait rien quand le lancement n’a pas de fichier', async () => {
    vi.mocked(invoke).mockResolvedValue(null)
    const openFile = vi.fn()
    renderHook(() => useLaunchFile(openFile, options))
    await waitFor(() => expect(invoke).toHaveBeenCalled())
    expect(openFile).not.toHaveBeenCalled()
  })

  it('ouvre le fichier reçu du second lancement, sans relancer la requête', async () => {
    vi.mocked(invoke).mockResolvedValue(null)
    const first = vi.fn()
    const { rerender } = renderHook(({ open }) => useLaunchFile(open, options), { initialProps: { open: first } })
    await waitFor(() => expect(emit).toBeDefined())
    const second = vi.fn()
    rerender({ open: second })
    emit?.('C:/cours/b.txt')
    expect(second).toHaveBeenCalledWith('C:/cours/b.txt')
    expect(first).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('se désabonne au démontage', async () => {
    vi.mocked(invoke).mockResolvedValue(null)
    const { unmount } = renderHook(() => useLaunchFile(vi.fn(), options))
    await waitFor(() => expect(emit).toBeDefined())
    unmount()
    await waitFor(() => expect(stop).toHaveBeenCalled())
  })
})
