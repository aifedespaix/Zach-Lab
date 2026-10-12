import type { RefObject } from 'react'
import { useFileDropZone as useSharedFileDropZone } from '@suite/shared/files'
import { isMindMapPath } from '../persistence/paths'

const INVALID_FILE_MESSAGE =
  'Seuls les cartes mentales (.zmap, .json) et les images peuvent être déposées ici.'

const MIND_MAP_EXTENSIONS = ['.zmap', '.json']
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg']

/**
 * The card under a drop point, or `null`.
 *
 * Dropping a picture ONTO a card is the gesture that needs no explanation —
 * far better than requiring the definition popover to be open first. The
 * point arrives in CSS pixels, as the shared drop zone hands it over.
 */
function cardIdAtPoint(point: { x: number; y: number }): string | null {
  // Guarded rather than assumed: `elementFromPoint` is standard in the Tauri
  // webviews but absent from some non-browser DOM implementations, and this
  // runs inside an event handler where a throw would be swallowed silently.
  if (typeof document.elementFromPoint !== 'function') return null

  const element = document.elementFromPoint(point.x, point.y)
  const card = element?.closest('[data-testid^="card-"]')
  const testId = card?.getAttribute('data-testid')
  return testId ? testId.slice('card-'.length) : null
}

/**
 * Opens a mind map dropped on `zoneRef`, and adds an image dropped on a card to
 * that card. The window-level drop plumbing (zone test, physical pixels, Tauri
 * outside a window) lives in `@suite/shared/files`; this file only routes.
 *
 * `onDropImageOnCard` absent: an image is reported as unsupported rather than
 * silently ignored.
 */
export function useFileDropZone(
  zoneRef: RefObject<HTMLElement | null>,
  onOpenFile: (path: string) => void,
  onDropImageOnCard?: (cardId: string, path: string) => void,
): { isDragActive: boolean; dropError: string | null } {
  return useSharedFileDropZone(zoneRef, {
    extensions: [...MIND_MAP_EXTENSIONS, ...IMAGE_EXTENSIONS],
    rejectMessage: INVALID_FILE_MESSAGE,
    onDrop: (path, point) => {
      // A mind map opens; an image joins the card it landed on. Routing by
      // extension is what lets one window-level event serve both gestures.
      if (isMindMapPath(path)) {
        onOpenFile(path)
        return
      }
      if (onDropImageOnCard === undefined) return INVALID_FILE_MESSAGE
      const cardId = cardIdAtPoint(point)
      if (cardId === null) return 'Dépose l’image sur une carte pour l’ajouter à sa définition.'
      onDropImageOnCard(cardId, path)
    },
  })
}
