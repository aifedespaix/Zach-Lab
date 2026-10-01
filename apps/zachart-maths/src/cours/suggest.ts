import type { SearchIndex } from '@suite/shared/search'
import type { Course } from './courses'

/** Ce que l'on sait de l'exercice ouvert, de quoi lui trouver des cours. */
export interface ExerciseContext {
  /** Le dossier où il se trouve : le nom que l'élève a donné à son chapitre. */
  chapter: string
  titre: string
  /** Texte libre : blocs de texte, actions des équations, réponse. */
  texte: string
  /** Formules LaTeX : calculs, étapes d'équation. */
  formules: string[]
}

export interface Suggestion {
  course: Course
  /** Pourquoi il est proposé : son chapitre colle, ou ses mots-clés. */
  raison: 'chapitre' | 'mots-cles'
}

/** Des mots que le texte ne dit pas, mais que les symboles d'une formule disent. */
const LATEX_HINTS: readonly [RegExp, string][] = [
  [/\\frac|\\dfrac/, 'fraction'],
  [/\\sqrt/, 'racine carrée'],
  [/\^/, 'puissance'],
  [/\\%/, 'pourcentage'],
  [/\\pi/, 'cercle'],
  [/[a-z]\s*[+\-]\s*\d+\s*=|=\s*[a-z]|[a-z]\s*=/, 'équation'],
]

const STOP_WORDS = new Set(['dans', 'avec', 'pour', 'cette', 'dont', 'sont', 'tout', 'tous', 'plus', 'moins', 'donc', 'ainsi', 'alors', 'mais', 'comme', 'entre'])
const MAX_WORDS = 30

/** Ce que l'élève met dans un nom de chapitre sans dire de quoi il parle : « Chapitre 3 », « Exercices ». */
const GENERIC_CHAPTER_WORDS = new Set(['chapitre', 'chap', 'partie', 'theme', 'thème', 'exercice', 'exercices', 'exo', 'exos', 'devoir', 'devoirs', 'cours', 'revision', 'révision', 'revisions', 'révisions', 'divers', 'autre', 'autres', 'nouveau'])

/** Le nom du chapitre sans numéros ni mots creux ; vide s'il ne reste rien qui dise un sujet. */
export function topicOfChapter(chapter: string): string {
  return chapter
    .split(/[^\p{L}]+/u)
    .filter(w => w.length >= 3 && !GENERIC_CHAPTER_WORDS.has(w.toLowerCase()))
    .join(' ')
}

/** Une correspondance trop faible à côté de la meilleure n'est pas une suggestion, c'est du bruit de la tolérance aux fautes. */
const MIN_RELATIVE_SCORE = 0.5

/** Les mots utiles d'un texte, sans doublon, bornés : la requête ne grossit pas avec l'énoncé. */
export function keywordsOf(context: ExerciseContext): string {
  const words = new Set<string>()
  const text = `${context.titre} ${context.texte}`.toLowerCase()
  for (const word of text.split(/[^\p{L}]+/u)) {
    if (word.length >= 4 && !STOP_WORDS.has(word)) words.add(word)
  }
  const formulas = context.formules.join(' ')
  for (const [pattern, hint] of LATEX_HINTS) if (pattern.test(formulas)) words.add(hint)
  return [...words].slice(0, MAX_WORDS).join(' ')
}

/**
 * Propose des cours pour l'exercice ouvert : d'abord ceux dont le chapitre ou le titre
 * ressemble au nom du chapitre de l'élève, puis ceux que les mots de l'exercice font ressortir.
 * Les deux listes se mélangent par note relative (chacune ramenée à son meilleur résultat),
 * et le chapitre compte double : l'élève a classé lui-même l'exercice, c'est son meilleur indice.
 */
export function suggestCourses(index: SearchIndex, courses: readonly Course[], context: ExerciseContext, limit = 4): Suggestion[] {
  const lookup = new Map(courses.map(c => [c.id, c]))
  const scores = new Map<string, { score: number; raison: Suggestion['raison'] }>()

  const add = (query: string, weight: number, raison: Suggestion['raison'], fields?: string[]) => {
    if (query.trim() === '') return
    const hits = index.search(query, { limit: 10, fields, boost: { titre: 3, motsCles: 2, chapitre: 2 } })
    const best = hits[0]?.score ?? 0
    if (best <= 0) return
    for (const hit of hits) {
      if (hit.score < best * MIN_RELATIVE_SCORE) continue
      const score = (hit.score / best) * weight
      const known = scores.get(hit.id)
      if (known === undefined) scores.set(hit.id, { score, raison })
      else known.score += score
    }
  }

  add(topicOfChapter(context.chapter), 2, 'chapitre', ['titre', 'chapitre', 'motsCles'])
  add(keywordsOf(context), 1, 'mots-cles')

  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .flatMap(([id, { raison }]) => {
      const course = lookup.get(id)
      return course === undefined ? [] : [{ course, raison }]
    })
    .slice(0, limit)
}
