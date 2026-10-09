import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { readStored, writeStored } from './safeStorage'

export interface PersistedState<T> {
  value: T
  /** Sets the value (or derives it from the current one) and remembers it. */
  set: (next: T | ((current: T) => T)) => void
  /** Back to the fallback, remembered too. */
  reset: () => void
}

export type PersistedStore<T> = UseBoundStore<StoreApi<PersistedState<T>>>

export interface PersistedOptions<T> {
  /** The full storage key — keep it identical to the one already written. */
  key: string
  /** What an absent, unreadable or invalid entry reads as. */
  fallback: T
  /**
   * The value for a stored string, or `undefined` when it is not one (→ fallback).
   * Reproduce the format the key already has: `'true'`, `'on'`, `'42'`, JSON…
   */
  parse: (raw: string) => T | undefined
  /** The string to store. Default: `String(value)`. */
  serialize?: (value: T) => string
  /**
   * Rewrites an entry an older version stored before `parse` sees it
   * (`'1'` → `'true'`…). Return `undefined` to drop it.
   */
  migrate?: (raw: string) => string | undefined
  /** Brings any value — read back or set by the app — into range (a clamp…). */
  normalize?: (value: T) => T
}

/**
 * A zustand store whose `value` is remembered between launches.
 *
 * Read ONCE, synchronously, when the store is created — an effect would paint
 * the default for a frame and then jump. It never throws: a missing, refused or
 * corrupt entry gives the fallback, and a refused write leaves the value live
 * for the session. The key and the stored format are the caller's, so a
 * preference moved onto this keeps reading what the previous code wrote.
 */
export function createPersisted<T>(options: PersistedOptions<T>): PersistedStore<T> {
  const { key, fallback, parse, serialize = String, migrate, normalize = (value: T) => value } = options

  function load(): T {
    try {
      let raw = readStored(key)
      if (raw !== null && migrate !== undefined) raw = migrate(raw) ?? null
      if (raw === null) return fallback
      const parsed = parse(raw)
      return parsed === undefined ? fallback : normalize(parsed)
    } catch {
      return fallback
    }
  }

  function save(value: T): void {
    try {
      writeStored(key, serialize(value))
    } catch {
      // `serialize` threw on a value it cannot spell: keep it for the session.
    }
  }

  return create<PersistedState<T>>((set, get) => ({
    value: load(),
    set: next => {
      const value = normalize(typeof next === 'function' ? (next as (current: T) => T)(get().value) : next)
      set({ value })
      save(value)
    },
    reset: () => {
      set({ value: fallback })
      save(fallback)
    },
  }))
}

/**
 * An on/off preference. `on` / `off` are the strings the key has always held
 * (`'true'`/`'false'`, `'on'`/`'off'`, `'1'`/`'0'`). Anything else keeps
 * the fallback, which is what the hand-written readers did (« on unless the key
 * says `off` » is a fallback of `true`).
 */
export function persistedFlag(options: {
  key: string
  fallback: boolean
  on?: string
  off?: string
}): PersistedStore<boolean> {
  const { key, fallback, on = 'true', off = 'false' } = options
  return createPersisted<boolean>({
    key,
    fallback,
    parse: raw => (raw === on ? true : raw === off ? false : undefined),
    serialize: value => (value ? on : off),
  })
}

/** A number kept inside `[min, max]` (and snapped to `step` when given). */
export function persistedNumber(options: {
  key: string
  fallback: number
  min: number
  max: number
  step?: number
}): PersistedStore<number> {
  const { key, fallback, min, max, step } = options
  const clamp = (n: number) => {
    const snapped = step === undefined ? Math.round(n) : Math.round(n / step) * step
    return Math.min(max, Math.max(min, snapped))
  }
  return createPersisted<number>({
    key,
    fallback,
    parse: raw => {
      const n = Number(raw)
      return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined
    },
    normalize: clamp,
  })
}

/** One of a closed list of strings. */
export function persistedEnum<T extends string>(options: {
  key: string
  fallback: T
  values: readonly T[]
}): PersistedStore<T> {
  const { key, fallback, values } = options
  return createPersisted<T>({
    key,
    fallback,
    parse: raw => values.find(value => value === raw),
    serialize: String,
  })
}

/** A set of strings, stored as a JSON array. Anything that is not a string is dropped on read. */
export function persistedSet(options: { key: string; fallback?: readonly string[] }): PersistedStore<readonly string[]> {
  const { key, fallback = [] } = options
  return createPersisted<readonly string[]>({
    key,
    fallback,
    parse: raw => {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : undefined
    },
    serialize: value => JSON.stringify(value),
  })
}

/** Any JSON value, checked by `validate` on the way in (`undefined` → fallback). */
export function persistedJson<T>(options: {
  key: string
  fallback: T
  validate: (raw: unknown) => T | undefined
}): PersistedStore<T> {
  const { key, fallback, validate } = options
  return createPersisted<T>({
    key,
    fallback,
    parse: raw => validate(JSON.parse(raw)),
    serialize: value => JSON.stringify(value),
  })
}
