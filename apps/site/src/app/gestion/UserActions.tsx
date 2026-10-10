import { useState } from 'react'
import { Button, inputClass } from '@/ui/primitives'
import { deleteUser, setPassword, updateUser } from './api'
import { passwordError, usernameError } from './validation'
import { TwoStepButton } from './TwoStepButton'
import type { UserRow } from './summaries'

interface Props {
  user: UserRow
  run: (action: () => Promise<unknown>) => Promise<boolean>
  fail: (message: string) => void
  /** Mot de passe réinitialisé : l'onglet l'affiche une seule fois. */
  onPassword: (username: string, password: string) => void
  /** Élèves seulement : les profs entre lesquels on peut rattacher. */
  teachers?: readonly UserRow[]
  /** Raison pour laquelle la suppression est refusée (le serveur la refuserait aussi). */
  deleteBlocked?: string
}

/** Renommer, réinitialiser le mot de passe, rattacher, supprimer : commun aux profs et aux élèves. */
export function UserActions({ user, run, fail, onPassword, teachers, deleteBlocked }: Props) {
  const [name, setName] = useState(user.username)
  const [password, setPasswordText] = useState('')
  const rename = () => {
    const problem = usernameError(name)
    if (problem !== null) return fail(problem)
    void run(() => updateUser(user.id, { username: name }))
  }
  const reset = async () => {
    const problem = passwordError(password)
    if (problem !== null) return fail(problem)
    if (await run(() => setPassword(user.id, password))) {
      onPassword(user.username, password)
      setPasswordText('')
    }
  }
  return (
    <>
      {/* Pas de renommage d'un élève : ses cartes et son historique de synchro sont liés à son identifiant (auteur = username). */}
      {user.role === 'prof' && (
        <div>
          <div className="flex gap-2">
            <input className={`${inputClass} w-40`} aria-label={`Identifiant de ${user.username}`} value={name} onChange={e => setName(e.target.value)} />
            <Button onClick={rename} disabled={name === user.username}>Renommer</Button>
          </div>
          <p className="mt-1 text-xs opacity-70">Les cartes déjà publiées gardent l’ancien identifiant comme auteur.</p>
        </div>
      )}
      {teachers !== undefined && (
        <select className={`${inputClass} w-40`} aria-label={`Prof de ${user.username}`} value={user.teacher}
          onChange={e => void run(() => updateUser(user.id, { teacher: e.target.value }))}>
          {/* Sans prof, la valeur '' doit être sélectionnée : sinon le premier prof paraît choisi et le choisir ne déclenche aucun changement. */}
          {user.teacher === '' && <option value="" disabled>— aucun —</option>}
          {teachers.map(t => <option key={t.id} value={t.id}>{t.username}</option>)}
        </select>
      )}
      <div className="flex gap-2">
        <input className={`${inputClass} w-44`} type="password" autoComplete="new-password" placeholder="Nouveau mot de passe"
          aria-label={`Nouveau mot de passe de ${user.username}`} value={password} onChange={e => setPasswordText(e.target.value)} />
        <Button onClick={() => void reset()} disabled={password === ''}>Réinitialiser</Button>
      </div>
      <TwoStepButton label="Supprimer" disabled={deleteBlocked !== undefined} title={deleteBlocked}
        onConfirm={() => void run(() => deleteUser(user.id))} />
    </>
  )
}
