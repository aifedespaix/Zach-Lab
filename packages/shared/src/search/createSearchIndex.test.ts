import { describe, expect, it } from 'vitest'
import { createSearchIndex } from './createSearchIndex'

const cours = () => {
  const index = createSearchIndex(['title', 'body'])
  index.add({ id: 'a', title: 'Les fractions', body: 'Additionner deux fractions de même dénominateur' })
  index.add({ id: 'b', title: 'Été et saisons', body: 'Le cycle des saisons' })
  index.add({ id: 'c', title: 'Géométrie', body: 'Triangles et cercles' })
  return index
}

describe('createSearchIndex — recherche en français', () => {
  it('trouve un mot exact', () => {
    expect(cours().search('fractions')[0]?.id).toBe('a')
  })

  it('ignore les accents dans les deux sens', () => {
    expect(cours().search('ete')[0]?.id).toBe('b')
    expect(cours().search('géométrie')[0]?.id).toBe('c')
    expect(cours().search('geometrie')[0]?.id).toBe('c')
    expect(cours().search('dénominateur')[0]?.id).toBe('a')
    expect(cours().search('denominateur')[0]?.id).toBe('a')
  })

  it('ignore la casse', () => {
    expect(cours().search('FRACTIONS')[0]?.id).toBe('a')
    expect(cours().search('ÉTÉ')[0]?.id).toBe('b')
  })

  it('reconnaît le singulier et le pluriel', () => {
    expect(cours().search('fraction')[0]?.id).toBe('a')
    expect(cours().search('triangle')[0]?.id).toBe('c')
    expect(cours().search('saison')[0]?.id).toBe('b')
  })

  it('rapproche les formes d’un même mot que la tolérance aux fautes ne peut pas couvrir (conjugaison)', () => {
    // « multiplions » est à trois lettres de « multiplier » : seul le radical les réunit.
    const index = createSearchIndex(['title'])
    index.add({ id: 'v', title: 'Multiplier deux nombres' })
    index.add({ id: 'x', title: 'Mesurer une longueur' })
    expect(index.search('multiplions')[0]?.id).toBe('v')
    expect(index.search('mesurons')[0]?.id).toBe('x')
  })

  it('tolère une faute de frappe', () => {
    expect(cours().search('fractoins')[0]?.id).toBe('a')
    expect(cours().search('geometri')[0]?.id).toBe('c')
  })

  it('cherche dans tous les champs indexés', () => {
    expect(cours().search('cercles')[0]?.id).toBe('c')
  })

  it('peut restreindre la recherche à certains champs', () => {
    const index = cours()
    expect(index.search('cercles', { fields: ['title'] })).toEqual([])
    expect(index.search('cercles', { fields: ['body'] })[0]?.id).toBe('c')
  })

  it('renvoie une note, et la meilleure correspondance en premier', () => {
    const index = createSearchIndex(['title', 'body'])
    index.add({ id: 'faible', title: 'Autre chose', body: 'on parle un peu de fractions ici' })
    index.add({ id: 'fort', title: 'Fractions', body: 'Fractions, fractions et encore des fractions' })
    const hits = index.search('fractions')
    expect(hits.map(hit => hit.id)).toEqual(['fort', 'faible'])
    expect(hits[0].score).toBeGreaterThan(hits[1].score)
  })
})

describe('createSearchIndex — entrées limites', () => {
  it('renvoie [] pour une requête vide ou blanche (et non tout l\'index)', () => {
    expect(cours().search('')).toEqual([])
    expect(cours().search('   ')).toEqual([])
    expect(cours().search('\n\t')).toEqual([])
  })

  it.each(['(', '[', '.*', String.fromCharCode(92), '"', '%', '🙂', '((((', '$^', '<script>', '\u0000'])(
    'ne plante pas et ne renvoie pas tout l\'index sur %j',
    term => {
      const index = cours()
      let hits: unknown[] = []
      expect(() => {
        hits = index.search(term)
      }).not.toThrow()
      expect(hits.length).toBeLessThan(3)
    },
  )

  it('fonctionne sur un index vide', () => {
    expect(createSearchIndex(['title']).search('x')).toEqual([])
    expect(createSearchIndex(['title']).size()).toBe(0)
  })

  it('respecte limit', () => {
    const index = createSearchIndex(['title'])
    for (let i = 0; i < 30; i++) index.add({ id: `d${i}`, title: `fraction numéro ${i}` })
    expect(index.search('fraction', { limit: 5 })).toHaveLength(5)
  })

  it('renvoie au plus 20 résultats par défaut, pas des milliers', () => {
    const index = createSearchIndex(['title'])
    for (let i = 0; i < 200; i++) index.add({ id: `d${i}`, title: `fraction numéro ${i}` })
    expect(index.search('fraction').length).toBeLessThanOrEqual(20)
  })

  it('accepte des champs absents ou vides dans un document', () => {
    const index = createSearchIndex(['title', 'body'])
    expect(() => index.add({ id: 'x', title: '' })).not.toThrow()
    expect(() => index.add({ id: 'y', title: 'seul le titre' })).not.toThrow()
    expect(index.search('titre')[0]?.id).toBe('y')
  })

  it('gère de longs textes', () => {
    const index = createSearchIndex(['body'])
    index.add({ id: 'long', body: 'mot '.repeat(50_000) })
    expect(index.search('mot')[0]?.id).toBe('long')
  })

  it('gère des ids qui ressemblent à des propriétés d\'objet', () => {
    const index = createSearchIndex(['title'])
    for (const id of ['constructor', '__proto__', 'toString']) index.add({ id, title: `carte ${id}` })
    expect(index.size()).toBe(3)
    expect(index.search('carte').length).toBe(3)
  })
})

describe('createSearchIndex — mise à jour', () => {
  it('update remplace, remove supprime', () => {
    const index = cours()
    index.update({ id: 'a', title: 'Décimaux', body: 'Nombres à virgule' })
    expect(index.search('fractions')).toEqual([])
    expect(index.search('décimaux')[0]?.id).toBe('a')
    index.remove('a')
    expect(index.search('décimaux')).toEqual([])
    expect(index.size()).toBe(2)
  })

  it('add sur un id déjà présent remplace le document, sans doublon ni erreur', () => {
    const index = cours()
    expect(() => index.add({ id: 'a', title: 'Racines carrées', body: 'x' })).not.toThrow()
    expect(index.size()).toBe(3)
    expect(index.search('fractions')).toEqual([])
    expect(index.search('racines')[0]?.id).toBe('a')
  })

  it('update sur un id inconnu l\'ajoute', () => {
    const index = cours()
    index.update({ id: 'z', title: 'Nouveau', body: 'x' })
    expect(index.size()).toBe(4)
  })

  it('remove d\'un id inconnu ne fait rien', () => {
    const index = cours()
    expect(() => index.remove('nope')).not.toThrow()
    expect(index.size()).toBe(3)
  })
})
