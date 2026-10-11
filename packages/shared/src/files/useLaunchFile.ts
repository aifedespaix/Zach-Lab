import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export interface LaunchFileOptions {
  /** La commande Rust qui relit le fichier passé au lancement (`argv`), ou `null`. */
  command: string
  /** L'événement émis quand un second lancement confie son fichier à celui-ci. */
  event: string
}

/**
 * Ouvre le fichier que l'OS a demandé d'ouvrir.
 *
 * Deux moments, un seul comportement : un double-clic pendant que l'app est fermée la lance avec le chemin
 * dans `argv` (relu par `command`) ; pendant qu'elle tourne, le plugin d'instance unique replie le second
 * processus dans celui-ci et émet `event`. `openFile` est tenu dans une ref : son identité change à presque
 * chaque rendu, et en dépendance d'effet on relancerait la requête (et on rouvrirait le fichier de lancement
 * par-dessus ce que l'utilisateur a fait depuis).
 *
 * Sans effet hors d'une fenêtre Tauri : `invoke` et `listen` y rejettent.
 */
export function useLaunchFile(openFile: (path: string) => void, { command, event }: LaunchFileOptions): void {
  const openFileRef = useRef(openFile)
  openFileRef.current = openFile

  useEffect(() => {
    let cancelled = false

    invoke<string | null>(command)
      .then(path => {
        if (cancelled || !path) return
        openFileRef.current(path)
      })
      .catch(() => {
        // Hors Tauri, ou commande absente : lancer sans fichier est le cas normal.
      })

    const unlisten = listen<string>(event, message => {
      openFileRef.current(message.payload)
    })
    unlisten.catch(() => {})

    return () => {
      cancelled = true
      unlisten.then(stop => stop()).catch(() => {})
    }
  }, [])
}
