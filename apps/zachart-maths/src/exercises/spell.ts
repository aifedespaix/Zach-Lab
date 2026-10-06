import { isTextField } from './insertAtCursor'

/** Un mot mal orthographié dans un champ : sa place et les corrections proposées. */
export interface Misspelling {
  start: number
  end: number
  word: string
  suggestions: string[]
}

/** Les corrections d'un mot, ou `null` s'il est juste. */
export type SpellCheck = (word: string) => Promise<string[] | null>

let shared: SpellCheck | null = null

/** Le correcteur de l'application : un worker, créé à la première demande. */
export function appSpellCheck(): SpellCheck {
  if (shared !== null) return shared
  const worker = new Worker(new URL('./spell.worker.ts', import.meta.url), { type: 'module' })
  const waiting = new Map<number, (suggestions: string[] | null) => void>()
  let next = 0
  worker.onmessage = (event: MessageEvent<{ id: number; suggestions: string[] | null }>) => {
    waiting.get(event.data.id)?.(event.data.suggestions)
    waiting.delete(event.data.id)
  }
  shared = word =>
    new Promise(resolve => {
      const id = next++
      waiting.set(id, resolve)
      worker.postMessage({ id, word })
    })
  return shared
}

/** Un mot : lettres (accentuées comprises), avec apostrophe ou trait d'union à l'intérieur (« aujourd'hui », « peut-être »). */
const WORD = /[\p{L}]+(?:['’-][\p{L}]+)*/gu

/** Le mot qui contient `position` (ou qui la touche à droite), avec sa place dans `text`. */
export function wordAt(text: string, position: number): { start: number; end: number; word: string } | null {
  for (const match of text.matchAll(WORD)) {
    const start = match.index
    const end = start + match[0].length
    if (position >= start && position <= end) return { start, end, word: match[0] }
  }
  return null
}

/** Le mot sous le curseur de `field` avec ses corrections s'il est mal écrit ; `null` s'il est juste, d'une lettre ou absent. */
export async function misspellingAt(field: unknown, check: SpellCheck = appSpellCheck()): Promise<Misspelling | null> {
  if (!isTextField(field)) return null
  const target = wordAt(field.value, field.selectionStart ?? 0)
  if (target === null || target.word.length < 2) return null
  const suggestions = await check(target.word)
  return suggestions === null ? null : { ...target, suggestions }
}
