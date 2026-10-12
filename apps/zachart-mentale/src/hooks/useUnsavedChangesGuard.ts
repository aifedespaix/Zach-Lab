import { useCallback, useRef } from 'react'
import { useUnsavedChangesGuard as useSharedGuard, type UnsavedChangesPrompt } from '@suite/shared/files'
import { useWorkspaceStore } from '../state/useWorkspaceStore'
import { useSyncStore } from '../state/useSyncStore'

/**
 * Plafond de la synchronisation de fermeture. Une fenêtre qui refuse de se
 * fermer parce que le réseau traîne est pire qu'une synchro manquée : au-delà,
 * on ferme quand même, et le prochain lancement rattrapera.
 */
export const CLOSE_SYNC_TIMEOUT_MS = 5000

/** La question posée au moment de fermer, isolée pour que les tests la pilotent. */
function defaultIsOnline(): boolean {
  return navigator.onLine
}

export type { UnsavedChangesPrompt }

export interface UnsavedChangesGuardOptions {
  /**
   * Répond « y a-t-il un réseau ? ». La synchro de fermeture ne part que si
   * oui ; sinon on ferme normalement, comme si de rien n'était.
   */
  isOnline?: () => boolean
}

/**
 * Mentale's file guard: the mechanism (flush, prompt, closing screen, window
 * destroy) is shared; the policy is Mentale's. Switching files also syncs the
 * file being LEFT, and closing syncs the whole folder when online, capped by
 * `CLOSE_SYNC_TIMEOUT_MS`.
 */
export function useUnsavedChangesGuard(
  flush: () => Promise<void>,
  setCurrentFile: (path: string | null) => void,
  options: UnsavedChangesGuardOptions = {},
): {
  requestOpenFile: (path: string) => void
  prompt: UnsavedChangesPrompt | null
  dismissPrompt: () => void
  /** Vrai pendant la synchro de fermeture : l'écran de chargement se montre. */
  closing: boolean
} {
  // Le « en ligne » du dernier rendu, lu au moment de fermer.
  const isOnlineRef = useRef(options.isOnline ?? defaultIsOnline)
  isOnlineRef.current = options.isOnline ?? defaultIsOnline

  const { guard, prompt, dismissPrompt, closing } = useSharedGuard(flush, {
    beforeClose: async () => {
      // Pas de réseau : on ferme normalement, la synchro attendra un prochain
      // lancement — insister ne ferait que retarder une fermeture.
      if (!isOnlineRef.current()) return
      // Un réseau, donc : on synchronise TOUT le dossier avant de partir, plafonné.
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          useSyncStore.getState().syncNow({ trigger: 'auto' }),
          new Promise<void>(resolve => {
            timer = setTimeout(resolve, CLOSE_SYNC_TIMEOUT_MS)
          }),
        ])
      } finally {
        if (timer !== undefined) clearTimeout(timer)
      }
    },
  })

  const requestOpenFile = useCallback(
    (path: string) => {
      // Lu AVANT `setCurrentFile` : c'est le fichier qu'on QUITTE qu'il faut
      // synchroniser, pas celui qu'on ouvre — voir `syncOneFile`.
      const outgoingPath = useWorkspaceStore.getState().currentFilePath
      guard(
        () => {
          setCurrentFile(path)
          // Fire-and-forget: switching files must never wait on the network, and
          // the file we just left is no longer open in the canvas, so it is safe
          // to pull into. Un seul fichier, jamais le dossier entier.
          if (outgoingPath !== null) void useSyncStore.getState().syncOneFile(outgoingPath)
        },
        'Ouvrir quand même',
        // Après un échec de sauvegarde, « ouvrir quand même » n'envoie pas la
        // synchro du fichier quitté : il pourrait écraser la version non sauvée.
        () => setCurrentFile(path),
      )
    },
    [guard, setCurrentFile],
  )

  return { requestOpenFile, prompt, dismissPrompt, closing }
}
