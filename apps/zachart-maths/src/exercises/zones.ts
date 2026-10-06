import type { Exercise } from './types'

/** Les deux zones de travail d'un exercice scindé : `a` à gauche (`blocs`), `b` à droite (`blocsB`). */
export type Zone = 'a' | 'b'

export const isSplit = (e: Exercise): boolean => e.blocsB !== undefined

/** Le patch qui scinde : la zone de droite naît vide. */
export const splitZones = (): { blocsB: unknown[] } => ({ blocsB: [] })

/**
 * Le patch qui réunit : la zone de droite est ajoutée sous celle de gauche, rien n'est perdu.
 * `blocsB: undefined` : la clé disparaît du fichier à l'écriture (JSON ignore `undefined`).
 */
export const mergeZones = (e: Exercise): { blocs: unknown[]; blocsB: undefined } => ({
  blocs: [...e.blocs, ...(e.blocsB ?? [])],
  blocsB: undefined,
})

const idOf = (block: unknown): unknown =>
  typeof block === 'object' && block !== null ? (block as { id?: unknown }).id : undefined

/**
 * Le bloc `id` passe de la zone `from` à la fin de l'autre ; `null` si l'envoi n'a pas de sens.
 * Depuis la zone de gauche d'un exercice non scindé, l'envoi scinde : la zone de droite naît avec le bloc.
 */
export function sendBlock(
  e: Exercise,
  id: string,
  from: Zone,
): { blocs: unknown[]; blocsB: unknown[] } | null {
  if (e.blocsB === undefined && from === 'b') return null
  const blocsB = e.blocsB ?? []
  const source = from === 'a' ? e.blocs : blocsB
  const target = from === 'a' ? blocsB : e.blocs
  const block = source.find(b => idOf(b) === id)
  if (block === undefined) return null
  const rest = source.filter(b => idOf(b) !== id)
  const moved = [...target, block]
  return from === 'a' ? { blocs: rest, blocsB: moved } : { blocs: moved, blocsB: rest }
}
