import { useState } from 'react'
import { useExerciseStore } from './useExerciseStore'

/**
 * Le nom du chapitre (le dossier) de la fiche ouverte, modifiable ici. Le renommage part à la
 * validation (Entrée ou sortie du champ), jamais à chaque frappe : le dossier change de nom sur le
 * disque. Échap rend le nom actuel ; un nom vide ou refusé aussi.
 */
export function ChapterField({ chapter, className }: { chapter: string; className?: string }) {
  const [draft, setDraft] = useState(chapter)
  const commit = () => {
    const name = draft.trim()
    setDraft(chapter)
    if (name === '' || name === chapter) return
    void useExerciseStore.getState().renameChapter(chapter, name)
  }
  return (
    <input
      aria-label="Chapitre"
      placeholder="Chapitre"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') { setDraft(chapter); e.currentTarget.blur() }
      }}
      className={className}
      style={{ width: 'clamp(110px, 18%, 200px)' }}
    />
  )
}
