/** Noms réservés : le fichier d'ordre d'un dossier. */
export const ORDER_FILE = '_ordre.json'
export const EXERCISE_EXT = '.json'

// Caractères interdits sous Windows, qui est la cible de l'app, et séparateurs.
const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g
const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i

/**
 * Transforme ce que tape l'élève en un nom de dossier ou de fichier sûr.
 * Retourne `null` quand rien d'utilisable n'en sort (vide, `..`, nom réservé…).
 */
export function safeName(input: string): string | null {
  const name = input.replace(FORBIDDEN, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '')
  if (name === '' || name.startsWith('.') || name.startsWith('_') || RESERVED.test(name)) return null
  return name.slice(0, 80)
}

/** Premier nom libre de la forme `base`, `base 2`, `base 3`… (insensible à la casse). */
export function uniqueName(base: string, taken: readonly string[]): string {
  const lower = new Set(taken.map(n => n.toLowerCase()))
  if (!lower.has(base.toLowerCase())) return base
  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
}

export const joinPath = (...parts: string[]) => parts.filter(p => p !== '').join('/')
export const splitPath = (path: string): [chapter: string, file: string] => {
  const i = path.indexOf('/')
  return [path.slice(0, i), path.slice(i + 1)]
}
