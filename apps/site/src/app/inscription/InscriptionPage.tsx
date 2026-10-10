import { useEffect, useState } from 'react'
import { BrainCircuit, UserPlus } from 'lucide-react'
import { currentSession, loginAny, LoginError } from '../session/session'
import { guard } from '../session/guards'
import { codeFromSearch, validateSignup } from './validateSignup'
import { Button, Field, inputClass } from '@/ui/primitives'

type Errors = Partial<Record<'code' | 'username' | 'password' | 'confirm' | 'form', string>>

/** Le message affiché pour une réponse d'échec du serveur (jamais le corps brut s'il n'a pas de `message`). */
async function failureMessage(response: Response): Promise<string> {
  if (response.status === 429) return 'Trop de tentatives. Réessayez dans une minute.'
  const fallback = `L’inscription a échoué (erreur ${response.status}).`
  if (response.status !== 400) return fallback
  try {
    const body = (await response.json()) as { message?: unknown }
    return typeof body.message === 'string' && body.message !== '' ? body.message : fallback
  } catch {
    return fallback
  }
}

/**
 * Création d'un compte professeur à partir d'un code d'invitation.
 * Le serveur re-vérifie tout ; la validation locale ne sert qu'à éviter
 * un aller-retour pour une faute de frappe. Le mot de passe ne quitte
 * jamais le corps de la requête : ni journal, ni URL.
 */
export function InscriptionPage() {
  const [code, setCode] = useState(() => codeFromSearch(window.location.search))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const target = guard(currentSession(), 'inscription')
    if (target !== null) window.location.replace(target)
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    const result = validateSignup({ code, username, password, confirm })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      const response = await fetch('/api/inscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(result.value),
      })
      if (response.status !== 200) {
        const message = await failureMessage(response)
        setErrors(message.includes('Code') ? { code: message } : { form: message })
        setBusy(false)
        return
      }
      await loginAny(result.value.username, result.value.password)
      window.location.replace('/dashboard/')
    } catch (caught) {
      // Le compte existe peut-être déjà : on renvoie vers la connexion plutôt que de réessayer l'inscription.
      setErrors({
        form: caught instanceof LoginError
          ? `Compte créé, mais la connexion a échoué : ${caught.message}`
          : 'Serveur injoignable. Vérifiez votre connexion.',
      })
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm" noValidate>
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft/30 text-accent">
            <BrainCircuit size={28} />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Créer un compte</h1>
            <p className="mt-0.5 text-sm text-ink-500">Avec le code reçu de l’administrateur</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {errors.form !== undefined && (
            <p role="alert" className="rounded-xl bg-danger/15 px-3.5 py-3 text-sm text-danger">{errors.form}</p>
          )}

          <Field label="Code d’inscription" error={errors.code}>
            <input
              value={code}
              onChange={event => setCode(event.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field label="Identifiant" error={errors.username}>
            <input
              value={username}
              onChange={event => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
          </Field>

          <Field label="Mot de passe" error={errors.password}>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>

          <Field label="Confirmer le mot de passe" error={errors.confirm}>
            <input
              type="password"
              value={confirm}
              onChange={event => setConfirm(event.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>

          <Button tone="primary" type="submit" disabled={busy} className="mt-1">
            <UserPlus size={16} />
            {busy ? 'Création…' : 'Créer mon compte'}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          <a href="/login/" className="text-accent hover:underline">J’ai déjà un compte</a>
        </p>
      </form>
    </div>
  )
}
