import { describe, expect, it } from 'vitest'
import { filterChapters } from './treeSearch'
import { NO_CORRECTION } from './correction'
import type { ChapterNode } from './types'

const ex = (path: string, titre: string) => ({ path, titre, exercices: 1, ...NO_CORRECTION, corrompu: false })

const tree: ChapterNode[] = [
  { name: 'Fractions', exercises: [ex('Fractions/a.json', 'Additionner'), ex('Fractions/b.json', 'Simplifier')] },
  { name: 'Géométrie', exercises: [ex('Géométrie/c.json', 'Théorème de Pythagore')] },
]

describe('filterChapters', () => {
  it('requête vide : l’arbre tel quel', () => {
    const r = filterChapters(tree, '  ')
    expect(r.chapters).toEqual(tree)
    expect(filterChapters(tree, ' ').chapters).toBe(tree)
    expect(r.forcedOpen.size).toBe(0)
  })

  it('ne garde que les exercices qui correspondent, et ouvre leur chapitre', () => {
    const r = filterChapters(tree, 'pythagore')
    expect(r.chapters).toEqual([{ name: 'Géométrie', exercises: [tree[1].exercises[0]] }])
    expect([...r.forcedOpen]).toEqual(['Géométrie'])
  })

  it('un chapitre qui correspond par son nom garde tous ses exercices', () => {
    const r = filterChapters(tree, 'fractions')
    expect(r.chapters[0].exercises).toHaveLength(2)
  })

  it('tolère les accents', () => {
    expect(filterChapters(tree, 'geometrie').chapters.map(c => c.name)).toEqual(['Géométrie'])
  })

  it('aucun résultat : liste vide', () => {
    expect(filterChapters(tree, 'zzzzzz').chapters).toEqual([])
  })

  it('accepte un début de mot', () => {
    expect(filterChapters(tree, 'pythagor').chapters.map(c => c.name)).toEqual(['Géométrie'])
  })

  it('tolère une vraie faute de frappe', () => {
    expect(filterChapters(tree, 'pytagore').chapters.map(c => c.name)).toEqual(['Géométrie'])
    expect(filterChapters(tree, 'pythagroe').chapters.map(c => c.name)).toEqual(['Géométrie'])
  })

  it('ne modifie pas l’arbre d’origine', () => {
    const before = JSON.stringify(tree)
    filterChapters(tree, 'pythagore')
    expect(JSON.stringify(tree)).toBe(before)
  })
})
