import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@suite/shared/ui'
import { COURSES, type Course } from '../cours/courses'
import { indexCourses } from '../cours/courseSearch'
import { contextOf } from '../cours/exerciseContext'
import { suggestCourses } from '../cours/suggest'
import { useCoursesStore } from '../cours/useCoursesStore'
import { loadReviewItems, type ReviewItem } from './library'
import { useCorrectionView } from './useCorrectionView'
import { useExerciseStore } from './useExerciseStore'
import { goToExercise } from './useOpenExercise'

const label = (item: ReviewItem) => (item.exercise.numero.trim() === '' ? String(item.position) : item.exercise.numero)

/** Le mode révision : les exercices corrigés, par chapitre, ceux à revoir avec les cours qui vont avec. */
export function ReviewDialog({ courses = COURSES }: { courses?: readonly Course[] }) {
  const open = useCorrectionView(s => s.reviewOpen)
  const setOpen = useCorrectionView(s => s.setReviewOpen)
  const fs = useExerciseStore(s => s.fs)
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [chapter, setChapter] = useState('')
  const [onlyReview, setOnlyReview] = useState(false)
  const index = useMemo(() => indexCourses(courses), [courses])

  useEffect(() => {
    if (!open || fs === null) return
    let current = true
    setItems(null)
    void loadReviewItems(fs).then(loaded => { if (current) setItems(loaded) }).catch(() => { if (current) setItems([]) })
    return () => { current = false }
  }, [open, fs])

  const chapters = useMemo(() => [...new Set((items ?? []).map(i => i.chapter))], [items])
  const shown = (items ?? []).filter(i => (chapter === '' || i.chapter === chapter) && (!onlyReview || i.exercise.rate === true))

  const openExercise = (item: ReviewItem) => {
    setOpen(false)
    goToExercise(item.path, item.exercise.id)
  }
  const openCourse = (id: string) => {
    setOpen(false)
    useCoursesStore.getState().select(id)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mode révision</DialogTitle>
          <DialogDescription>Les exercices corrigés, pour les relire avant un contrôle. Ceux marqués « à revoir » proposent des cours.</DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          <select aria-label="Chapitre" value={chapter} onChange={e => setChapter(e.target.value)} className="rounded border bg-background px-2 py-1 text-sm">
            <option value="">Tous les chapitres</option>
            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={onlyReview} onChange={e => setOnlyReview(e.target.checked)} />
            À revoir seulement
          </label>
        </div>
        <div role="region" aria-label="Exercices corrigés" style={{ maxHeight: 360, overflowY: 'auto' }}>
          {items === null ? (
            <p style={{ fontSize: 13 }}>Chargement…</p>
          ) : shown.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Aucun exercice corrigé{onlyReview ? ' à revoir' : ''} pour l'instant.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {shown.map(item => {
                const suggestions = item.exercise.rate === true
                  ? suggestCourses(index, courses, contextOf(item.path, item.sheetTitle, item.exercise), 2)
                  : []
                return (
                  <li key={`${item.path}#${item.exercise.id}`} style={{ borderBottom: '1px solid var(--border)', padding: '2px 0' }}>
                    <button type="button" onClick={() => openExercise(item)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                      <strong style={{ minWidth: 22 }}>{label(item)}</strong>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.exercise.enonce.split('\n')[0].trim() || item.sheetTitle}
                      </span>
                      {item.exercise.rate === true && <span style={{ fontSize: 11, fontWeight: 600, color: '#f97316' }}>À revoir</span>}
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{item.chapter} · {item.sheetTitle}</span>
                    </button>
                    {suggestions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 8px 4px 32px', fontSize: 12 }}>
                        <span style={{ color: 'var(--muted-foreground)' }}>Cours :</span>
                        {suggestions.map(({ course }) => (
                          <button key={course.id} type="button" onClick={() => openCourse(course.id)} style={{ textDecoration: 'underline' }}>{course.titre}</button>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
