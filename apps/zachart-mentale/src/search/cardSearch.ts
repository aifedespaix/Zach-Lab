import { createSearchIndex, type SearchIndex } from '@suite/shared/search'
import type { Card } from '../types/card'

/**
 * A full-text index over the cards of a mind map: their title and their
 * definition (the plain-text mirror of rich content). Floating cards are in it
 * like any other.
 *
 * Build it when a map is loaded, and `update`/`remove` cards as they change —
 * indexing is cheap, but not something to redo on every keystroke.
 */
export function createCardSearchIndex(cards: readonly Card[]): SearchIndex {
  const index = createSearchIndex(['title', 'definition'])
  for (const card of cards) index.add({ id: card.id, title: card.title, definition: card.definition })
  return index
}

/**
 * The ids of the cards matching `query`, best first: a hit on the TITLE
 * outranks one that only the definition has.
 */
export function searchCards(index: SearchIndex, query: string): string[] {
  return index.search(query, { boost: { title: 3 }, limit: 50 }).map(hit => hit.id)
}
