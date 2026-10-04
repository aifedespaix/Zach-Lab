import { describe, expect, it } from 'vitest'
import { assignHues, exerciseTexts, UNIT_HUES } from './unitColors'

describe('assignHues', () => {
  it('donne une teinte à chaque unité, dans l\'ordre où elles apparaissent', () => {
    const hues = assignHues(['Je vais à 3 km/h, je fais 16 km ?'])
    expect(hues.get('km/h')).toBe(UNIT_HUES[0])
    expect(hues.get('km')).toBe(UNIT_HUES[1])
  })

  it('garde la même teinte pour une unité d\'un texte à l\'autre', () => {
    const hues = assignHues(['3 km/h et 16 km', '4 km', 'x km/h'])
    expect(hues.size).toBe(2)
    expect(hues.get('km')).toBe(UNIT_HUES[1])
    expect(hues.get('km/h')).toBe(UNIT_HUES[0])
  })

  it('ne donne rien à un texte sans grandeur', () => {
    expect(assignHues(['Résous x + 3 = 5', '']).size).toBe(0)
  })

  it('recommence la palette au-delà de huit unités, sans planter', () => {
    const hues = assignHues(['1 km 1 m 1 kg 1 g 1 h 1 s 1 L 1 € 1 min'])
    expect(hues.size).toBe(9)
    expect(hues.get('min')).toBe(UNIT_HUES[0])
  })
})

describe('exerciseTexts', () => {
  const base = { enonce: 'Énoncé', reponse: 'Réponse' }

  it('range les textes : énoncé, zone A, zone B, réponse', () => {
    const texts = exerciseTexts({
      ...base,
      blocs: [{ id: 'a', type: 'texte', contenu: 'A1' }, { id: 'b', type: 'calcul', lignes: [] }, { id: 'c', type: 'texte', contenu: 'A2' }],
      blocsB: [{ id: 'd', type: 'texte', contenu: 'B1' }],
    })
    expect(texts).toEqual(['Énoncé', 'A1', 'A2', 'B1', 'Réponse'])
  })

  it('supporte une zone B absente, un bloc inconnu et des valeurs inattendues', () => {
    const texts = exerciseTexts({
      ...base,
      blocs: [null, 42, { id: 'x', type: 'inconnu' }, { id: 'y', type: 'texte' }, { id: 'z', type: 'texte', contenu: 12 }],
    })
    expect(texts).toEqual(['Énoncé', 'Réponse'])
  })
})
