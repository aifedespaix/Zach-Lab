import { describe, it, expect } from 'vitest'
import { fold, matchScore, rankedScore } from './textSearch'

describe('fold', () => {
  it('strips accents and lower-cases', () => {
    expect(fold('Créer une Carte')).toBe('creer une carte')
  })
})

describe('matchScore', () => {
  it('returns 0 for an empty query regardless of haystack', () => {
    expect(matchScore('Anything', '')).toBe(0)
  })

  it('returns the match index, accent- and case-insensitive', () => {
    expect(matchScore('Les acides et les bases', 'BASES')).toBe(18)
  })

  it('returns null when the query is not found', () => {
    expect(matchScore('Les acides', 'xyzzy')).toBeNull()
  })
})

describe('rankedScore', () => {
  it('scores an empty query as 0', () => {
    expect(rankedScore('Renommer', 'Renomme le fichier', '')).toBe(0)
  })

  it('scores a primary hit at position 0 as 0', () => {
    expect(rankedScore('Renommer', 'description', 'Renom')).toBe(0)
  })

  it('scores a later primary hit above a position-0 hit', () => {
    const early = rankedScore('Renommer', '', 'ren')
    const late = rankedScore('Ouvrir la fiche', '', 'fiche')
    expect(early).toBeLessThan(late!)
  })

  it('scores a secondary-only hit as 100', () => {
    expect(rankedScore('Renommer', 'Renomme le fichier ouvert', 'fichier')).toBe(100)
  })

  it('returns null when neither field matches', () => {
    expect(rankedScore('Renommer', 'Renomme le fichier', 'xyzzy')).toBeNull()
  })
})
