import { useState } from 'react'
import { Users } from 'lucide-react'
import { Badge, EmptyState } from '@/ui/primitives'
import { formatCode } from '../lib/inviteCode'
import { teacherCounts, type UserRow } from './summaries'
import { AddUserForm } from './AddUserForm'
import { UserActions } from './UserActions'
import { InlineError, PasswordNotice, ResponsiveRows, formatDate, useRunner } from './parts'

const plural = (n: number) => `${n} ${n > 1 ? 'élèves' : 'élève'}`

export function ProfsTab({ users, reload }: { users: UserRow[]; reload: () => Promise<void> }) {
  const { error, run, fail } = useRunner(reload)
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null)
  const profs = users.filter(u => u.role === 'prof')
  const counts = teacherCounts(users)
  return (
    <div className="space-y-4">
      <AddUserForm role="prof" title="Ajouter un professeur" run={run} fail={fail} />
      <InlineError message={error} />
      {secret !== null && <PasswordNotice {...secret} />}
      {profs.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title="Aucun professeur" hint="Ajoutez-en un ci-dessus, ou donnez un code d’inscription." />
      ) : (
        <ResponsiveRows
          items={profs}
          rowKey={p => p.id}
          headers={['Identifiant', 'Élèves', 'Inscrit avec le code', 'Créé']}
          cells={p => [
            p.username,
            plural(counts.get(p.id) ?? 0),
            p.invite_code === '' ? '—' : <Badge>{formatCode(p.invite_code)}</Badge>,
            formatDate(p.created),
          ]}
          actions={p => {
            const n = counts.get(p.id) ?? 0
            return (
              <UserActions user={p} run={run} fail={fail} onPassword={(username, password) => setSecret({ username, password })}
                deleteBlocked={n > 0 ? `Rattachez ou supprimez d’abord ses ${plural(n)}` : undefined} />
            )
          }}
        />
      )}
    </div>
  )
}
