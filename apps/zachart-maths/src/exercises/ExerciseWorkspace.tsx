import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog } from '@suite/shared/ui'
import { AnimatedLogo } from '../AnimatedLogo'
import { BlockStack } from './BlockStack'
import { insertAtCursor, isTextField, type TextField } from './insertAtCursor'
import { isMathField, type MathfieldElement } from '../math/MathField'
import { isBlank } from './sheet'
import { Toolbar, type InsertTarget } from './Toolbar'
import type { SymbolEntry } from './toolbarCatalog'
import { useExerciseStore } from './useExerciseStore'
import { useOpenExercise } from './useOpenExercise'

const STATUS_TEXT = {
  saved: 'Enregistré',
  dirty: 'Modifications en attente…',
  saving: 'Enregistrement…',
  failed: "L'enregistrement a échoué : tes dernières modifications ne sont pas sur le disque.",
} as const

const field = 'rounded border bg-background px-2 py-1 text-sm'

/** La zone centrale : l'exercice ouvert, de son titre jusqu'à la réponse finale. */
export function ExerciseWorkspace() {
  const { exercise, sheet, status } = useOpenExercise()
  const edit = useOpenExercise(s => s.edit)
  const editTitle = useOpenExercise(s => s.editTitle)
  const selected = useExerciseStore(s => s.selected)
  const lastField = useRef<TextField | MathfieldElement | null>(null)
  const [target, setTarget] = useState<InsertTarget>('none')
  const currentId = useOpenExercise(s => s.currentId)
  const [confirming, setConfirming] = useState(false)

  // Le dernier champ où l'élève a écrit reçoit les signes de la barre, même si le focus est
  // passé sur un bouton (clavier) depuis.
  const rememberField = (e: React.FocusEvent) => {
    // MathLive vit dans un shadow DOM : l'évènement y est ramené à l'élément `math-field`.
    if (isMathField(e.target)) {
      lastField.current = e.target
      setTarget('math')
    } else if (isTextField(e.target)) {
      lastField.current = e.target
      setTarget(e.target.dataset.mathRaw !== undefined ? 'raw' : 'text')
    }
  }
  const insertSymbol = (symbol: SymbolEntry) => {
    const field = lastField.current
    if (!field?.isConnected) return
    if (isMathField(field)) {
      if (typeof field.insert === 'function') field.insert(symbol.latex, { focus: true })
      else field.value += symbol.latex.replace(/#[0?]/g, '')
      // `insert` ne déclenche pas toujours `input` : le champ le dit lui-même, pour que
      // l'état de l'étape suive.
      field.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
    insertAtCursor(field, field.dataset.mathRaw !== undefined ? (symbol.plain ?? symbol.latex.replace(/#[0?]/g, '')) : symbol.glyph)
    field.focus()
  }
  // Un autre exercice, d'autres champs : l'ancien champ ne doit plus recevoir de signes.
  useEffect(() => {
    lastField.current = null
    setTarget('none')
  }, [selected, currentId])

  // Ne rien perdre si la fenêtre se ferme avant la fin du délai d'autosauvegarde.
  useEffect(() => {
    const flush = () => void useOpenExercise.getState().flush()
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  if (selected === null) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <AnimatedLogo mode="draw-pulse" size={140} />
        <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Choisis un exercice dans la liste de gauche.</p>
      </div>
    )
  }
  if (status === 'loading') return <p style={{ padding: 16, fontSize: 14 }}>Ouverture…</p>
  if (status === 'unreadable' || exercise === null || sheet === null) {
    return <p role="alert" style={{ padding: 16, fontSize: 14 }}>Ce fichier d'exercice est illisible.</p>
  }

  const position = sheet.exercices.findIndex(e => e.id === exercise.id) + 1
  const count = sheet.exercices.length
  const { step, addExercise, removeCurrent } = useOpenExercise.getState()
  // Au bord, la flèche crée un exercice : pas par-dessus un exercice encore vierge.
  const blank = isBlank(exercise)

  return (
    <section aria-label="Exercice" onFocus={rememberField} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input
            aria-label="Titre de l'exercice"
            value={sheet.titre}
            onChange={e => editTitle(e.target.value)}
            className={`${field} flex-1 text-base font-semibold`}
            style={{ minWidth: 200 }}
          />
          <input
            aria-label="Numéro de l'exercice (facultatif)"
            placeholder={String(position)}
            value={exercise.numero}
            onChange={e => edit({ numero: e.target.value })}
            className={field}
            style={{ width: 110 }}
          />
          <input
            aria-label="Page (facultatif)"
            placeholder="Page"
            value={exercise.page}
            onChange={e => edit({ page: e.target.value })}
            className={field}
            style={{ width: 80 }}
          />
          <div role="group" aria-label="Navigation dans la fiche" style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
            <Button
              variant="ghost" size="icon-sm" aria-label="Exercice précédent"
              title={position === 1 && blank ? "Écris dans cet exercice avant d'en ajouter un avant" : 'Exercice précédent'}
              disabled={position === 1 && blank}
              onClick={() => step(-1)}
            ><ChevronLeft /></Button>
            <span aria-live="polite" style={{ fontSize: 13, minWidth: 44, textAlign: 'center' }}>{position} / {count}</span>
            <Button
              variant="ghost" size="icon-sm" aria-label="Exercice suivant"
              title={position === count && blank ? "Écris dans cet exercice avant d'en ajouter un après" : 'Exercice suivant'}
              disabled={position === count && blank}
              onClick={() => step(1)}
            ><ChevronRight /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Nouvel exercice" title="Nouvel exercice" onClick={addExercise}><Plus /></Button>
            <Button
              variant="ghost" size="icon-sm" aria-label="Supprimer l'exercice" title="Supprimer l'exercice"
              disabled={count <= 1}
              onClick={() => setConfirming(true)}
            ><Trash2 /></Button>
          </div>
        </div>
        <textarea
          aria-label="Énoncé de l'exercice"
          placeholder="Quelle est la question ?"
          value={exercise.enonce}
          rows={Math.max(2, exercise.enonce.split('\n').length)}
          onChange={e => edit({ enonce: e.target.value })}
          className={`${field} w-full`}
        />
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Toolbar target={target} onSymbol={insertSymbol} />
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 16 }}>
          <BlockStack value={exercise.blocs} onChange={blocs => edit({ blocs })} />
        </div>
      </div>

      <footer
        aria-label="Zone de réponse"
        style={{ padding: 12, background: 'color-mix(in oklab, #3b82f6 18%, var(--background))', borderTop: '2px solid #3b82f6' }}
      >
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }} htmlFor="reponse-finale">
          Réponse
        </label>
        <textarea
          id="reponse-finale"
          value={exercise.reponse}
          onChange={e => edit({ reponse: e.target.value })}
          rows={2}
          className={`${field} w-full`}
        />
        <p
          role={status === 'failed' ? 'alert' : 'status'}
          style={{ margin: '4px 0 0', fontSize: 11, color: status === 'failed' ? 'var(--destructive)' : 'var(--muted-foreground)' }}
        >
          {status in STATUS_TEXT ? STATUS_TEXT[status as keyof typeof STATUS_TEXT] : ''}
        </p>
      </footer>
      <ConfirmDialog
        open={confirming}
        title="Supprimer cet exercice ?"
        description={`L'exercice ${exercise.numero.trim() === '' ? position : exercise.numero} sera effacé de la fiche « ${sheet.titre} ». Cette action est définitive.`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); removeCurrent() }}
      />
    </section>
  )
}
