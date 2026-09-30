import { count, create, getByID, insert, remove, save, search, type AnyOrama } from '@orama/orama'
import { stemmer } from '@orama/stemmers/french'

/** A document of the index: an id, and the text of each indexed field. A missing field is simply not searched. */
export type SearchDocument = { id: string } & Record<string, string | undefined>

export interface SearchHit {
  id: string
  /** Relevance: higher is a better match. */
  score: number
}

export interface SearchOptions {
  /** How many hits at most. Defaults to 20 — a list of results, not the whole index. */
  limit?: number
  /** Restrict the search to some of the indexed fields. Defaults to all of them. */
  fields?: string[]
}

export interface SearchIndex {
  /** Adds a document; one that already has this id is replaced, never duplicated. */
  add: (doc: SearchDocument) => void
  /** Replaces a document, adding it if it was not there. */
  update: (doc: SearchDocument) => void
  /** Removes a document; an unknown id is ignored. */
  remove: (id: string) => void
  /** Hits for `term`, best first. A blank or unreadable query has no hits. */
  search: (term: string, options?: SearchOptions) => SearchHit[]
  size: () => number
  /** The whole index as a JSON string, to ship it with the app or store it. */
  serialize: () => string
}

const DEFAULT_LIMIT = 20

/** Bumped when the serialized shape changes, so an older one is rebuilt instead of misread. */
export const SERIALIZED_VERSION = 1

/** The Orama database behind an index, built the one way every app of the suite searches French. */
export function createDatabase(fields: readonly string[]): AnyOrama {
  return create({
    schema: Object.fromEntries(fields.map(field => [field, 'string' as const])),
    components: {
      // French: the splitter keeps « é », « ç », « œ » inside words, and the
      // tokenizer folds accents, so « ete » finds « Été ». The stemmer is what
      // makes « fraction » find « fractions ».
      tokenizer: { language: 'french', stemming: true, stemmer },
    },
  })
}

/**
 * How many typos a query tolerates, by the length of its longest word.
 *
 * One tolerance applies to the whole query, and two typos on a three-letter
 * word match half the dictionary: short words must be spelled right, long ones
 * may swap two letters.
 */
function toleranceFor(tokens: readonly string[]): number {
  const longest = Math.max(0, ...tokens.map(token => token.length))
  if (longest >= 7) return 2
  if (longest >= 4) return 1
  return 0
}

/** Wraps an Orama database (fresh, or loaded from a serialized index) in the suite's search interface. */
export function wrapDatabase(db: AnyOrama, fields: readonly string[]): SearchIndex {
  function replace(doc: SearchDocument): void {
    if (getByID(db, doc.id) !== undefined) remove(db, doc.id)
    insert(db, { ...doc })
  }

  return {
    add: replace,
    update: replace,

    remove(id) {
      if (getByID(db, id) !== undefined) remove(db, id)
    },

    search(term, options = {}) {
      // Orama answers a query with no words — blank, or made only of characters
      // the tokenizer drops (`(`, `.*`, an emoji) — with EVERY document. A
      // search box that lists the whole index for a stray `(` is not a search.
      const tokens = db.tokenizer.tokenize(term, 'french')
      if (tokens.length === 0) return []

      const results = search(db, {
        term,
        properties: options.fields ?? [...fields],
        limit: options.limit ?? DEFAULT_LIMIT,
        tolerance: toleranceFor(tokens),
      }) as { hits: { id: string; score: number }[] }
      return results.hits.map(hit => ({ id: hit.id, score: hit.score }))
    },

    size: () => count(db) as number,

    serialize: () =>
      JSON.stringify({
        v: SERIALIZED_VERSION,
        fields: [...fields].sort(),
        data: save(db),
      }),
  }
}

/** A new, empty index over `fields` — the names of the text fields of your documents. */
export function createSearchIndex(fields: string[]): SearchIndex {
  return wrapDatabase(createDatabase(fields), fields)
}
