import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@suite/shared/ui'
import { COURSES, type Course } from './courses'
import { indexCourses, searchCourses } from './courseSearch'
import { useCoursesStore } from './useCoursesStore'

interface CourseSearchDialogProps {
  courses?: readonly Course[]
  /** Proposés tant que rien n'est tapé : les cours qui vont avec l'exercice ouvert. */
  suggested?: readonly Course[]
}

/** La modale de recherche de cours : on tape, on voit, Entrée ouvre le premier. */
export function CourseSearchDialog({ courses = COURSES, suggested = [] }: CourseSearchDialogProps) {
  const open = useCoursesStore(s => s.searchOpen)
  const setOpen = useCoursesStore(s => s.setSearchOpen)
  const select = useCoursesStore(s => s.select)
  const [query, setQuery] = useState('')
  const index = useMemo(() => indexCourses(courses), [courses])

  const typed = query.trim() !== ''
  const results = typed ? searchCourses(index, courses, query) : suggested.length > 0 ? suggested : courses
  const heading = typed ? 'Résultats' : suggested.length > 0 ? 'Pour cet exercice' : 'Tous les cours'

  const pick = (course: Course) => {
    select(course.id)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery('') }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chercher un cours</DialogTitle>
          <DialogDescription>Par titre, chapitre ou mot du cours. Les accents et les petites fautes ne gênent pas.</DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          aria-label="Rechercher un cours"
          placeholder="ex. pythagore, fractions, équation…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && results[0] !== undefined) pick(results[0])
          }}
          className="w-full rounded border bg-background px-2 py-1.5 text-sm"
        />
        <div role="region" aria-label={heading} style={{ maxHeight: 280, overflowY: 'auto' }}>
          <p style={{ fontSize: 12, fontWeight: 600, margin: '4px 0' }}>{heading}</p>
          {results.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Aucun cours ne correspond à « {query.trim()} ».</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {results.map(course => (
                <li key={course.id}>
                  <button type="button" onClick={() => pick(course)} className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                    {course.titre}
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted-foreground)' }}>{course.chapitre}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
