import { createSearchIndex, type SearchIndex } from '@suite/shared/search'
import type { Course } from './courses'

const FIELDS = ['titre', 'chapitre', 'motsCles', 'texte']

/** Le Markdown sans sa mise en forme : ce que l'élève lirait, pas ce qu'il faut pour l'écrire. */
function plainText(markdown: string): string {
  return markdown.replace(/\$\$?[^$]*\$\$?/g, ' ').replace(/[#*`>|_-]/g, ' ')
}

export function indexCourses(courses: readonly Course[]): SearchIndex {
  const index = createSearchIndex(FIELDS)
  for (const c of courses) index.add({ id: c.id, titre: c.titre, chapitre: c.chapitre, motsCles: c.motsCles.join(' '), texte: plainText(c.corps) })
  return index
}

const byId = (courses: readonly Course[]) => new Map(courses.map(c => [c.id, c]))

/** Les cours qui répondent à `query`, du plus pertinent au moins pertinent. */
export function searchCourses(index: SearchIndex, courses: readonly Course[], query: string): Course[] {
  const lookup = byId(courses)
  return index
    .search(query, { limit: 10, boost: { titre: 3, motsCles: 2, chapitre: 2 } })
    .flatMap(hit => lookup.get(hit.id) ?? [])
}
