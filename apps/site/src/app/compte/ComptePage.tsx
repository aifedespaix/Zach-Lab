import { useEffect, useRef, useState } from 'react'
import { Button, Field, inputClass } from '@/ui/primitives'
import { Protected } from '../shell/Protected'
import { AppShell } from '../shell/AppShell'
import { loginAny, logout } from '../session/session'
import { pb } from '../session/pb'
import { describeApiError } from '../gestion/api'
import { passwordError, usernameError } from '../gestion/validation'
import { InlineError, SecretNotice } from '../gestion/parts'

// Laisse le temps de lire le message avant la redirection.
const RECONNECT_REDIRECT_MS = 2500

type Prof = { id: string; username: string }

/** Message d'une erreur : une erreur locale garde son texte, une erreur serveur est traduite. */
const messageOf = (e: unknown) => (e instanceof Error && !('status' in e) ? e.message : describeApiError(e))

function UsernameSection({ prof, onChanged }: { prof: Prof; onChanged: (username: string) => void }) {
  const [username, setUsername] = useState(prof.username)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const submit = async () => {
    setDone(false)
    const problem = usernameError(username)
    if (problem !== null) return setError(problem)
    setError(null)
    try {
      await pb.collection('users').update(prof.id, { username })
      setDone(true)
      onChanged(username)
    } catch (e) {
      setError(messageOf(e))
    }
  }
  return (
    <form className="space-y-3 rounded-2xl border border-ink-850 bg-ink-900 p-4" onSubmit={e => { e.preventDefault(); void submit() }}>
      <h2 className="text-sm font-semibold">Identifiant</h2>
      <Field label="Identifiant">
        <input className={inputClass} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} />
      </Field>
      <InlineError message={error} />
      {done && <SecretNotice><p>Identifiant modifié. Utilisez-le à votre prochaine connexion.</p></SecretNotice>}
      <Button type="submit" tone="primary">Changer l’identifiant</Button>
    </form>
  )
}

function PasswordSection({ prof }: { prof: Prof }) {
  const [oldPassword, setOld] = useState('')
  const [password, setNew] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Minuterie de redirection : une seule à la fois, et annulée si la page est quittée avant son échéance.
  const redirectTimer = useRef<number | null>(null)
  const cancelRedirect = () => {
    if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current)
    redirectTimer.current = null
  }
  useEffect(() => cancelRedirect, [])
  const submit = async () => {
    setDone(false)
    const problem = passwordError(password) ?? (password === confirm ? null : 'La confirmation ne correspond pas au nouveau mot de passe.')
    if (problem !== null) return setError(problem)
    setError(null)
    try {
      await pb.collection('users').update(prof.id, { oldPassword, password, passwordConfirm: confirm })
    } catch (e) {
      // Changement refusé : rien n'est vidé, l'utilisateur corrige et réessaie.
      return setError(messageOf(e))
    }
    // Dès ici le mot de passe a changé et l'ancien jeton est invalide : les champs ne servent plus.
    setOld(''); setNew(''); setConfirm('')
    try {
      // PocketBase invalide le jeton : on se reconnecte pour rester sur la page.
      await loginAny(prof.username, password)
      setDone(true)
    } catch {
      // « Identifiant incorrect » serait faux : le changement a réussi, seule la reconnexion a échoué.
      setError('Mot de passe modifié, mais la reconnexion a échoué : reconnectez-vous.')
      logout()
      cancelRedirect()
      redirectTimer.current = window.setTimeout(() => window.location.replace('/login/'), RECONNECT_REDIRECT_MS)
    }
  }
  return (
    <form className="space-y-3 rounded-2xl border border-ink-850 bg-ink-900 p-4" onSubmit={e => { e.preventDefault(); void submit() }}>
      <h2 className="text-sm font-semibold">Mot de passe</h2>
      <Field label="Mot de passe actuel">
        <input className={inputClass} type="password" autoComplete="current-password" value={oldPassword} onChange={e => setOld(e.target.value)} />
      </Field>
      <Field label="Nouveau mot de passe">
        <input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={e => setNew(e.target.value)} />
      </Field>
      <Field label="Confirmer le nouveau mot de passe">
        <input className={inputClass} type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
      </Field>
      <p className="text-xs text-ink-500">10 caractères au moins.</p>
      <InlineError message={error} />
      {done && <SecretNotice><p>Mot de passe modifié.</p></SecretNotice>}
      <Button type="submit" tone="primary">Changer le mot de passe</Button>
    </form>
  )
}

/** Le pseudo courant vit ici : après un changement d'identifiant, la reconnexion du mot de passe doit utiliser le nouveau. */
function ProfSections({ prof }: { prof: Prof }) {
  const [username, setUsername] = useState(prof.username)
  return (
    <>
      <UsernameSection prof={{ id: prof.id, username }} onChanged={setUsername} />
      <PasswordSection prof={{ id: prof.id, username }} />
    </>
  )
}

export function ComptePage() {
  return (
    <Protected page="compte">
      {session => (
        <AppShell session={session} page="compte" title="Mon compte">
          <div className="space-y-4">
            {session.kind === 'prof' ? (
              <ProfSections prof={session} />
            ) : (
              <p className="rounded-2xl border border-ink-850 bg-ink-900 p-4 text-sm text-ink-300">
                Vos identifiants d’administration sont définis dans infra/.env (PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD) ; les modifier ici serait annulé au redémarrage du serveur.
              </p>
            )}
            <Button onClick={() => { logout(); window.location.replace('/login/') }}>Se déconnecter</Button>
          </div>
        </AppShell>
      )}
    </Protected>
  )
}
