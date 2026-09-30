import { describe, it, expect } from 'vitest'
import { scoreCard } from './scoreCard'
import type { Card } from '../types/card'

const acide: Card = {
  id: 'acide',
  level: 2,
  title: 'Les acides',
  definition: 'Une substance dont le pH est inférieur à 7.',
  parentId: 'root',
  order: 0,
}

const flottante: Card = {
  id: 'flottante',
  level: 2,
  title: '',
  detached: true,
  parentId: null,
  order: 0,
}

describe('scoreCard', () => {
  it('ranks a title hit before a definition-only hit', () => {
    const titleHit = scoreCard(acide, 'acide')
    const defHit = scoreCard(acide, 'substance')
    expect(titleHit).not.toBeNull()
    expect(defHit).not.toBeNull()
    expect(titleHit!).toBeLessThan(defHit!)
  })

  it('matches inside the definition when the title does not match', () => {
    expect(scoreCard(acide, 'inférieur')).not.toBeNull()
  })

  it('includes floating (detached) cards in scoring', () => {
    const noted: Card = { ...flottante, title: 'Exercice 3 corrigé' }
    expect(scoreCard(noted, 'exercice')).not.toBeNull()
  })

  it('only an empty query matches a card with no text', () => {
    expect(scoreCard(flottante, '')).toBe(0)
    expect(scoreCard(flottante, 'quoi')).toBeNull()
  })

  it('returns null when the query matches neither field', () => {
    expect(scoreCard(acide, 'xyzzy')).toBeNull()
  })
})
