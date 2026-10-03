import { useDeferredValue, useMemo, type ReactNode } from 'react'
import { Copy, ExternalLink, Eye, EyeOff, NotebookPen, PanelRightClose, Search } from 'lucide-react'
import {
  Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@suite/shared/ui'
import { CommandButton, runCommand, useCommand } from '@suite/shared/commands'
import { FieldContextMenu } from '../exercises/FieldContextMenu'
import { useOpenExercise } from '../exercises/useOpenExercise'
import { CourseSearchDialog } from './CourseSearchDialog'
import { COURSES, type Course } from './courses'
import { indexCourses } from './courseSearch'
import { contextOf } from './exerciseContext'
import { Markdown } from './markdown'
import { suggestCourses } from './suggest'
import { useCoursesStore } from './useCoursesStore'

const RAISON = { chapitre: 'même chapitre', 'mots-cles': 'mots-clés' } as const

const copyTitle = (titre: string) => void navigator.clipboard?.writeText(titre).catch(() => {})

/** Le clic droit d'un cours : l'ouvrir, copier son titre. Il arrête l'évènement : le menu du vide ne s'ouvre pas. */
function CourseMenu({ course, onOpen, children }: { course: Course; onOpen: () => void; children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={e => e.stopPropagation()}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onOpen}><ExternalLink size={14} />Ouvrir</ContextMenuItem>
        <ContextMenuItem onSelect={() => copyTitle(course.titre)}><Copy size={14} />Copier le titre</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** La partie haute de la sidebar droite : les cours, ceux qu'on suggère, et leur lecture. */
function CoursesSection({ courses }: { courses: readonly Course[] }) {
  const selectedId = useCoursesStore(s => s.selectedId)
  const notesVisible = useCoursesStore(s => s.notesVisible)
  const { select, setSearchOpen, setNotesVisible } = useCoursesStore.getState()
  const path = useOpenExercise(s => s.path)
  const sheet = useOpenExercise(s => s.sheet)
  const exercise = useOpenExercise(s => s.exercise)

  const index = useMemo(() => indexCourses(courses), [courses])
  // L'exercice change à chaque frappe ; les suggestions peuvent suivre avec un temps de retard.
  const context = useDeferredValue(
    useMemo(() => (path !== null && sheet !== null && exercise !== null ? contextOf(path, sheet.titre, exercise) : null), [path, sheet, exercise]),
  )
  const suggestions = useMemo(() => (context === null ? [] : suggestCourses(index, courses, context)), [index, courses, context])
  const selected = courses.find(c => c.id === selectedId) ?? null

  return (
    <section aria-label="Cours" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <strong style={{ fontSize: 13, flex: 1 }}>Cours</strong>
        <Button variant="outline" size="xs" onClick={() => setSearchOpen(true)}><Search />Chercher un cours</Button>
        <Button variant="ghost" size="icon-sm" aria-label="Notes" aria-pressed={notesVisible} onClick={() => setNotesVisible(!notesVisible)}>
          <NotebookPen />
        </Button>
        <CommandButton command="view.toggleCourses" icon={PanelRightClose} label="Replier le panneau des cours" variant="ghost" size="icon-sm" />
      </header>

      {suggestions.length > 0 && (
        <div role="group" aria-label="Cours suggérés" style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>Suggérés pour cet exercice</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {suggestions.map(({ course, raison }) => (
              <li key={course.id}>
                <CourseMenu course={course} onOpen={() => select(course.id)}>
                  <button
                    type="button"
                    onClick={() => select(course.id)}
                    aria-current={selectedId === course.id ? 'true' : undefined}
                    className="w-full rounded px-1.5 py-1 text-left text-[13px] hover:bg-accent aria-[current=true]:bg-accent"
                  >
                    {course.titre} <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>· {RAISON[raison]}</span>
                  </button>
                </CourseMenu>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
        {selected === null ? (
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            Choisis un cours suggéré, ou cherche-en un avec le bouton ci-dessus.
          </p>
        ) : (
          <CourseMenu course={selected} onOpen={() => select(selected.id)}>
            <article aria-label={selected.titre}>
              <Markdown source={selected.corps} />
            </article>
          </CourseMenu>
        )}
      </div>
      <CourseSearchDialog courses={courses} suggested={suggestions.map(s => s.course)} />
    </section>
  )
}

/** La partie basse : des notes libres, rangées avec l'exercice ouvert. */
function NotesSection() {
  const exercise = useOpenExercise(s => s.exercise)
  const edit = useOpenExercise(s => s.edit)
  const setNotesVisible = useCoursesStore(s => s.setNotesVisible)
  return (
    <section aria-label="Notes" style={{ display: 'flex', flexDirection: 'column', flex: '0 0 38%', minHeight: 120, borderTop: '1px solid var(--border)' }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: '6px 12px' }}>
        <strong style={{ fontSize: 13, flex: 1 }}>Notes</strong>
        <Button variant="ghost" size="icon-sm" aria-label="Masquer les notes" onClick={() => setNotesVisible(false)}><EyeOff /></Button>
      </header>
      <FieldContextMenu
        kind="text"
        extra={<ContextMenuItem onSelect={() => setNotesVisible(false)}><EyeOff size={14} />Masquer les notes</ContextMenuItem>}
      >
        <textarea
          aria-label="Mes notes"
          placeholder={exercise === null ? "Ouvre un exercice pour prendre des notes à côté." : 'Écris ce que tu veux retenir…'}
          disabled={exercise === null}
          value={exercise?.notes ?? ''}
          onChange={e => edit({ notes: e.target.value })}
          className="m-2 mt-0 flex-1 resize-none rounded border bg-background px-2 py-1 text-sm"
        />
      </FieldContextMenu>
    </section>
  )
}

/** Le contenu de la sidebar droite : les cours en haut, les notes en bas — ou les cours seuls si elles sont masquées. */
export function CoursePanel({ courses = COURSES }: { courses?: readonly Course[] }) {
  const notesVisible = useCoursesStore(s => s.notesVisible)
  useCommand('cours.search', () => useCoursesStore.getState().setSearchOpen(true))
  useCommand('notes.toggle', () => useCoursesStore.getState().setNotesVisible(!useCoursesStore.getState().notesVisible))
  const { setSearchOpen, setNotesVisible } = useCoursesStore.getState()
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div data-testid="cours-vide" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>
          <CoursesSection courses={courses} />
          {notesVisible && <NotesSection />}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => setSearchOpen(true)}><Search size={14} />Chercher un cours</ContextMenuItem>
        <ContextMenuItem onSelect={() => setNotesVisible(!notesVisible)}>
          {notesVisible ? <EyeOff size={14} /> : <Eye size={14} />}
          {notesVisible ? 'Masquer les notes' : 'Afficher les notes'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => void runCommand('view.toggleCourses')}><PanelRightClose size={14} />Ranger le panneau</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
