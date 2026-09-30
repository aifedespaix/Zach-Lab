import { describe, expect, it } from 'vitest'
import { createCardSearchIndex, searchCards } from './cardSearch'
import type { Card } from '../types/card'

const acide: Card = {
  id: 'acide',
  level: 2,
  title: 'Les acides',
  definition: 'Une substance dont le pH est inférieur à 7.',
  parentId: 'root',
  order: 0,
}

const base: Card = {
  id: 'base',
  level: 2,
  title: 'Les bases',
  definition: 'Une substance dont le pH est supérieur à 7, les acides la neutralisent.',
  parentId: 'root',
  order: 1,
}

const flottante: Card = {
  id: 'flottante',
  level: 2,
  title: '',
  detached: true,
  parentId: null,
  order: 0,
}

const noted: Card = { ...flottante, id: 'noted', title: 'Exercice 3 corrigé' }

describe('searchCards', () => {
  it('classe une carte dont le TITRE correspond avant une carte dont seule la définition correspond', () => {
    const index = createCardSearchIndex([base, acide])
    // « acides » est le titre de l'une et seulement dans la définition de l'autre.
    expect(searchCards(index, 'acides')).toEqual(['acide', 'base'])
  })

  it('le titre pèse plus que la définition, même quand celle-ci répète le mot', () => {
    const bavarde: Card = { ...base, id: 'bavarde', title: 'Divers', definition: 'acide '.repeat(40) }
    const index = createCardSearchIndex([bavarde, acide])
    expect(searchCards(index, 'acide')[0]).toBe('acide')
  })

  it('cherche dans la définition quand le titre ne correspond pas', () => {
    expect(searchCards(createCardSearchIndex([acide]), 'inférieur')).toEqual(['acide'])
  })

  it('ignore les accents et la casse', () => {
    const index = createCardSearchIndex([acide])
    expect(searchCards(index, 'INFERIEUR')).toEqual(['acide'])
    expect(searchCards(index, 'les ACIDES')).toEqual(['acide'])
  })

  it('reconnaît le singulier et le pluriel', () => {
    expect(searchCards(createCardSearchIndex([acide]), 'acide')).toEqual(['acide'])
  })

  it('inclut les cartes volantes', () => {
    expect(searchCards(createCardSearchIndex([noted]), 'exercice')).toEqual(['noted'])
  })

  it('une carte sans aucun texte ne correspond à aucune requête', () => {
    const index = createCardSearchIndex([flottante])
    expect(searchCards(index, 'quoi')).toEqual([])
  })

  it('ne renvoie rien quand rien ne correspond', () => {
    expect(searchCards(createCardSearchIndex([acide, base]), 'xyzzy')).toEqual([])
  })

  it('renvoie [] pour une requête vide : la recherche de cartes n\'affiche pas tout à la place', () => {
    expect(searchCards(createCardSearchIndex([acide, base]), '')).toEqual([])
    expect(searchCards(createCardSearchIndex([acide, base]), '   ')).toEqual([])
  })

  it('accepte un ensemble vide de cartes', () => {
    expect(searchCards(createCardSearchIndex([]), 'acide')).toEqual([])
  })

  it('ne plante pas sur un titre ou une définition absents', () => {
    const sansDefinition: Card = { id: 'nue', level: 3, title: 'Solution', parentId: 'root', order: 2 }
    expect(searchCards(createCardSearchIndex([sansDefinition]), 'solution')).toEqual(['nue'])
  })

  it('retrouve une carte dont l\'id ressemble à une propriété d\'objet', () => {
    const odd: Card = { ...acide, id: 'constructor', title: 'Constructeur' }
    expect(searchCards(createCardSearchIndex([odd]), 'constructeur')).toEqual(['constructor'])
  })
})
