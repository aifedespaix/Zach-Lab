import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * Garde le titre de la fenêtre système à jour. L'app compose le texte (nom de l'app, nom du fichier) ;
 * ce hook ne fait que le poser. Un échec est cosmétique (page de navigateur, hors Tauri) et ignoré.
 */
export function useWindowTitle(title: string): void {
  useEffect(() => {
    try {
      getCurrentWindow()
        .setTitle(title)
        .catch(() => {})
    } catch {
      // Hors d'une fenêtre Tauri : rien à mettre à jour.
    }
  }, [title])
}
