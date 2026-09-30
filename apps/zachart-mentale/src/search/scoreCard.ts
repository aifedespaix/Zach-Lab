import { rankedScore } from './textSearch'
import type { Card } from '../types/card'

/**
 * Ranks a card against a search query: a title hit outranks a definition-only
 * hit, and an earlier hit outranks a later one — same principle as
 * `scoreCommand`, applied to card content instead of the command catalogue.
 */
export function scoreCard(card: Card, query: string): number | null {
  return rankedScore(card.title, card.definition ?? '', query)
}
