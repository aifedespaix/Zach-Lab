import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Badge, ErrorBanner, Spinner } from '@/ui/primitives'
import { Protected } from '../shell/Protected'
import { AppShell } from '../shell/AppShell'
import { pb } from '../session/pb'
import { describeApiError, listCodes, listUsers } from '../gestion/api'
import { summarizeCodes, type UserRow } from '../gestion/summaries'
import { ResponsiveRows } from '../gestion/parts'
import { adminStats, formatRelative, profStats, type ConflictRow, type SyncEventRow } from './stats'

const EVENTS_LIMIT = 500

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Une collection absente (404) veut dire « serveur pas encore migré » : message dédié, le reste de la page reste. */
function loadMessage(label: string, e: unknown): string {
  const status = typeof e === 'object' && e !== null && 'status' in e ? Number((e as { status: unknown }).status) : 0
  return status === 404
    ? `${label} : la collection n’existe pas encore sur le serveur (mise à jour du serveur à appliquer).`
    : `${label} : ${describeApiError(e)}`
}

function Tile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-850 bg-ink-900 p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function LinkCard({ href, title, badge }: { href: string; title: string; badge?: number }) {
  return (
    <a href={href} className="tap flex items-center justify-between gap-3 rounded-2xl border border-ink-850 bg-ink-900 p-4 text-sm hover:bg-ink-850">
      <span>{title}</span>
      {badge !== undefined && badge > 0 && <Badge tone="danger">{badge}</Badge>}
    </a>
  )
}

const LEVEL_TONE = { error: 'danger', warning: 'warn', info: 'ok' } as const
const LEVEL_LABEL = { error: 'Erreur', warning: 'Alerte', info: 'OK' } as const

function LevelBadge({ level }: { level: string | null }) {
  if (level !== 'error' && level !== 'warning' && level !== 'info') return <span className="text-ink-500">—</span>
  return <Badge tone={LEVEL_TONE[level]}>{LEVEL_LABEL[level]}</Badge>
}

interface ProfData { eleves: UserRow[]; events: SyncEventRow[]; conflicts: ConflictRow[] }

function ProfDashboard({ teacherId }: { teacherId: string }) {
  const [data, setData] = useState<ProfData | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const load = useCallback(async () => {
    // Trois sources indépendantes : l'échec de l'une n'efface pas les autres.
    const [users, events, conflicts] = await Promise.allSettled([
      listUsers(),
      // Les 500 plus récents, sans filtre construit à la main : profStats trie ensuite par élève.
      pb.collection('sync_events').getList(1, EVENTS_LIMIT, { sort: '-created' }),
      pb.collection('sync_conflicts').getFullList({ filter: 'status = "open"' }),
    ])
    const failed: string[] = []
    if (users.status === 'rejected') failed.push(loadMessage('Élèves', users.reason))
    if (events.status === 'rejected') failed.push(loadMessage('Synchronisations', events.reason))
    if (conflicts.status === 'rejected') failed.push(loadMessage('Conflits', conflicts.reason))
    setErrors(failed)
    setData({
      eleves: users.status === 'fulfilled' ? users.value.filter(u => u.role === 'eleve' && u.teacher === teacherId) : [],
      events: events.status === 'fulfilled'
        ? events.value.items.map(r => ({ username: text(r.username), level: text(r.level), created: text(r.created) }))
        : [],
      conflicts: conflicts.status === 'fulfilled'
        ? conflicts.value.map(r => ({ username: text(r.username), status: text(r.status) }))
        : [],
    })
  }, [teacherId])
  useEffect(() => { void load() }, [load])
  if (data === null) return <Spinner label="Chargement…" />

  const stats = profStats(data.eleves, data.events, data.conflicts)
  const nowMs = Date.now()
  const latest = stats.perEleve.reduce<string | null>((best, e) => (e.lastSyncAt !== null && (best === null || e.lastSyncAt > best) ? e.lastSyncAt : best), null)
  return (
    <div className="space-y-4">
      {errors.map(message => <ErrorBanner key={message} message={message} onRetry={() => void load()} />)}
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Élèves" value={stats.eleveCount} />
        <Tile label="Conflits ouverts" value={stats.openConflicts} />
        <Tile label="Dernière synchro" value={<span className="text-base">{formatRelative(latest, nowMs)}</span>} />
      </div>
      {stats.perEleve.length > 0 && (
        <ResponsiveRows
          items={stats.perEleve}
          rowKey={e => e.username}
          headers={['Élève', 'Dernière synchro', 'Niveau', 'Conflits ouverts']}
          cells={e => [e.username, formatRelative(e.lastSyncAt, nowMs), <LevelBadge level={e.lastLevel} />, e.openConflicts]}
          actions={() => null}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <LinkCard href="/eleves/" title="Mes élèves" />
        <LinkCard href="/bibliotheque/#/conflits" title="Conflits à résoudre" badge={stats.openConflicts} />
        <LinkCard href="/compte/" title="Mon compte" />
      </div>
    </div>
  )
}

function AdminDashboard() {
  const [stats, setStats] = useState<ReturnType<typeof adminStats> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const [users, codes] = await Promise.all([listUsers(), listCodes()])
      setStats(adminStats(users, summarizeCodes(codes, users, Date.now())))
      setError(null)
    } catch (e) {
      setError(describeApiError(e))
    }
  }, [])
  useEffect(() => { void load() }, [load])
  return (
    <div className="space-y-4">
      {error !== null && <ErrorBanner message={error} onRetry={() => void load()} />}
      {stats === null && error === null && <Spinner label="Chargement…" />}
      {stats !== null && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Profs" value={stats.profCount} />
          <Tile label="Élèves" value={stats.eleveCount} />
          <Tile label="Codes actifs" value={stats.activeCodes} />
        </div>
      )}
      <LinkCard href="/gestion/" title="Gestion des comptes" />
    </div>
  )
}

export function DashboardPage() {
  return (
    <Protected page="dashboard">
      {session => (
        <AppShell session={session} page="dashboard" title="Tableau de bord">
          {session.kind === 'prof' && <ProfDashboard teacherId={session.id} />}
          {session.kind === 'admin' && <AdminDashboard />}
        </AppShell>
      )}
    </Protected>
  )
}
