import { createSearchIndex } from '@suite/shared/search'
import type { ChapterNode } from './types'

export interface FilteredTree {
  chapters: ChapterNode[]
  /** Chapters the search wants open to show a match — a view; the real folded state is untouched. */
  forcedOpen: ReadonlySet<string>
}

/**
 * The tree as a search sees it: a VIEW, never a mutation. A chapter whose NAME matches keeps all
 * its exercises; otherwise only the exercises whose title matches stay, and a chapter with none
 * disappears. The index is rebuilt per call — a student's library is a few hundred titles.
 */
export function filterChapters(tree: ChapterNode[], query: string): FilteredTree {
  const term = query.trim()
  if (term === '') return { chapters: tree, forcedOpen: new Set() }

  const index = createSearchIndex(['titre', 'chapitre'])
  for (const chapter of tree) {
    index.add({ id: `c:${chapter.name}`, chapitre: chapter.name })
    for (const exo of chapter.exercises) index.add({ id: `e:${exo.path}`, titre: exo.titre })
  }
  const hits = new Set(index.search(term, { limit: 200 }).map(hit => hit.id))

  const chapters: ChapterNode[] = []
  const forcedOpen = new Set<string>()
  for (const chapter of tree) {
    if (hits.has(`c:${chapter.name}`)) {
      chapters.push(chapter)
      forcedOpen.add(chapter.name)
      continue
    }
    const exercises = chapter.exercises.filter(exo => hits.has(`e:${exo.path}`))
    if (exercises.length === 0) continue
    chapters.push({ ...chapter, exercises })
    forcedOpen.add(chapter.name)
  }
  return { chapters, forcedOpen }
}
