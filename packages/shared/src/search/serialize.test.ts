import { describe, expect, it } from 'vitest'
import { createSearchIndex } from './createSearchIndex'
import { loadSearchIndex } from './loadSearchIndex'

const FIELDS = ['title', 'body']

function built() {
  const index = createSearchIndex(FIELDS)
  index.add({ id: 'a', title: 'Les fractions', body: 'Additionner deux fractions' })
  index.add({ id: 'b', title: 'Été', body: 'Le cycle des saisons' })
  return index
}

describe('index sérialisé', () => {
  it('un index rechargé donne les mêmes résultats que l\'original', () => {
    const original = built()
    const reloaded = loadSearchIndex(FIELDS, original.serialize())
    expect(reloaded.size()).toBe(2)
    expect(reloaded.search('fractions')).toEqual(original.search('fractions'))
    expect(reloaded.search('ete')).toEqual(original.search('ete'))
  })

  it('reste modifiable après rechargement', () => {
    const reloaded = loadSearchIndex(FIELDS, built().serialize())
    reloaded.add({ id: 'c', title: 'Géométrie', body: 'Triangles' })
    reloaded.remove('a')
    expect(reloaded.size()).toBe(2)
    expect(reloaded.search('triangle')[0]?.id).toBe('c')
    expect(reloaded.search('fractions')).toEqual([])
  })

  it('un index sérialisé est une chaîne JSON, qu\'on peut stocker ou compiler dans l\'app', () => {
    const serialized = built().serialize()
    expect(typeof serialized).toBe('string')
    expect(() => JSON.parse(serialized)).not.toThrow()
  })

  it('un index vide se sérialise et se recharge', () => {
    const reloaded = loadSearchIndex(FIELDS, createSearchIndex(FIELDS).serialize())
    expect(reloaded.size()).toBe(0)
    expect(reloaded.search('x')).toEqual([])
  })

  it.each([
    ['vide', ''],
    ['pas du JSON', 'pas du json'],
    ['objet vide', '{}'],
    ['version inconnue', '{"v":999}'],
    ['null', 'null'],
    ['tableau', '[1,2,3]'],
    ['nombre', '42'],
    ['données absentes', '{"v":1,"fields":["title","body"]}'],
    ['données de mauvais type', '{"v":1,"fields":["title","body"],"data":"x"}'],
    ['données tronquées', '{"v":1,"fields":["title","body"],"data":{"docs":'],
  ])('un contenu illisible (%s) donne un index vide et utilisable, sans planter', (_label, bad) => {
    let index = createSearchIndex(FIELDS)
    expect(() => {
      index = loadSearchIndex(FIELDS, bad)
    }).not.toThrow()
    expect(index.size()).toBe(0)
    expect(() => index.add({ id: 'x', title: 'ok' })).not.toThrow()
    expect(index.search('ok')[0]?.id).toBe('x')
  })

  it('refuse un index construit avec d\'autres champs (il chercherait au mauvais endroit)', () => {
    const other = createSearchIndex(['nom'])
    other.add({ id: 'x', nom: 'fractions' })
    const reloaded = loadSearchIndex(FIELDS, other.serialize())
    expect(reloaded.size()).toBe(0)
  })

  it('l\'ordre des champs ne change pas leur identité', () => {
    const reloaded = loadSearchIndex(['body', 'title'], built().serialize())
    expect(reloaded.size()).toBe(2)
  })
})
