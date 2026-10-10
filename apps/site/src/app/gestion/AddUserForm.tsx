import { useState } from 'react'
import { Button, Field, inputClass } from '@/ui/primitives'
import { createUser } from './api'
import { passwordError, usernameError } from './validation'

/** Création d'un compte (prof ou élève) ; `teachers` est fourni seulement pour un élève. */
export function AddUserForm({ role, title, teachers, run, fail }: {
  role: 'prof' | 'eleve'
  title: string
  teachers?: readonly { id: string; username: string }[]
  run: (action: () => Promise<unknown>) => Promise<boolean>
  fail: (message: string) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [teacher, setTeacher] = useState('')
  const submit = async () => {
    const problem = usernameError(username) ?? passwordError(password)
      ?? (role === 'eleve' && teacher === '' ? 'Choisissez le professeur de cet élève.' : null)
    if (problem !== null) return fail(problem)
    if (await run(() => createUser({ username, password, role, teacher: role === 'eleve' ? teacher : '' }))) {
      setUsername('')
      setPassword('')
    }
  }
  return (
    <form className="space-y-3 rounded-2xl border border-ink-850 bg-ink-900 p-4"
      onSubmit={e => { e.preventDefault(); void submit() }}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Identifiant"><input className={inputClass} autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} /></Field>
        <Field label="Mot de passe" hint="10 caractères au moins">
          <input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        </Field>
        {role === 'eleve' && teachers !== undefined && (
          <Field label="Professeur">
            <select className={inputClass} value={teacher} onChange={e => setTeacher(e.target.value)}>
              <option value="">Choisir…</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.username}</option>)}
            </select>
          </Field>
        )}
      </div>
      <Button type="submit" tone="primary">Ajouter</Button>
    </form>
  )
}
