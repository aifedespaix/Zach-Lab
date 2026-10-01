import { useEffect, useRef, useState } from 'react'
import { BlockStack } from './BlockStack'
import { addBlock, parseBlocks, type BlockType } from './blocks'
import { insertAtCursor, isTextField, type TextField } from './insertAtCursor'
import { isMathField, type MathfieldElement } from '../math/MathField'
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
  const { exercise, status } = useOpenExercise()
  const edit = useOpenExercise(s => s.edit)
  const selected = useExerciseStore(s => s.selected)
  const lastField = useRef<TextField | MathfieldElement | null>(null)
  const [target, setTarget] = useState<InsertTarget>('none')

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
  const addBlockOfType = (type: BlockType) =>
    edit({ blocs: addBlock(parseBlocks(useOpenExercise.getState().exercise?.blocs ?? []), type) })

  // Un autre exercice, d'autres champs : l'ancien champ ne doit plus recevoir de signes.
  useEffect(() => {
    lastField.current = null
    setTarget('none')
  }, [selected])

  // Ne rien perdre si la fenêtre se ferme avant la fin du délai d'autosauvegarde.
  useEffect(() => {
    const flush = () => void useOpenExercise.getState().flush()
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])

  if (selected === null) {
    return <p style={{ padding: 16, color: 'var(--muted-foreground)', fontSize: 14 }}>Choisis un exercice dans la liste de gauche.</p>
  }
  if (status === 'loading') return <p style={{ padding: 16, fontSize: 14 }}>Ouverture…</p>
  if (status === 'unreadable' || exercise === null) {
    return <p role="alert" style={{ padding: 16, fontSize: 14 }}>Ce fichier d'exercice est illisible.</p>
  }

  return (
    <section aria-label="Exercice" onFocus={rememberField} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, borderBottom: '1px solid var(--border)' }}>
        <input
          aria-label="Titre de l'exercice"
          value={exercise.titre}
          onChange={e => edit({ titre: e.target.value })}
          className={`${field} flex-1 text-base font-semibold`}
          style={{ minWidth: 200 }}
        />
        <input
          aria-label="Numéro de question (facultatif)"
          placeholder="Question"
          value={exercise.question}
          onChange={e => edit({ question: e.target.value })}
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
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Toolbar target={target} onSymbol={insertSymbol} onAddBlock={addBlockOfType} />
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 16 }}>
          <BlockStack value={exercise.blocs} onChange={blocs => edit({ blocs })} showAddButtons={false} />
        </div>
      </div>

      <footer
        aria-label="Zone de réponse"
        style={{ padding: 12, background: 'color-mix(in oklab, #3b82f6 18%, var(--background))', borderTop: '2px solid #3b82f6' }}
      >
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }} htmlFor="reponse-finale">
          Réponse finale
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
    </section>
  )
}
