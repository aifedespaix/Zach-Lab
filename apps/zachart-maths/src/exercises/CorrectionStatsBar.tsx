import { Hint } from '@suite/shared/ui'
import { Flame } from 'lucide-react'
import { correctionStats, STALE_DAYS } from './correction'
import type { ChapterNode } from './types'

/** Le bilan des corrections, sur l'écran d'accueil : série de jours, semaine, ce qui attend depuis longtemps. */
export function CorrectionStatsBar({ tree, now }: { tree: readonly ChapterNode[]; now?: Date }) {
  const stats = correctionStats(tree, now)
  if (stats.streak === 0 && stats.thisWeek === 0 && stats.toCorrect === 0 && stats.toReview === 0) return null
  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
  return (
    <div role="group" aria-label="Bilan des corrections" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 13 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
        {stats.streak > 0 && (
          <Hint label="Jours de suite avec au moins une correction">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <Flame size={14} style={{ color: '#f97316' }} aria-hidden="true" />{plural(stats.streak, 'jour', 'jours')} d'affilée
            </span>
          </Hint>
        )}
        <span>{plural(stats.thisWeek, 'corrigé', 'corrigés')} cette semaine</span>
        {stats.toCorrect > 0 && <span>{stats.toCorrect} à corriger</span>}
        {stats.toReview > 0 && <span>{stats.toReview} à revoir</span>}
      </div>
      {stats.stale.count > 0 && (
        <p role="status" style={{ margin: 0, color: 'var(--muted-foreground)' }}>
          {stats.stale.count > 1 ? `${stats.stale.count} exercices attendent` : '1 exercice attend'} une correction depuis plus de {STALE_DAYS} jours
          (le plus ancien : {stats.stale.oldestDays} jours).
        </p>
      )}
    </div>
  )
}
