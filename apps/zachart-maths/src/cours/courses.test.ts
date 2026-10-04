import { describe, expect, it } from 'vitest'
import { COURSES, loadCourses, parseCourse } from './courses'
import { parseMarkdown } from './markdown'
import { renderMathToHtml } from '@suite/shared/math'

describe('parseCourse', () => {
  it('lit l\'en-tête et le corps', () => {
    const c = parseCourse('x', '---\ntitre: Un cours\nchapitre: Fractions\nmots-cles: a, b ,, c\n---\n# Titre\n\nTexte')
    expect(c).toEqual({ id: 'x', titre: 'Un cours', chapitre: 'Fractions', motsCles: ['a', 'b', 'c'], corps: '# Titre\n\nTexte' })
  })
  it('accepte les fins de ligne Windows et un BOM', () => {
    expect(parseCourse('x', '﻿---\r\ntitre: T\r\n---\r\ncorps')).toMatchObject({ titre: 'T', corps: 'corps', chapitre: '', motsCles: [] })
  })
  it('refuse un fichier sans en-tête ou sans titre', () => {
    expect(parseCourse('x', '# Juste du texte')).toBeNull()
    expect(parseCourse('x', '---\nchapitre: A\n---\ntexte')).toBeNull()
  })
})

describe('loadCourses', () => {
  it('prend l\'identifiant du nom de fichier, ignore l\'illisible, trie par chapitre puis titre', () => {
    const courses = loadCourses({
      './contenu/b.md': '---\ntitre: Zèbre\nchapitre: B\n---\n.',
      './contenu/a.md': '---\ntitre: Alpha\nchapitre: B\n---\n.',
      './contenu/c.md': '---\ntitre: Premier\nchapitre: A\n---\n.',
      './contenu/bad.md': 'rien',
    })
    expect(courses.map(c => c.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('cours compilés avec le dépôt', () => {
  it('chaque cours est lisible, a un chapitre et des mots-clés, et des identifiants uniques', () => {
    expect(COURSES.length).toBeGreaterThanOrEqual(5)
    expect(new Set(COURSES.map(c => c.id)).size).toBe(COURSES.length)
    for (const c of COURSES) {
      expect(c.chapitre, c.id).not.toBe('')
      expect(c.motsCles.length, c.id).toBeGreaterThan(0)
      expect(c.corps.length, c.id).toBeGreaterThan(50)
    }
  })
  it('tous les encadrés ont une étiquette connue (sinon ils s\'afficheraient en citation)', () => {
    for (const c of COURSES) {
      expect(c.corps.match(/^>\s*\[!/gm)?.length ?? 0, c.id).toBe(
        parseMarkdown(c.corps).filter(b => b.t === 'callout').length,
      )
    }
  })
  it('toutes les formules se composent sans repli', () => {
    for (const c of COURSES) {
      for (const m of Array.from(c.corps.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g))) {
        const formula = m[1] ?? m[2]
        expect(renderMathToHtml(formula), `${c.id} : ${formula}`).not.toContain('katex-error')
      }
    }
  })
})
