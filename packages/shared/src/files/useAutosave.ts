import { useCallback, useEffect, useRef } from 'react'

export const AUTOSAVE_DELAY_MS = 600

export interface AutosaveOptions {
  /** Le délai de calme avant l'écriture. */
  delay?: number
  /**
   * Garde de tout l'effet : l'appelant la laisse à `false` tant qu'il ne sait pas qu'écrire est sûr
   * (le chargement a produit une valeur, ou a prouvé qu'il n'y a pas encore de fichier). Sans elle,
   * le délai peut expirer avant une lecture lente — ou après une lecture ratée — et écraser un vrai
   * fichier avec la valeur transitoire du store.
   */
  enabled?: boolean
  /** Ce qui identifie le fichier (son chemin) : un autre `scope` ré-arme l'écriture. */
  scope?: string
  /** Une écriture refusée : sans bouton « Enregistrer », un échec silencieux ne laisserait aucun signal. */
  onError?: (error: unknown) => void
}

/**
 * Écriture différée de `value` par `save`.
 *
 * `flush` écrit tout de suite ce qui attend, au lieu de patienter — avant une action qui quitte ce
 * fichier (changer de fichier, fermer la fenêtre) pour qu'un changement fait un instant plus tôt ne
 * soit pas perdu avec le minuteur annulé. Il reste utilisable après un échec (`dirty` n'est effacé
 * qu'une fois l'écriture confirmée) et rejette si l'écriture échoue.
 */
export function useAutosave<T>(
  save: (value: T) => Promise<void>,
  value: T,
  { delay = AUTOSAVE_DELAY_MS, enabled = true, scope, onError }: AutosaveOptions = {},
): { flush: () => Promise<void> } {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // En refs : un appelant qui passe une flèche en ligne ne relance pas le délai à chaque rendu, et
  // `flush` (stable) agit toujours sur les dernières valeurs.
  const saveRef = useRef(save)
  saveRef.current = save
  const valueRef = useRef(value)
  valueRef.current = value
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  // `valueRef` porte-t-il quelque chose dont l'écriture n'est pas confirmée ?
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    dirtyRef.current = true
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = undefined
      saveRef.current(value).then(
        () => { if (valueRef.current === value) dirtyRef.current = false },
        error => onErrorRef.current?.(error),
      )
    }, delay)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [scope, value, delay, enabled])

  const flush = useCallback(async () => {
    if (!dirtyRef.current || !enabledRef.current) return
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
    const written = valueRef.current
    try {
      await saveRef.current(written)
      if (valueRef.current === written) dirtyRef.current = false
    } catch (error) {
      onErrorRef.current?.(error)
      throw error
    }
  }, [])

  return { flush }
}
