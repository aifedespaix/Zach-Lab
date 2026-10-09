/**
 * The only place of the suite that touches `localStorage`.
 *
 * Reading the property can throw (storage disabled, sandboxed frame), so can
 * every call on it, and a webview may refuse writes once the quota is spent.
 * None of that may ever reach a component: a preference that cannot be kept
 * must still WORK for the session. Each operation therefore falls back to an
 * in-memory map, which is also what the next read sees — the choice made
 * before the failure is not forgotten the moment it happens.
 */
const memory = new Map<string, string>()

function backend(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The stored string, or `null` when nothing was stored (or nothing can be read). */
export function readStored(key: string): string | null {
  try {
    const value = backend()?.getItem(key)
    if (value !== undefined && value !== null) return value
  } catch {
    // fall through to the in-memory copy
  }
  return memory.get(key) ?? null
}

/** Stores `value`; `false` when only the in-memory copy could be kept. */
export function writeStored(key: string, value: string): boolean {
  try {
    const storage = backend()
    if (storage !== null) {
      storage.setItem(key, value)
      memory.delete(key)
      return true
    }
  } catch {
    // quota spent, storage disabled…
  }
  memory.set(key, value)
  return false
}

export function removeStored(key: string): void {
  memory.delete(key)
  try {
    backend()?.removeItem(key)
  } catch {
    // nothing to remove from
  }
}

/**
 * `getItem` / `setItem` over the functions above, for the few readers that take a
 * `Storage`-shaped object (the theme store, which tests feed a fake).
 */
export const safeStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: readStored,
  setItem: (key, value) => void writeStored(key, value),
}

/** Forgets the in-memory fallback. For tests. */
export function resetStorageMemory(): void {
  memory.clear()
}
