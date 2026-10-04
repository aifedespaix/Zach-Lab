import { describe, expect, it } from 'vitest'
import { headerUnit, tableLayout } from './tableUnits'

describe('headerUnit', () => {
  it('lit une cellule qui est une unité seule', () => {
    expect(headerUnit('km')).toBe('km')
    expect(headerUnit(' h ')).toBe('h')
    expect(headerUnit('km/h')).toBe('km/h')
    expect(headerUnit('€')).toBe('€')
  })

  it("lit l'unité entre parenthèses ou crochets en fin de cellule", () => {
    expect(headerUnit('Distance (km)')).toBe('km')
    expect(headerUnit('Temps (h)')).toBe('h')
    expect(headerUnit('Prix [€]')).toBe('€')
    expect(headerUnit('Distance (km) ')).toBe('km')
    expect(headerUnit('(km)')).toBe('km')
    expect(headerUnit('t (s)')).toBe('s')
  })

  it("lit l'unité après « en »", () => {
    expect(headerUnit('Vitesse en km/h')).toBe('km/h')
    expect(headerUnit('Temps en h')).toBe('h')
    expect(headerUnit('Prix en €')).toBe('€')
    expect(headerUnit('Vitesse (en km/h)')).toBe('km/h')
  })

  it("refuse ce qui n'est pas un en-tête d'unité", () => {
    expect(headerUnit('')).toBeNull()
    expect(headerUnit('   ')).toBeNull()
    expect(headerUnit('Distance')).toBeNull()
    expect(headerUnit('16 km')).toBeNull()
    expect(headerUnit('5')).toBeNull()
    expect(headerUnit('mètres')).toBeNull()
    expect(headerUnit('Durée en minutes')).toBeNull()
    expect(headerUnit('Entrée')).toBeNull()
    expect(headerUnit('t')).toBeNull()
    expect(headerUnit('Prix (euros)')).toBeNull()
  })
})

describe('tableLayout', () => {
  it('prend les unités de la première ligne, coin exclu', () => {
    const cells = [['Grandeur', 'Distance (km)', 'Temps (h)'], ['A', '10', '2']]
    expect(tableLayout(cells)).toEqual({ axis: 'columns', units: [null, 'km', 'h'] })
  })

  it("ne retient que les colonnes dont l'en-tête est une unité", () => {
    const cells = [['', 'Distance (km)', 'Remarque'], ['A', '10', 'ok']]
    expect(tableLayout(cells)).toEqual({ axis: 'columns', units: [null, 'km', null] })
  })

  it('à défaut, prend les unités de la première colonne', () => {
    const cells = [['', 'A', 'B'], ['Distance (km)', '10', '20'], ['Temps (h)', '2', '4']]
    expect(tableLayout(cells)).toEqual({ axis: 'rows', units: [null, 'km', 'h'] })
  })

  it('quand les deux ont des unités, la première ligne l\'emporte', () => {
    const cells = [['', 'Distance (km)'], ['Temps (h)', '2']]
    expect(tableLayout(cells)).toEqual({ axis: 'columns', units: [null, 'km'] })
  })

  it('ignore le coin : une unité seule en (0, 0) n\'est pas un en-tête', () => {
    expect(tableLayout([['km', 'x'], ['y', 'z']])).toBeNull()
    expect(tableLayout([['km', 'Distance'], ['x', '2']])).toBeNull()
    // Le coin est ignoré, mais un `h` plus bas dans la première colonne est bien un en-tête de ligne.
    expect(tableLayout([['km', 'Distance'], ['h', '2']])).toEqual({ axis: 'rows', units: [null, 'h'] })
  })

  it('ne trouve rien sans unité, dans un tableau vide, 1×1, ou de cellules vides', () => {
    expect(tableLayout([['a', 'b'], ['c', 'd']])).toBeNull()
    expect(tableLayout([['3', '5'], ['7', '9']])).toBeNull()
    expect(tableLayout([['km']])).toBeNull()
    expect(tableLayout([])).toBeNull()
    expect(tableLayout([[]])).toBeNull()
    expect(tableLayout([['', ''], ['', '']])).toBeNull()
  })

  it('supporte des lignes de longueurs inégales', () => {
    expect(tableLayout([['', 'Distance (km)'], ['A']])).toEqual({ axis: 'columns', units: [null, 'km'] })
    expect(tableLayout([['', 'a'], ['Temps (h)']])).toEqual({ axis: 'rows', units: [null, 'h'] })
  })
})
