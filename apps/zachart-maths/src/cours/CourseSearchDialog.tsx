import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@suite/shared/ui'
import { COURSES, type Course } from './courses'
import { indexCourses, searchCourses } from './courseSearch'
import { useCoursesStore } from './useCoursesStore'

interface CourseSearchDialogProps {
  courses?: readonly Course[]
  /** Proposés dans un onglet « Suggérés » : les cours qui vont avec l'exercice ouvert. */
  suggested?: readonly Course[]
}

/** Un onglet de la modale : `label` sur l'onglet, `titre` au-dessus de la liste. */
interface Category {
  id: string
  label: string
  titre: string
  courses: readonly Course[]
}

const RECHERCHE = 'recherche'
const SUGGERES = 'suggeres'
const TOUS = 'tous'

const labelOf = (chapitre: string) => (chapitre === '' ? 'Autres' : chapitre)

/** Les cours rangés par chapitre, dans l'ordre d'arrivée (déjà triés par `loadCourses`). */
function chaptersOf(courses: readonly Course[]): { chapitre: string; courses: Course[] }[] {
  const groups = new Map<string, Course[]>()
  for (const course of courses) {
    const group = groups.get(course.chapitre)
    if (group === undefined) groups.set(course.chapitre, [course])
    else group.push(course)
  }
  return [...groups].map(([chapitre, list]) => ({ chapitre, courses: list }))
}

interface CourseListProps {
  courses: readonly Course[]
  /** Affiche le chapitre à côté du titre (utile quand la liste mélange les chapitres). */
  showChapitre?: boolean
  onPick(course: Course): void
}

function CourseList({ courses, showChapitre = false, onPick }: CourseListProps) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2 }}>
      {courses.map(course => (
        <li key={course.id}>
          <button type="button" onClick={() => onPick(course)} className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
            {course.titre}
            {showChapitre && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)' }}>{labelOf(course.chapitre)}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * La modale de recherche de cours. Des onglets par catégorie (Suggérés, Tous, un par chapitre) pour parcourir
 * la liste sans mots-clés ; dès qu'on tape, un onglet « Recherche » s'ouvre avec les résultats. Entrée ouvre le premier.
 */
export function CourseSearchDialog({ courses = COURSES, suggested = [] }: CourseSearchDialogProps) {
  const open = useCoursesStore(s => s.searchOpen)
  const setOpen = useCoursesStore(s => s.setSearchOpen)
  const select = useCoursesStore(s => s.select)
  const [query, setQuery] = useState('')
  /** L'onglet choisi ; `null` = celui par défaut, ou le précédent s'il a disparu (la recherche vidée). */
  const [tab, setTab] = useState<string | null>(null)
  const tabsId = useId()
  const index = useMemo(() => indexCourses(courses), [courses])

  const typed = query.trim() !== ''
  const hits = useMemo(() => (typed ? searchCourses(index, courses, query) : []), [typed, index, courses, query])

  const categories = useMemo<Category[]>(() => {
    const list: Category[] = []
    if (typed) list.push({ id: RECHERCHE, label: 'Recherche', titre: 'Résultats', courses: hits })
    if (suggested.length > 0) list.push({ id: SUGGERES, label: 'Suggérés', titre: 'Pour cet exercice', courses: suggested })
    list.push({ id: TOUS, label: 'Tous', titre: 'Tous les cours', courses })
    for (const { chapitre, courses: inChapter } of chaptersOf(courses)) {
      list.push({ id: `chapitre:${chapitre}`, label: labelOf(chapitre), titre: labelOf(chapitre), courses: inChapter })
    }
    return list
  }, [typed, hits, suggested, courses])

  const defaultId = typed ? RECHERCHE : suggested.length > 0 ? SUGGERES : TOUS
  const resolvedId = categories.some(c => c.id === tab) ? tab : defaultId
  const activeIndex = Math.max(0, categories.findIndex(c => c.id === resolvedId))
  const active = categories[activeIndex]

  const pick = (course: Course) => {
    select(course.id)
    setOpen(false)
  }

  // Taper en partant de rien ouvre l'onglet Recherche ; le vider le referme et revient à l'onglet par défaut.
  const changeQuery = (value: string) => {
    if (value.trim() !== '' && !typed) setTab(RECHERCHE)
    setQuery(value)
  }

  const move = (e: KeyboardEvent, from: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    e.preventDefault()
    const next = (from + step + categories.length) % categories.length
    setTab(categories[next].id)
    document.getElementById(`${tabsId}-onglet-${next}`)?.focus()
  }

  return (
    <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) { setQuery(''); setTab(null) } }}>
      <DialogContent className="h-[min(85vh,40rem)] grid-rows-[auto_auto_auto_minmax(0,1fr)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Chercher un cours</DialogTitle>
          <DialogDescription>Parcours les catégories, ou tape un titre, un chapitre ou un mot du cours. Les accents et les petites fautes ne gênent pas.</DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          aria-label="Rechercher un cours"
          placeholder="ex. pythagore, fractions, équation…"
          value={query}
          onChange={e => changeQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && hits[0] !== undefined) pick(hits[0])
          }}
          className="w-full rounded border bg-background px-2 py-1.5 text-sm"
        />
        <div role="tablist" aria-label="Catégories de cours" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {categories.map((c, i) => (
            <button
              key={c.id}
              id={`${tabsId}-onglet-${i}`}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-controls={`${tabsId}-panneau`}
              tabIndex={i === activeIndex ? 0 : -1}
              onClick={() => setTab(c.id)}
              onKeyDown={e => move(e, i)}
              className="rounded-md px-2 py-1 text-[13px] font-medium text-muted-foreground hover:bg-muted aria-selected:bg-secondary aria-selected:text-secondary-foreground"
            >
              {c.label} <span style={{ fontSize: 11, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{c.courses.length}</span>
            </button>
          ))}
        </div>
        <div
          id={`${tabsId}-panneau`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-onglet-${activeIndex}`}
          style={{ minHeight: 0, overflowY: 'auto' }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, margin: '4px 0 8px' }}>{active.titre}</p>
          {active.courses.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
              {active.id === RECHERCHE ? `Aucun cours ne correspond à « ${query.trim()} ».` : 'Aucun cours dans cette catégorie.'}
            </p>
          ) : active.id === TOUS ? (
            chaptersOf(courses).map(({ chapitre, courses: inChapter }) => (
              <section key={chapitre} aria-label={labelOf(chapitre)} style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 12, margin: '0 0 4px', color: 'var(--muted-foreground)' }}>{labelOf(chapitre)}</h3>
                <CourseList courses={inChapter} onPick={pick} />
              </section>
            ))
          ) : (
            <CourseList courses={active.courses} showChapitre={!active.id.startsWith('chapitre:')} onPick={pick} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
