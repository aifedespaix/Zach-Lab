import { readStored, writeStored } from '@suite/shared/storage'
import type { DocumentPort } from '@suite/shared/files'

const INDEX_KEY = 'base:documents'
const docKey = (path: string) => `base:document:${path}`

/**
 * Les textes de la démo, gardés dans le stockage de l'app (hors Tauri aussi). Un vrai logiciel
 * remplace ce port par un fichier sur le disque : `useFileSession` ne voit que `DocumentPort`.
 */
export const documentPort: DocumentPort<string> = {
  read: async path => readStored(docKey(path)),
  write: async (path, doc) => {
    writeStored(docKey(path), doc)
    const known = listDocuments()
    if (!known.includes(path)) writeStored(INDEX_KEY, JSON.stringify([...known, path]))
  },
}

export function listDocuments(): string[] {
  try {
    const parsed: unknown = JSON.parse(readStored(INDEX_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

/** Un nom libre : `note-1.txt`, `note-2.txt`… */
export function newDocumentName(): string {
  const known = new Set(listDocuments())
  let n = 1
  while (known.has(`note-${n}.txt`)) n++
  return `note-${n}.txt`
}
