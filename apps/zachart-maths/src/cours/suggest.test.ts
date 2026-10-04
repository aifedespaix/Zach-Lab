import { describe, expect, it } from 'vitest'
import { COURSES } from './courses'
import { indexCourses, searchCourses } from './courseSearch'
import { keywordsOf, suggestCourses, topicOfChapter, type ExerciseContext } from './suggest'

const index = indexCourses(COURSES)
const ctx = (patch: Partial<ExerciseContext> = {}): ExerciseContext => ({ chapter: '', titre: '', texte: '', formules: [], ...patch })
const ids = (c: ExerciseContext) => suggestCourses(index, COURSES, c).map(s => s.course.id)

describe('searchCourses', () => {
  it('trouve par titre, sans accents ni faute de frappe', () => {
    expect(searchCourses(index, COURSES, 'pythagore')[0]?.id).toBe('pythagore')
    expect(searchCourses(index, COURSES, 'hypotenuse')[0]?.id).toBe('pythagore')
    expect(searchCourses(index, COURSES, 'equasion').slice(0, 3).map(c => c.id)).toContain('equations-premier-degre')
  })
  it('cherche aussi dans le corps du cours', () => {
    expect(searchCourses(index, COURSES, 'produit en croix')[0]?.id).toBe('proportionnalite')
  })
  it('ne renvoie rien pour une requête vide', () => {
    expect(searchCourses(index, COURSES, '  ')).toEqual([])
  })
})

describe('keywordsOf', () => {
  it('garde les mots utiles, une fois chacun, et déduit des mots des formules', () => {
    const words = keywordsOf(ctx({ titre: 'Calculer la fraction', texte: 'dans la fraction, calculer', formules: ['\\frac{1}{2}+\\sqrt{4}'] })).split(' ')
    expect(words.filter(w => w === 'fraction')).toHaveLength(1)
    expect(words).not.toContain('dans')
    expect(keywordsOf(ctx({ formules: ['\\sqrt{4}'] }))).toBe('racine carrée')
  })
  it('borne la requête quel que soit l\'énoncé', () => {
    const texte = Array.from({ length: 500 }, (_, i) => `mot${String.fromCharCode(97 + (i % 26)).repeat(3)}${'x'.repeat(i % 7)}`).join(' ')
    expect(keywordsOf(ctx({ texte })).split(' ').length).toBeLessThanOrEqual(30)
  })
})

describe('suggestCourses', () => {
  it('propose en premier les cours du chapitre de l\'élève', () => {
    expect(ids(ctx({ chapter: 'Fractions' })).slice(0, 2).sort()).toEqual(['fractions-addition', 'fractions-produit'])
    expect(ids(ctx({ chapter: 'Équations' })).slice(0, 3).sort()).toEqual(['equations-premier-degre', 'inequations', 'systemes-equations'])
  })
  it('un nom de chapitre qui ne dit rien n\'appelle aucun cours', () => {
    expect(topicOfChapter('Chapitre 3')).toBe('')
    expect(topicOfChapter('Exercices 2')).toBe('')
    expect(topicOfChapter('Chap. 4 - Fractions')).toBe('Fractions')
    expect(ids(ctx({ chapter: 'Chapitre 3' }))).toEqual([])
  })
  it('tombe sur les mots de l\'exercice quand le chapitre ne dit rien', () => {
    const suggestions = suggestCourses(index, COURSES, ctx({ chapter: 'Chapitre 3', titre: 'Longueur de l\'hypoténuse', texte: 'Un triangle rectangle' }))
    // la trigonométrie parle aussi d'hypoténuse : elle peut précéder Pythagore, mais celui-ci reste proposé
    expect(suggestions.slice(0, 2)).toContainEqual(expect.objectContaining({ course: expect.objectContaining({ id: 'pythagore' }), raison: 'mots-cles' }))
    expect(suggestions.every(s => s.raison === 'mots-cles')).toBe(true)
  })
  it('lit les formules : une fraction appelle les cours de fractions', () => {
    expect(ids(ctx({ chapter: 'Divers', formules: ['\\frac{3}{4}+\\frac{1}{2}'] }))).toContain('fractions-addition')
  })
  it('le chapitre l\'emporte sur les mots, et rien n\'est proposé sans indice', () => {
    expect(ids(ctx({ chapter: 'Fractions', titre: 'Pythagore' }))[0]).toMatch(/^fractions/)
    expect(ids(ctx())).toEqual([])
  })
  it('respecte la limite', () => {
    expect(suggestCourses(index, COURSES, ctx({ chapter: 'Fractions', titre: 'équation triangle puissance' }), 2)).toHaveLength(2)
  })
})
