import { load, type AnyOrama } from '@orama/orama'
import {
  SERIALIZED_VERSION,
  createDatabase,
  createSearchIndex,
  wrapDatabase,
  type SearchIndex,
} from './createSearchIndex'

/**
 * An index rebuilt from what `serialize()` produced — the index of the courses
 * compiled into an app, or one saved between launches.
 *
 * A serialized index is DATA the app ships or reads back, so it may be
 * truncated, hand-edited, from a version that shaped it differently, or built
 * over other fields. Any of that gives an empty, working index rather than an
 * exception at startup: the app can always search, it just has nothing indexed
 * yet and can rebuild.
 */
export function loadSearchIndex(fields: string[], serialized: string): SearchIndex {
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (typeof parsed !== 'object' || parsed === null) return createSearchIndex(fields)

    const { v, fields: builtOver, data } = parsed as { v?: unknown; fields?: unknown; data?: unknown }
    if (v !== SERIALIZED_VERSION) return createSearchIndex(fields)
    if (typeof data !== 'object' || data === null) return createSearchIndex(fields)

    // The same fields, in any order: an index over other fields would look up
    // text in places the documents no longer have it.
    const expected = [...fields].sort().join('\u0000')
    if (!Array.isArray(builtOver) || [...builtOver].sort().join('\u0000') !== expected) {
      return createSearchIndex(fields)
    }

    const db: AnyOrama = createDatabase(fields)
    load(db, data as Parameters<typeof load>[1])
    return wrapDatabase(db, fields)
  } catch {
    return createSearchIndex(fields)
  }
}
