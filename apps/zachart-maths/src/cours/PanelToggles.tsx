import { Calculator, BookOpen, NotebookPen } from 'lucide-react'
import { CommandButton } from '@suite/shared/commands'
import { useCoursesStore } from './useCoursesStore'

/**
 * Les trois pastilles de la sidebar droite — notes, calculatrice, cours — réunies en un groupe pour montrer
 * qu'elles vont ensemble : allumée (fond et bordure bleus), la pastille dit ce que le panneau affiche. La même
 * rangée sert dans la barre du haut, le pied du panneau déplié (`horizontal`) et le rail replié (`vertical`).
 * Activer une pastille déplie le panneau ; l'éteindre ne le replie pas.
 */
export function PanelToggles({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  const notesVisible = useCoursesStore(s => s.notesVisible)
  const bottomTab = useCoursesStore(s => s.bottomTab)
  const coursesVisible = useCoursesStore(s => s.coursesVisible)
  const toggle = (command: string, icon: typeof Calculator, on: boolean) => (
    <CommandButton command={command} icon={icon} variant="ghost" size="icon-sm" pressed={on} className={on ? 'toggle-on' : undefined} />
  )
  return (
    <div role="group" aria-label="Panneau de droite" className="toggle-group" data-orientation={orientation}>
      {toggle('notes.toggle', NotebookPen, notesVisible && bottomTab === 'notes')}
      {toggle('calculatrice.toggle', Calculator, notesVisible && bottomTab === 'calculatrice')}
      {toggle('cours.toggle', BookOpen, coursesVisible)}
    </div>
  )
}
