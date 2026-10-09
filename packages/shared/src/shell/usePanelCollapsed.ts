import { useCallback, useSyncExternalStore } from 'react'
import { readStored, writeStored } from '../storage'

// Every panel folded state is shared by key: the panel that owns it and an app command that wants to
// unfold it (a toolbar button) read and write the same value.
const listeners = new Set<() => void>()
function read(key: string): boolean {
  return readStored(key) === '1'
}

/** Fold or unfold a panel from outside it; same storage and same notification as `usePanelCollapsed`. */
export function setPanelCollapsed(key: string, value: boolean): void {
  writeStored(key, value ? '1' : '0') // best-effort: a blocked storage keeps it for the session
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/**
 * Whether a side panel is folded away, remembered between launches.
 *
 * Same contract as `createPanelWidthStorage`: read synchronously on the first render (an effect
 * would paint the panel open for a frame and then fold it), a garbage value means "open", and a
 * blocked `localStorage` only costs the next launch its remembered state.
 */
export function usePanelCollapsed(key: string) {
  const collapsed = useSyncExternalStore(subscribe, () => read(key))
  const setCollapsed = useCallback(
    (next: boolean | ((current: boolean) => boolean)) => setPanelCollapsed(key, typeof next === 'function' ? next(read(key)) : next),
    [key],
  )
  return [collapsed, setCollapsed] as const
}
