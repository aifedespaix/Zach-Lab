import { needsCorrection } from './sheet'
import type { ChapterNode, Exercise, ExerciseEntry, Sheet } from './types'

/** Ce que l'arbre sait d'une fiche en matière de correction. */
export type CorrectionSummary = Pick<ExerciseEntry, 'aCorriger' | 'corriges' | 'aRevoir' | 'premierACorriger' | 'corrigeLes' | 'enAttente'>

export const NO_CORRECTION: CorrectionSummary = { aCorriger: 0, corriges: 0, aRevoir: 0, premierACorriger: null, corrigeLes: [], enAttente: [] }

export function summarizeSheet(sheet: Sheet): CorrectionSummary {
  const waiting = sheet.exercices.filter(needsCorrection)
  const done = sheet.exercices.filter(e => e.corrige === true)
  return {
    aCorriger: waiting.length,
    corriges: done.length,
    aRevoir: done.filter(e => e.rate === true).length,
    premierACorriger: waiting[0]?.id ?? null,
    corrigeLes: done.flatMap(e => (e.corrigeLe === undefined ? [] : [e.corrigeLe])),
    enAttente: waiting.flatMap(e => (e.creeLe === undefined ? [] : [e.creeLe])),
  }
}

/** Marquer corrigé (avec sa date) ou remettre à corriger (la date et « à revoir » disparaissent). */
export function toggleCorrected(e: Exercise, now: Date = new Date()): Pick<Exercise, 'corrige' | 'corrigeLe' | 'rate'> {
  return e.corrige === true
    ? { corrige: undefined, corrigeLe: undefined, rate: undefined }
    : { corrige: true, corrigeLe: now.toISOString(), rate: undefined }
}

export const toggleRate = (e: Exercise): Pick<Exercise, 'rate'> => ({ rate: e.rate === true ? undefined : true })

export interface Target { path: string; exerciseId: string }

/**
 * Le prochain exercice à corriger : dans la fiche ouverte après l'exercice affiché, puis dans les
 * fiches suivantes de l'arbre, puis (en bouclant) les précédentes et le début de la fiche ouverte.
 */
export function findNextToCorrect(tree: readonly ChapterNode[], path: string | null, sheet: Sheet | null, currentId: string | null): Target | null {
  const files = tree.flatMap(c => c.exercises)
  const first = (list: readonly ExerciseEntry[]): Target | null => {
    const file = list.find(f => f.premierACorriger !== null)
    return file === undefined ? null : { path: file.path, exerciseId: file.premierACorriger! }
  }
  if (path === null || sheet === null) return first(files)
  const at = sheet.exercices.findIndex(e => e.id === currentId)
  const after = sheet.exercices.slice(at + 1).find(needsCorrection)
  if (after !== undefined) return { path, exerciseId: after.id }
  const here = files.findIndex(f => f.path === path)
  const elsewhere = first([...files.slice(here + 1), ...files.slice(0, Math.max(here, 0))].filter(f => f.path !== path))
  if (elsewhere !== null) return elsewhere
  const before = sheet.exercices.slice(0, Math.max(at, 0)).find(needsCorrection)
  return before === undefined ? null : { path, exerciseId: before.id }
}

export const STALE_DAYS = 10

export interface CorrectionStats {
  /** Jours consécutifs avec au moins une correction, jusqu'à aujourd'hui (ou hier : la journée n'est pas finie). */
  streak: number
  /** Corrigés depuis lundi. */
  thisWeek: number
  /** À corriger au total. */
  toCorrect: number
  /** À revoir au total. */
  toReview: number
  /** Exercices à corriger depuis plus de `STALE_DAYS` jours, et l'ancienneté du plus vieux. */
  stale: { count: number; oldestDays: number }
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

export function correctionStats(tree: readonly ChapterNode[], now: Date = new Date()): CorrectionStats {
  const entries = tree.flatMap(c => c.exercises)
  const days = new Set<string>()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  let thisWeek = 0
  for (const entry of entries) {
    for (const iso of entry.corrigeLes) {
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) continue
      days.add(dayKey(date))
      if (date >= monday) thisWeek += 1
    }
  }
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  const ages = entries.flatMap(e => e.enAttente).map(iso => Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000)).filter(n => Number.isFinite(n) && n >= STALE_DAYS)
  return {
    streak,
    thisWeek,
    toCorrect: entries.reduce((n, e) => n + e.aCorriger, 0),
    toReview: entries.reduce((n, e) => n + e.aRevoir, 0),
    stale: { count: ages.length, oldestDays: ages.length === 0 ? 0 : Math.max(...ages) },
  }
}
