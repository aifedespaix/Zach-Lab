import { useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react'
import { renderMathToHtml } from '../math'
import { MathFieldEditor, type MathFieldHandle } from './MathFieldEditor'
import { rawFieldKeyDown, type BlockEdgeHandle, type BlockPlace, type ExitDirection, type ExitVia } from './fieldIntents'
import { insertLineAfter, isLineEmpty, removeLineAt, type SubLine } from './lines'

export interface LinesBlockFieldProps {
  lines: readonly SubLine[]
  onChange: (lines: SubLine[]) => void
  /** Le nom du groupe (« Calcul ») ; chaque ligne est « Ligne n du calcul ». */
  ariaLabel: string
  /** Ctrl/Cmd+Entrée (`outside`) ou Ctrl/Cmd+Maj+Entrée (`inside`) : un bloc après celui-ci. */
  onEnterBlock: (place: BlockPlace) => void
  /** Retour arrière dans l'unique ligne vide d'un bloc vide : le bloc demande à disparaître vers le précédent. */
  onDeleteEmpty: () => void
  /** Suppr en fin de l'unique ligne vide d'un bloc vide : il disparaît vers le suivant. */
  onDeleteForward: () => void
  /** Une flèche qui sort du bloc par le haut/gauche (`before`) ou le bas/droite (`after`). */
  onExitBlock: (side: 'before' | 'after') => void
  /** Le champ vivant de la ligne focalisée, pour la barre de symboles. */
  onFieldChange: (handle: MathFieldHandle | null) => void
  ref?: React.Ref<BlockEdgeHandle>
}

const ROW: CSSProperties = {
  boxSizing: 'border-box',
  padding: 'var(--eq-term-pad, 8px 14px)',
  borderRadius: 10,
  border: '1.5px solid var(--border)',
  background: 'transparent',
}

const RAW: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  font: 'inherit',
  fontSize: 14,
  padding: '4px 6px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'inherit',
}

/**
 * Un bloc de lignes (le Calcul) : chaque ligne est un SOUS-BLOC, un champ de formule. Même contrat
 * clavier que l'équation (voir `EquationStepsField`) : Entrée ajoute un sous-bloc, Ctrl/Cmd+Entrée
 * un bloc, les flèches passent d'un sous-bloc à l'autre puis sortent du bloc, Retour arrière/Suppr
 * ne retirent qu'une ligne vide — ou, sur l'unique ligne vide, le bloc lui-même.
 */
export function LinesBlockField({ lines, onChange, ariaLabel, onEnterBlock, onDeleteEmpty, onDeleteForward, onExitBlock, onFieldChange, ref }: LinesBlockFieldProps) {
  const handles = useRef(new Map<string, MathFieldHandle | null>())
  const pending = useRef<{ id: string; at: 'start' | 'end' } | null>(null)
  const linesRef = useRef(lines)
  linesRef.current = lines

  // Le focus est posé APRÈS le rendu qui a ajouté ou retiré une ligne : c'est là que son handle existe.
  useEffect(() => {
    const target = pending.current
    if (target === null) return
    pending.current = null
    const handle = handles.current.get(target.id)
    if (target.at === 'end') handle?.focusEnd()
    else handle?.focusStart()
  })

  useImperativeHandle(
    ref,
    () => ({
      focusEdge(at) {
        const list = linesRef.current
        const target = at === 'start' ? list[0] : list[list.length - 1]
        const handle = target === undefined ? null : handles.current.get(target.id) ?? null
        if (at === 'start') handle?.focusStart()
        else handle?.focusEnd()
      },
    }),
    []
  )

  function focusLine(index: number, at: 'start' | 'end') {
    const target = lines[index]
    const handle = target === undefined ? null : handles.current.get(target.id) ?? null
    if (at === 'end') handle?.focusEnd()
    else handle?.focusStart()
  }

  const setLatex = (index: number, latex: string) => onChange(lines.map((l, i) => (i === index ? { ...l, latex } : l)))

  function enter(index: number) {
    const next = lines[index + 1]
    if (next !== undefined && isLineEmpty(next)) return focusLine(index + 1, 'start')
    const { lines: inserted, added } = insertLineAfter(lines, index)
    pending.current = { id: added.id, at: 'start' }
    onChange(inserted)
  }

  function remove(index: number, focus: number, at: 'start' | 'end') {
    pending.current = { id: lines[focus].id, at }
    onChange(removeLineAt(lines, index))
  }

  const blockEmpty = lines.length === 1 && isLineEmpty(lines[0])

  const intentsFor = (index: number) => ({
    onEnter: () => enter(index),
    onEnterBlock,
    onExit: (direction: ExitDirection, via: ExitVia) => {
      const backward = direction === 'left' || direction === 'up'
      const target = backward ? index - 1 : index + 1
      if (target < 0 || target >= lines.length) {
        if (via === 'tab') return false
        onExitBlock(backward ? 'before' : 'after')
        return true
      }
      focusLine(target, backward ? 'end' : 'start')
      return true
    },
    onBackspaceAtStart: () => {
      if (index === 0) {
        if (blockEmpty) onDeleteEmpty()
        return
      }
      if (isLineEmpty(lines[index])) remove(index, index - 1, 'end')
      else focusLine(index - 1, 'end')
    },
    onDeleteAtEnd: () => {
      const next = lines[index + 1]
      if (next === undefined) {
        if (blockEmpty) onDeleteForward()
        return
      }
      if (isLineEmpty(next)) remove(index + 1, index, 'end')
      else focusLine(index + 1, 'start')
    },
  })

  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((line, index) => {
        const label = `Ligne ${index + 1} du calcul`
        const intents = intentsFor(index)
        return (
          <div key={line.id} style={ROW} onFocus={() => onFieldChange(handles.current.get(line.id) ?? null)}>
            <MathFieldEditor
              latex={line.latex}
              onChange={latex => setLatex(index, latex)}
              ariaLabel={label}
              ref={handle => {
                handles.current.set(line.id, handle)
              }}
              onEnter={intents.onEnter}
              onEnterBlock={intents.onEnterBlock}
              onBackspaceAtStart={intents.onBackspaceAtStart}
              onDeleteAtEnd={intents.onDeleteAtEnd}
              onExit={intents.onExit}
              tabExits
              fallback={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <input
                    data-math-raw=""
                    aria-label={`${label} (LaTeX)`}
                    value={line.latex}
                    spellCheck={false}
                    onChange={event => setLatex(index, event.target.value)}
                    onKeyDown={rawFieldKeyDown({ ...intents, onEnter: () => intents.onEnter(), tabExits: true })}
                    style={RAW}
                  />
                  <div
                    style={{ minHeight: 18, overflowX: 'auto' }}
                    // Sûr : `renderMathToHtml` échappe ce qu'il émet et `trust: false` interdit liens et ressources.
                    dangerouslySetInnerHTML={{ __html: renderMathToHtml(line.latex, false) }}
                  />
                </div>
              }
            />
          </div>
        )
      })}
    </div>
  )
}
