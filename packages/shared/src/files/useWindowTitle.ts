import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

/** « App — fichier.ext », or the app name alone. */
export function windowTitleFor(appName: string, fileName: string | null): string {
  return fileName === null || fileName === '' ? appName : `${appName} - ${fileName}`
}

/**
 * Keeps the OS window title in sync with the open file. A failure is cosmetic (outside a Tauri
 * window `getCurrentWindow()` throws synchronously) and ignored.
 */
export function useWindowTitle(appName: string, fileName: string | null): void {
  useEffect(() => {
    try {
      getCurrentWindow()
        .setTitle(windowTitleFor(appName, fileName))
        .catch(() => {})
    } catch {
      // Not in a Tauri window.
    }
  }, [appName, fileName])
}
