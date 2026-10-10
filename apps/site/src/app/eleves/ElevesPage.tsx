import { useCallback, useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Button, EmptyState, ErrorBanner, Field, Spinner, inputClass } from '@/ui/primitives'
import { Protected } from '../shell/Protected'
import { AppShell } from '../shell/AppShell'
import { createUser, deleteUser, describeApiError, listUsers, setPassword } from '../gestion/api'
import type { UserRow } from '../gestion/summaries'
import { passwordError, usernameError } from '../gestion/validation'
import { TwoStepButton } from '../gestion/TwoStepButton'
import { InlineError, PasswordNotice, ResponsiveRows, formatDate, useRunner } from '../gestion/parts'
import { PASSWORD_ALPHABET, randomFromAlphabet } from '../lib/inviteCode'

const GENERATED_LENGTH = 12

type Run = (action: () => Promise<unknown>) => Promise<boolean>

function CreateForm({ teacherId, run, fail, onCreated }: {
  teacherId: string
  run: Run
  fail: (message: string) => void
  onCreated: (username: string, password: string) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPasswordText] = useState('')
  const submit = async () => {
    const problem = usernameError(username) ?? passwordError(password)
    if (problem !== null) return fail(problem)
    if (await run(() => createUser({ username, password, role: 'eleve', teacher: teacherId }))) {
      onCreated(username, password)
      setUsername('')
      setPasswordText('')
    }
  }
  return (
    <form className="space-y-3 rounded-2xl border border-ink-850 bg-ink-900 p-4"
      onSubmit={e => { e.preventDefault(); void submit() }}>
      <h2 className="text-sm font-semibold">Ajouter un élève</h2>
      <p className="text-sm text-ink-500">Donnez ces identifiants à l’élève, ou saisissez-les vous-même dans l’application sur sa machine.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Identifiant"><input className={inputClass} autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} /></Field>
        <Field label="Mot de passe" hint="10 caractères au moins">
          <div className="flex gap-2">
            {/* En clair : le prof doit pouvoir le recopier ou le dicter à l'élève. */}
            <input className={inputClass} autoComplete="off" value={password} onChange={e => setPasswordText(e.target.value)} />
            <Button type="button" onClick={() => setPasswordText(randomFromAlphabet(GENERATED_LENGTH, PASSWORD_ALPHABET))}>Générer</Button>
          </div>
        </Field>
      </div>
      <Button type="submit" tone="primary">Créer</Button>
    </form>
  )
}

function StudentActions({ student, run, fail, onPassword }: {
  student: UserRow
  run: Run
  fail: (message: string) => void
  onPassword: (username: string, password: string) => void
}) {
  const [password, setPasswordText] = useState('')
  const reset = async () => {
    const problem = passwordError(password)
    if (problem !== null) return fail(problem)
    if (await run(() => setPassword(student.id, password))) {
      onPassword(student.username, password)
      setPasswordText('')
    }
  }
  return (
    <>
      <div className="flex gap-2">
        <input className={`${inputClass} w-44`} autoComplete="off" placeholder="Nouveau mot de passe"
          aria-label={`Nouveau mot de passe de ${student.username}`} value={password} onChange={e => setPasswordText(e.target.value)} />
        <Button onClick={() => void reset()} disabled={password === ''}>Réinitialiser</Button>
      </div>
      <TwoStepButton label="Supprimer" onConfirm={() => void run(() => deleteUser(student.id))} />
    </>
  )
}

function Eleves({ teacherId }: { teacherId: string }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [secret, setSecret] = useState<{ username: string; password: string } | null>(null)
  const reload = useCallback(async () => {
    try {
      setUsers(await listUsers())
      setLoadError(null)
    } catch (e) {
      // On garde la liste déjà affichée : une panne passagère ne doit pas la vider.
      setLoadError(describeApiError(e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void reload() }, [reload])
  const { error, run, fail } = useRunner(reload)
  // L'API ne renvoie déjà que les élèves du prof (et son propre compte) ; on filtre quand même
  // pour ne jamais lister le prof lui-même, même si la règle serveur changeait.
  const eleves = users.filter(u => u.role === 'eleve' && u.teacher === teacherId)
  const remember = (username: string, password: string) => setSecret({ username, password })
  if (loading) return <Spinner label="Chargement…" />
  return (
    <div className="space-y-4">
      {loadError !== null && <ErrorBanner message={loadError} onRetry={() => void reload()} />}
      <CreateForm teacherId={teacherId} run={run} fail={fail} onCreated={remember} />
      <InlineError message={error} />
      {secret !== null && <PasswordNotice {...secret} />}
      {eleves.length === 0 ? (
        <EmptyState icon={<GraduationCap size={40} />} title="Aucun élève" hint="Créez votre premier élève avec le formulaire ci-dessus." />
      ) : (
        <ResponsiveRows
          items={eleves}
          rowKey={e => e.id}
          headers={['Identifiant', 'Créé']}
          cells={e => [e.username, formatDate(e.created)]}
          actions={e => <StudentActions student={e} run={run} fail={fail} onPassword={remember} />}
        />
      )}
    </div>
  )
}

export function ElevesPage() {
  return (
    <Protected page="eleves">
      {session => (
        <AppShell session={session} page="eleves" title="Mes élèves">
          {session.kind === 'prof' && <Eleves teacherId={session.id} />}
        </AppShell>
      )}
    </Protected>
  )
}
