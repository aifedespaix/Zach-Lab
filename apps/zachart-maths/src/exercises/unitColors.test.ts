import { describe, expect, it } from 'vitest'
import { assignExerciseHues, assignHues, UNIT_HUES } from './unitColors'

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

describe('assignExerciseHues', () => {
  const base = { enonce: '', reponse: '' }
  const table = (...rows: string[][]) => ({ id: 't', type: 'tableau', cellules: rows })
  const text = (contenu: string) => ({ id: 'x', type: 'texte', contenu })

  it("range les unités dans l'ordre de lecture : énoncé, zone A, zone B, réponse", () => {
    const hues = assignExerciseHues({
      enonce: '3 km',
      blocs: [text('2 kg')],
      blocsB: [text('5 L')],
      reponse: '1 g',
    })
    expect([...hues.keys()]).toEqual(['km', 'kg', 'L', 'g'])
    expect(hues.get('km')).toBe(UNIT_HUES[0])
    expect(hues.get('g')).toBe(UNIT_HUES[3])
  })

  it("compte les unités d'en-tête d'un tableau, à la place du bloc", () => {
    const hues = assignExerciseHues({
      enonce: '3 km',
      blocs: [text('2 kg'), table(['', 'Temps (h)'], ['a', '1'])],
      reponse: '1 m',
    })
    expect([...hues.keys()]).toEqual(['km', 'kg', 'h', 'm'])
  })

  it("donne une teinte à une unité d'une lettre qui n'est que dans un en-tête", () => {
    const hues = assignExerciseHues({ ...base, blocs: [table(['', 'h'], ['a', '1'])] })
    expect(hues.get('h')).toBe(UNIT_HUES[0])
  })

  it("donne la même teinte à une unité de l'énoncé et du tableau", () => {
    const hues = assignExerciseHues({
      ...base,
      enonce: 'Je fais 16 km',
      blocs: [table(['', 'Distance (km)'], ['a', '16'])],
    })
    expect(hues.size).toBe(1)
    expect(hues.get('km')).toBe(UNIT_HUES[0])
  })

  it("lit les unités des lignes d'en-tête d'un tableau à première colonne", () => {
    const hues = assignExerciseHues({
      ...base,
      blocs: [table(['', 'a'], ['Distance (km)', '1'], ['Temps (h)', '2'])],
    })
    expect([...hues.keys()]).toEqual(['km', 'h'])
  })

  it("ne donne rien à un tableau sans en-tête d'unité, ni aux cellules de données", () => {
    const hues = assignExerciseHues({ ...base, blocs: [table(['a', 'b'], ['16 km', '3 h'])] })
    expect(hues.size).toBe(0)
  })

  it('supporte une zone B absente, un bloc inconnu et des valeurs inattendues', () => {
    const hues = assignExerciseHues({
      ...base,
      blocs: [
        null,
        42,
        { id: 'x', type: 'inconnu' },
        { id: 'y', type: 'texte' },
        { id: 'z', type: 'texte', contenu: 12 },
        { id: 'a', type: 'tableau' },
        { id: 'b', type: 'tableau', cellules: 'oups' },
        { id: 'c', type: 'tableau', cellules: [[1, null], 'x', ['', 'h']] },
        { id: 'd', type: 'tableau', cellules: [['', 'Distance (km)'], ['a', 2]] },
      ],
    })
    expect(hues.size).toBe(0)
  })
})
