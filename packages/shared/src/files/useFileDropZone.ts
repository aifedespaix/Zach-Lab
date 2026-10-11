import { useEffect, useRef, useState, type RefObject } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export interface FileDropZoneOptions {
  /** Extensions acceptées, avec le point, insensibles à la casse : `['.zmap', '.json']`. */
  extensions: readonly string[]
  /** Appelé avec le premier fichier accepté déposé dans la zone. */
  onDrop: (path: string) => void
  /** Message affiché quand le dépôt ne contient aucun fichier accepté. */
  rejectMessage: string
}

export interface FileDropZoneState {
  isDragActive: boolean
  dropError: string | null
}

export function hasExtension(path: string, extensions: readonly string[]): boolean {
  const lower = path.toLowerCase()
  return extensions.some(extension => lower.endsWith(extension.toLowerCase()))
}

/**
 * Ouvre un fichier déposé sur `zoneRef`. Utilise l'événement de glisser-déposer de la fenêtre (pas l'événement
 * DOM `drop`, que Tauri intercepte avant la webview) et recoupe sa position en pixels physiques avec le rectangle
 * de la zone : un dépôt ailleurs dans la fenêtre est ignoré.
 *
 * Sans effet hors d'une fenêtre Tauri.
 */
export function useFileDropZone(
  zoneRef: RefObject<HTMLElement | null>,
  { extensions, onDrop, rejectMessage }: FileDropZoneOptions,
): FileDropZoneState {
  const [isDragActive, setIsDragActive] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  // Une ref : un `onDrop` en ligne ne doit pas réabonner l'écouteur à chaque rendu.
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  useEffect(() => {
    let cancelled = false
    let unlisten: (() => void) | undefined

    try {
      getCurrentWindow()
        .onDragDropEvent(event => {
          const { payload } = event
          if (payload.type === 'enter' || payload.type === 'over') {
            setIsDragActive(isInZone(zoneRef, payload.position))
            return
          }
          if (payload.type === 'drop') {
            setIsDragActive(false)
            if (!isInZone(zoneRef, payload.position)) return

            const accepted = payload.paths.find(path => hasExtension(path, extensions))
            if (accepted === undefined) {
              setDropError(rejectMessage)
              return
            }
            setDropError(null)
            onDropRef.current(accepted)
            return
          }
          // 'leave'
          setIsDragActive(false)
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
  }, [zoneRef, extensions, rejectMessage])

  return { isDragActive, dropError }
}

/** Les positions arrivent en pixels physiques ; le DOM travaille en pixels CSS. */
function isInZone(zoneRef: RefObject<HTMLElement | null>, position: { x: number; y: number }): boolean {
  const el = zoneRef.current
  if (!el) return false
  const rect = el.getBoundingClientRect()
  const scale = window.devicePixelRatio || 1
  const x = position.x / scale
  const y = position.y / scale
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}
