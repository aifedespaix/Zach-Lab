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

  it('ignore le coin : une unité seule en (0, 0) ne décide pas de l\'axe', () => {
    // Coin seul, sans unité ailleurs : pas d'en-tête.
    expect(tableLayout([['km', 'x'], ['y', 'z']])).toBeNull()
    expect(tableLayout([['km', 'Distance'], ['x', '2']])).toBeNull()
    // Le coin ne décide pas de l'axe, mais une fois l'axe retenu, le coin en fait partie.
    // Ici : première ligne (hors coin) sans unité, première colonne (hors coin) a 'h' → axe rows
    // → units[0] = headerUnit(coin) = 'km', units[1] = 'h'.
    expect(tableLayout([['km', 'Distance'], ['h', '2']])).toEqual({ axis: 'rows', units: ['km', 'h'] })
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

  it('colore un tableau de proportionnalité (lignes)', () => {
    const cells = [['Distance (km)', '10', '20'], ['Temps (h)', '1', '2']]
    expect(tableLayout(cells)).toEqual({ axis: 'rows', units: ['km', 'h'] })
  })

  it('colore un tableau de proportionnalité (colonnes)', () => {
    const cells = [['Distance (km)', 'Temps (h)'], ['10', '1']]
    expect(tableLayout(cells)).toEqual({ axis: 'columns', units: ['km', 'h'] })
  })

  it('refuse une lettre seule d\'en-tête si ce ne sont pas toutes des unités : données vs en-têtes', () => {
    // Taille | S | M | L | XL : L serait litres, mais S, M, XL ne sont pas des unités → aucune couleur
    expect(tableLayout([['Taille', 'S', 'M', 'L', 'XL'], ['Effectif', '3', '5', '4', '2']])).toBeNull()
    // Même table en colonnes (data par colonne)
    expect(tableLayout([['Taille', 'Effectif'], ['S', '3'], ['M', '5'], ['L', '4'], ['XL', '2']])).toBeNull()
    // Jour | L | M | M | J | V : L serait lundi, mais J et V ne sont pas des unités
    expect(tableLayout([['Jour', 'L', 'M', 'M', 'J', 'V'], ['Effectif', '1', '2', '3', '4', '5']])).toBeNull()
    // Lettre | a | e | m | s : m et s seraient mètre et seconde, mais a et e ne sont pas des unités
    expect(tableLayout([['Lettre', 'a', 'e', 'm', 's'], ['Effectif', '1', '2', '3', '4']])).toBeNull()
  })

  it('accepte une lettre seule d\'en-tête que si TOUTES les voisines sont aussi des unités', () => {
    // h et km : tous deux reconnus comme unités → coloration
    expect(tableLayout([['', 'h', 'km'], ['a', '1', '2']])).toEqual({ axis: 'columns', units: [null, 'h', 'km'] })
    // h et s : tous deux d\'un caractère et reconnus comme unités → coloration
    expect(tableLayout([['', 'h', 's'], ['a', '1', '2']])).toEqual({ axis: 'columns', units: [null, 'h', 's'] })
    // h seul, aucune voisine : accepté (vide n\'est pas une contradiction)
    expect(tableLayout([['', 'h'], ['a', '1']])).toEqual({ axis: 'columns', units: [null, 'h'] })
  })

  it('refuse une lettre seule si au moins une voisine n\'est pas une unité', () => {
    // h, Remarque : Remarque n\'est pas une unité → aucune couleur (prudence)
    expect(tableLayout([['', 'h', 'Remarque'], ['a', '1', 'ok']])).toBeNull()
  })

  it('accepte les lettres dans des en-têtes lus entre parenthèses ou après « en »', () => {
    // Temps (h) : h entre parenthèses, pas besoin de vérifier les voisines → coloration
    expect(tableLayout([['Distance (km)', '10', '20'], ['Temps (h)', '1', '2']])).toEqual({
      axis: 'rows',
      units: ['km', 'h'],
    })
  })

  it('accepte les lettres d\'un caractère qui ne sont pas des unités lues seules : multi-caractères', () => {
    // m et kg : m seul serait mètre, mais ici c\'est passé par parseUnit donc accepté même seul
    // kg n\'est jamais un problème (deux caractères)
    expect(tableLayout([['', 'm', 'kg'], ['a', '1', '2']])).toEqual({
      axis: 'columns',
      units: [null, 'm', 'kg'],
    })
  })
})
