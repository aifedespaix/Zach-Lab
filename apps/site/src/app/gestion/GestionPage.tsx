import { useState } from 'react'
import { Button, ErrorBanner, Spinner } from '@/ui/primitives'
import { Protected } from '../shell/Protected'
import { AppShell } from '../shell/AppShell'
import { useGestion } from './useGestion'
import { ProfsTab } from './ProfsTab'
import { ElevesTab } from './ElevesTab'
import { CodesTab } from './CodesTab'

const TABS = [
  { id: 'profs', label: 'Profs' },
  { id: 'eleves', label: 'Élèves' },
  { id: 'codes', label: 'Codes' },
] as const

function GestionTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('profs')
  const { users, codes, loading, error, reload } = useGestion()
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Gestion" className="flex gap-1">
        {TABS.map(t => (
          <Button key={t.id} role="tab" tone={tab === t.id ? 'primary' : 'ghost'} aria-selected={tab === t.id}
            id={`tab-${t.id}`} aria-controls="gestion-panel" onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>
      {error !== null && <ErrorBanner message={error} onRetry={() => void reload()} />}
      {loading ? <Spinner label="Chargement…" /> : (
        <div role="tabpanel" id="gestion-panel" aria-labelledby={`tab-${tab}`}>
          {tab === 'profs' && <ProfsTab users={users} reload={reload} />}
          {tab === 'eleves' && <ElevesTab users={users} reload={reload} />}
          {tab === 'codes' && <CodesTab users={users} codes={codes} reload={reload} />}
        </div>
      )}
    </div>
  )
}

export function GestionPage() {
  return (
    <Protected page="gestion">
      {session => (
        <AppShell session={session} page="gestion" title="Gestion"><GestionTabs /></AppShell>
      )}
    </Protected>
  )
}
