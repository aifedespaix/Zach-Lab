import { createSearchIndex } from '@suite/shared/search'
import { parseBlocks } from './blocks'
import type { ExerciseFs } from './fsPort'
import { chapterNames, exerciseFiles, readSheet } from './library'
import { joinPath } from './names'
import { exerciseLabel } from './sheetSort'
import type { Exercise } from './types'

/** Une fiche ou un exercice de la bibliothèque, avec tout ce qu'on peut y chercher. */
export interface SearchEntry {
  /** `s:chemin` pour une fiche, `e:chemin#id` pour un exercice. */
  id: string
  kind: 'fiche' | 'exercice'
  path: string
  chapter: string
  sheetTitle: string
  /** Seulement pour un exercice. */
  exerciseId?: string
  /** « 3.b », ou la position dans la fiche. */
  label?: string
  /** Titre affiché : celui de la fiche, ou le début de l'énoncé. */
  title: string
  /** Les champs indexés, et ce que le résultat en montre. */
  fields: Record<'titre' | 'chapitre' | 'numero' | 'enonce' | 'reponse' | 'notes' | 'contenu', string>
}

/** Le texte écrit dans les blocs d'un exercice : textes, cellules, lignes de calcul, équations. */
function blocksText(raw: readonly unknown[] | undefined): string {
  if (raw === undefined) return ''
  const parts: string[] = []
  for (const block of parseBlocks(raw)) {
    switch (block.type) {
      case 'texte': parts.push(String(block.contenu)); break
      case 'calcul': for (const l of block.lignes as { latex: string }[]) parts.push(l.latex); break
      case 'tableau': for (const row of block.cellules as string[][]) parts.push(...row); break
      case 'equation':
        for (const s of block.etapes as { left: string; right: string; operation: string }[]) parts.push(`${s.left} = ${s.right}`, s.operation)
        break
    }
  }
  return parts.filter(p => p.trim() !== '').join(' · ')
}

const exerciseContent = (e: Exercise) => [blocksText(e.blocs), blocksText(e.blocsB)].filter(p => p !== '').join(' · ')

/** Lit toute la bibliothèque : une entrée par fiche et une par exercice. */
export async function loadSearchEntries(fs: ExerciseFs): Promise<SearchEntry[]> {
  const entries: SearchEntry[] = []
  for (const chapter of await chapterNames(fs)) {
    for (const file of await exerciseFiles(fs, chapter)) {
      const path = joinPath(chapter, file)
      const sheet = await readSheet(fs, path)
      if (sheet === null) continue
      const none = { numero: '', enonce: '', reponse: '', notes: '', contenu: '' }
      entries.push({
        id: `s:${path}`, kind: 'fiche', path, chapter, sheetTitle: sheet.titre, title: sheet.titre,
        fields: { ...none, titre: sheet.titre, chapitre: chapter },
      })
      sheet.exercices.forEach((exercise, i) => {
        const label = exerciseLabel(exercise, i + 1)
        entries.push({
          id: `e:${path}#${exercise.id}`, kind: 'exercice', path, chapter, sheetTitle: sheet.titre, exerciseId: exercise.id, label,
          title: exercise.enonce.split('\n')[0].trim() || `Exercice ${label}`,
          fields: {
            titre: sheet.titre, chapitre: chapter, numero: exercise.numero, enonce: exercise.enonce,
            reponse: exercise.reponse, notes: exercise.notes, contenu: exerciseContent(exercise),
          },
        })
      })
    }
  }
  return entries
}

export type SearchScope = 'tout' | 'fiche' | 'exercice'

export interface SearchResult {
  entry: SearchEntry
  /** Le champ où le mot est trouvé, et l'extrait autour. */
  where: string
  snippet: string
}

const FIELD_LABELS: Record<keyof SearchEntry['fields'], string> = {
  titre: 'Fiche', chapitre: 'Chapitre', numero: 'Numéro', enonce: 'Énoncé', reponse: 'Réponse', notes: 'Notes', contenu: 'Travail',
}

/** Le texte sans accents ni majuscules, de la MÊME longueur : les indices valent pour l'original. */
export function fold(text: string): string {
  let out = ''
  for (const c of text) {
    const base = c.length === 1 ? (c.normalize('NFD')[0] ?? c) : c
    out += base.toLowerCase().length === c.length ? base.toLowerCase() : c
  }
  return out
}

const SNIPPET_RADIUS = 40

/** Cherche les mots de `query` (accents et casse ignorés) dans les champs de l'entrée, dans l'ordre d'intérêt. */
function excerpt(entry: SearchEntry, words: string[]): { where: string; snippet: string } {
  const order: (keyof SearchEntry['fields'])[] = ['enonce', 'contenu', 'reponse', 'notes', 'numero', 'titre', 'chapitre']
  for (const key of order) {
    const text = entry.fields[key]
    const folded = fold(text)
    const hits = words.map(w => folded.indexOf(w)).filter(i => i >= 0)
    if (hits.length === 0) continue
    const at = Math.min(...hits)
    const start = Math.max(0, at - SNIPPET_RADIUS)
    const slice = text.slice(start, at + SNIPPET_RADIUS * 2).replace(/\s+/g, ' ')
    return { where: FIELD_LABELS[key], snippet: `${start > 0 ? '…' : ''}${slice}${at + SNIPPET_RADIUS * 2 < text.length ? '…' : ''}` }
  }
  return { where: '', snippet: '' }
}

/** Les mots de la requête, pour les surligner dans les extraits. */
export const queryWords = (query: string) => fold(query).split(/[^\p{L}\p{N}]+/u).filter(w => w !== '')

/** Cherche dans toutes les entrées, les plus pertinentes d'abord ; un mot proche (faute, pluriel) compte aussi. */
export function searchEntries(entries: readonly SearchEntry[], query: string, scope: SearchScope = 'tout', chapter = ''): SearchResult[] {
  const pool = entries.filter(e => (scope === 'tout' || e.kind === scope) && (chapter === '' || e.chapter === chapter))
  if (pool.length === 0) return []
  const index = createSearchIndex(['titre', 'chapitre', 'numero', 'enonce', 'reponse', 'notes', 'contenu'])
  for (const entry of pool) index.add({ id: entry.id, ...entry.fields })
  const byId = new Map(pool.map(e => [e.id, e]))
  const words = queryWords(query)
  return index
    .search(query, { limit: Math.min(pool.length, 100), boost: { titre: 3, enonce: 2, numero: 2 } })
    .flatMap(hit => {
      const entry = byId.get(hit.id)
      return entry === undefined ? [] : [{ entry, ...excerpt(entry, words) }]
    })
}
