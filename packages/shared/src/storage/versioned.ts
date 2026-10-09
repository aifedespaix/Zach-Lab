/**
 * Migrations of a stored format, applied in order: a v1 file read by v3 code goes
 * through the v1→v2 then the v2→v3 step, and the caller only ever sees v3.
 *
 * `steps[n]` turns a version-`n` value into a version-`n + 1` one. Used by
 * Maths (sheet v1 → v2) and Mentale (`.json` → `.zmap`).
 */
export interface VersionedOptions {
  /** The version the code reads today. */
  current: number
  /** `steps[n]`: version `n` → version `n + 1`. Every `n` from the oldest supported to `current - 1`. */
  steps: Readonly<Record<number, (value: unknown) => unknown>>
  /** The version a value is in. Default: its numeric `version` field, 1 when it has none. */
  versionOf?: (value: unknown) => number
}

export interface VersionedResult {
  value: unknown
  /** The version the value was found in. */
  from: number
  /** Whether at least one step ran — the caller may want to rewrite the file on its next save. */
  migrated: boolean
}

function defaultVersionOf(value: unknown): number {
  const version = (value as { version?: unknown } | null)?.version
  return typeof version === 'number' && Number.isInteger(version) && version >= 1 ? version : 1
}

/**
 * Brings `raw` up to `current`. Throws on a value from a NEWER version (reading it
 * with older code would silently drop what it cannot understand) and on a gap
 * in `steps`.
 */
export function readVersioned(raw: unknown, { current, steps, versionOf = defaultVersionOf }: VersionedOptions): VersionedResult {
  const from = versionOf(raw)
  if (from > current) throw new Error(`Format d'une version plus récente (v${from}, cette version lit jusqu'à v${current})`)
  let value = raw
  for (let version = from; version < current; version++) {
    const step = steps[version]
    if (step === undefined) throw new Error(`Aucune migration de la v${version} à la v${version + 1}`)
    value = step(value)
  }
  return { value, from, migrated: from < current }
}
