import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { renderMathToHtml } from './renderMath'

/** Le `<math-field>` de MathLive, tel que l'app l'utilise. */
export type MathfieldElement = HTMLElement & {
  value: string
  insert?: (fragment: string, options?: { focus?: boolean }) => void
}

export const isMathField = (el: unknown): el is MathfieldElement => el instanceof HTMLElement && el.tagName === 'MATH-FIELD'

export interface MathFieldHandle {
  focus: () => void
}

interface MathFieldProps {
  latex: string
  onChange: (latex: string) => void
  ariaLabel: string
  /** Entrée : l'élève passe à l'étape suivante. */
  onEnter?: () => void
  /** Retour arrière dans un champ vide : l'étape disparaît. */
  onBackspaceWhenEmpty?: () => void
  ref?: React.Ref<MathFieldHandle>
}

let loadPromise: Promise<boolean> | undefined
let loaded = false

/** MathLive est lourd : il est chargé à la première équation, et une fois par session. */
function loadMathLive(): Promise<boolean> {
  loadPromise ??= import('mathlive')
    .then(module => {
      try {
        const element = (module as { MathfieldElement?: { plonkSound: string | null } }).MathfieldElement
        if (element !== undefined) element.plonkSound = null
      } catch {
        // Couper le son est un confort : il ne doit jamais empêcher l'éditeur de se charger.
      }
      loaded = true
      return true
    })
    .catch(() => false)
  return loadPromise
}

/**
 * Un champ de formule : MathLive quand il est chargé, sinon un champ LaTeX brut avec aperçu.
 *
 * Le repli n'est pas qu'une attente : si MathLive ne se charge jamais, il reste l'éditeur
 * complet, et l'élève peut écrire tout de suite sans attendre l'import.
 */
export function MathField({ latex, onChange, ariaLabel, onEnter, onBackspaceWhenEmpty, ref }: MathFieldProps) {
  const [ready, setReady] = useState(() => loaded)
  const hostRef = useRef<HTMLDivElement>(null)
  const rawRef = useRef<HTMLTextAreaElement>(null)
  const fieldRef = useRef<MathfieldElement | null>(null)
  const refocus = useRef(false)

  // Les écouteurs du champ vivent aussi longtemps que lui : ils lisent la dernière version.
  const latest = useRef({ latex, onChange, onEnter, onBackspaceWhenEmpty })
  latest.current = { latex, onChange, onEnter, onBackspaceWhenEmpty }

  useImperativeHandle(ref, () => ({
    focus() {
      if (fieldRef.current !== null) fieldRef.current.focus()
      else rawRef.current?.focus()
    },
  }), [])

  useEffect(() => {
    let cancelled = false
    void loadMathLive().then(available => {
      if (cancelled || !available) return
      // Si l'élève écrivait dans le champ brut au moment du passage, le curseur le suit.
      refocus.current = rawRef.current !== null && document.activeElement === rawRef.current
      setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!ready || host === null) return
    // `createElement` plutôt que du JSX : le LaTeX et le JSX utilisent tous deux des accolades.
    const field = document.createElement('math-field') as MathfieldElement
    field.setAttribute('aria-label', ariaLabel)
    field.setAttribute('math-virtual-keyboard-policy', 'manual')
    field.style.width = '100%'
    field.value = latest.current.latex
    field.addEventListener('input', () => latest.current.onChange(field.value))
    // En phase de capture : MathLive traite la touche dans son propre shadow DOM, et
    // `preventDefault` n'y arrive à temps que s'il passe avant lui.
    field.addEventListener('keydown', event => {
      if (event.isComposing) return
      if (event.key === 'Enter' && !event.shiftKey && latest.current.onEnter !== undefined) {
        event.preventDefault()
        latest.current.onEnter()
      } else if (event.key === 'Backspace' && field.value === '' && latest.current.onBackspaceWhenEmpty !== undefined) {
        event.preventDefault()
        if (!event.repeat) latest.current.onBackspaceWhenEmpty()
      }
    }, { capture: true })
    host.replaceChildren(field)
    fieldRef.current = field
    if (refocus.current) field.focus()
    refocus.current = false
    return () => {
      fieldRef.current = null
      host.replaceChildren()
    }
  }, [ready, ariaLabel])

  // Un changement venu d'ailleurs (barre d'outils, autre étape) est répercuté dans le champ.
  useEffect(() => {
    const field = fieldRef.current
    if (field !== null && field.value !== latex) field.value = latex
  }, [latex])

  if (ready) return <div ref={hostRef} />

  return (
    <div>
      <textarea
        ref={rawRef}
        aria-label={`${ariaLabel} (LaTeX)`}
        data-math-raw=""
        value={latex}
        rows={1}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && onEnter !== undefined) {
            e.preventDefault()
            onEnter()
          } else if (e.key === 'Backspace' && latex === '' && onBackspaceWhenEmpty !== undefined) {
            e.preventDefault()
            onBackspaceWhenEmpty()
          }
        }}
        className="w-full rounded border bg-background px-2 py-1 font-mono text-sm"
      />
      <div aria-hidden dangerouslySetInnerHTML={{ __html: renderMathToHtml(latex) }} />
    </div>
  )
}
