import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export interface UnsavedChangesPrompt {
  message: string
  /** Remplace la ligne « continuer perdra ce changement » par défaut, quand le problème n'est pas une perte. */
  detail?: string
  /** Ce que « continuer » fait. `null` : rien à continuer, la boîte n'est qu'un accusé de réception. */
  continueLabel: string | null
  onContinue: (() => void) | null
}

export interface UnsavedChangesGuardOptions {
  /**
   * Attend ce qui doit précéder la fermeture (la synchronisation, par exemple), après une sauvegarde réussie.
   * Pendant ce temps `closing` est vrai : l'app affiche son écran d'attente. Son propre plafond de temps lui appartient.
   */
  beforeClose?: () => Promise<void>
}

export interface UnsavedChangesGuard {
  /**
   * Lance `action` (ouvrir un autre fichier, par exemple) une fois la sauvegarde faite. Si elle échoue, une
   * boîte propose `continueLabel` : la seule issue où continuer perd vraiment une modification.
   */
  guard: (action: () => void, continueLabel?: string) => void
  prompt: UnsavedChangesPrompt | null
  dismissPrompt: () => void
  closing: boolean
}

/**
 * Garde les deux moments où une sauvegarde en attente pourrait disparaître en silence : changer de fichier et
 * fermer la fenêtre. `flush` doit REJETER si l'écriture échoue. Une sauvegarde réussie laisse l'action suivre
 * sans interruption, le cas courant ; seul un échec affiche une boîte.
 *
 * Une fenêtre qui refuse de se fermer est signalée à part : elle ne met pas une modification en danger.
 */
export function useUnsavedChangesGuard(
  flush: () => Promise<void>,
  { beforeClose }: UnsavedChangesGuardOptions = {},
): UnsavedChangesGuard {
  const [prompt, setPrompt] = useState<UnsavedChangesPrompt | null>(null)
  const [closing, setClosing] = useState(false)
  // Tenus en refs : des fonctions passées en ligne ne doivent pas réabonner l'écouteur de fermeture à chaque rendu.
  const flushRef = useRef(flush)
  flushRef.current = flush
  const beforeCloseRef = useRef(beforeClose)
  beforeCloseRef.current = beforeClose

  const guard = useCallback(
    (action: () => void, continueLabel = 'Ouvrir quand même') => {
      flushRef.current()
        .then(action)
        .catch((error: unknown) => {
          setPrompt({
            message: `La sauvegarde a échoué : ${describeError(error)}`,
            continueLabel,
            onContinue: () => {
              setPrompt(null)
              action()
            },
          })
        })
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined

    try {
      const win = getCurrentWindow()

      // `destroy`, jamais `close` : `close` ré-émet close-requested et reviendrait ici sans fin.
      // L'échec compte autant que la réussite : le gestionnaire a déjà annulé la fermeture, une fenêtre
      // qui reste ouverte doit le dire, sinon fermer la boîte ressemble à un bouton qui ne fait rien.
      async function closeNow(): Promise<void> {
        try {
          await win.destroy()
        } catch (error) {
          setPrompt({
            message: `Impossible de fermer la fenêtre : ${describeError(error)}`,
            detail:
              'Vos modifications sont enregistrées. Fermez la fenêtre depuis votre système d’exploitation (Alt+F4), puis signalez ce message.',
            continueLabel: null,
            onContinue: null,
          })
        }
      }

      win
        .onCloseRequested(async event => {
          event.preventDefault()
          try {
            await flushRef.current()
          } catch (error) {
            setPrompt({
              message: `La sauvegarde a échoué : ${describeError(error)}`,
              continueLabel: 'Quitter quand même',
              onContinue: () => {
                setPrompt(null)
                void closeNow()
              },
            })
            return
          }
          const beforeCloseNow = beforeCloseRef.current
          if (beforeCloseNow === undefined) {
            await closeNow()
            return
          }
          setClosing(true)
          try {
            // Une erreur ici ne doit pas garder la fenêtre ouverte : la fermeture reste la règle.
            await beforeCloseNow().catch(() => {})
          } finally {
            // L'écran reste jusqu'au dernier instant : le retirer avant `destroy` ferait réapparaître
            // l'application une fraction de seconde, juste avant qu'elle disparaisse.
            await closeNow()
            setClosing(false)
          }
        })
        .then(fn => {
          if (cancelled) fn()
          else unlisten = fn
        })
        .catch(() => {})
    } catch {
      // Hors d'une fenêtre Tauri.
    }

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  return { guard, prompt, dismissPrompt: () => setPrompt(null), closing }
}

/** Le message d'une erreur, lisible ; `String` pour le reste. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
