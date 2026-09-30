/**
 * Strips accents and case, so « Créer » is found by typing "creer". Shared by
 * the command palette and the card search, so the two rank query text the
 * same way.
 */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** The position of `query` inside `haystack`, folded — or `null` if absent. An empty query always matches at 0. */
export function matchScore(haystack: string, query: string): number | null {
  if (query === '') return 0
  const index = fold(haystack).indexOf(fold(query))
  return index === -1 ? null : index
}

/**
 * Ranks a candidate against a query using a primary field (title, label) and a
 * secondary one (definition, description): a hit at the very start of
 * `primary` wins outright, an earlier hit elsewhere in `primary` beats a
 * later one, and a hit confined to `secondary` still counts, but behind every
 * hit in `primary`.
 */
export function rankedScore(primary: string, secondary: string, query: string): number | null {
  const primaryScore = matchScore(primary, query)
  if (primaryScore === 0) return 0
  if (primaryScore !== null) return 1 + primaryScore / 100
  const secondaryScore = matchScore(secondary, query)
  return secondaryScore === null ? null : 100
}
