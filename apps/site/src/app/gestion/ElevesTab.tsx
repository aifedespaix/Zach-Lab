import { useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { EmptyState, Field, inputClass } from '@/ui/primitives'
import { filterEleves, type UserRow } from './summaries'
import { AddUserForm } from './AddUserForm'
import { UserActions } from './UserActions'
import { InlineError, PasswordNotice, ResponsiveRows, formatDate, useRunner } from './parts'

export function ElevesTab({ users, reload }: { users: UserRow[]; reload: () => Promise<void> }) {
  const { error, run, fail } = useRunner(reload)
  const [filter, setFilter] = useState<string>('all')
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null)
  const profs = users.filter(u => u.role === 'prof')
  const names = new Map(profs.map(p => [p.id, p.username]))
  const eleves = filterEleves(users, filter)
  return (
    <div className="space-y-4">
      {profs.length === 0 ? (
        <EmptyState icon={<GraduationCap size={40} />} title="Aucun professeur" hint="Créez d’abord un professeur : chaque élève lui est rattaché." />
      ) : (
        <AddUserForm role="eleve" title="Ajouter un élève" teachers={profs} run={run} fail={fail} />
      )}
      <InlineError message={error} />
      {secret !== null && <PasswordNotice {...secret} />}
      <div className="max-w-xs">
        <Field label="Prof">
          <select className={inputClass} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Tous</option>
            {profs.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}
          </select>
        </Field>
      </div>
      {eleves.length === 0 ? (
        <EmptyState icon={<GraduationCap size={40} />} title="Aucun élève" hint={filter === 'all' ? undefined : 'Ce professeur n’a pas encore d’élève.'} />
      ) : (
        <ResponsiveRows
          items={eleves}
          rowKey={e => e.id}
          headers={['Identifiant', 'Prof', 'Créé']}
          cells={e => [e.username, names.get(e.teacher) ?? '—', formatDate(e.created)]}
          actions={e => (
            <UserActions user={e} teachers={profs} run={run} fail={fail} onPassword={(username, password) => setSecret({ username, password })} />
          )}
        />
      )}
    </div>
  )
}
