import { useEffect, useState } from 'react'
import { BrainCircuit, LogIn } from 'lucide-react'
import { currentSession, loginAny, LoginError } from '../session/session'
import { guard, homeFor } from '../session/guards'
import { Button, Field, inputClass } from '@/ui/primitives'

/**
 * L'écran de connexion unique du site : l'admin (courriel) et les profs (pseudo)
 * y entrent par la même porte, chacun est envoyé vers son accueil. Un compte
 * élève est refusé par `loginAny`, qui l'a déjà déconnecté : ici on n'affiche
 * que le message.
 */
export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Déjà connecté : inutile de montrer le formulaire.
  useEffect(() => {
    const target = guard(currentSession(), 'login')
    if (target !== null) window.location.replace(target)
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const session = await loginAny(username, password)
      window.location.replace(homeFor(session))
    } catch (caught) {
      setError(caught instanceof LoginError ? caught.message : 'La connexion a échoué.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft/30 text-accent">
            <BrainCircuit size={28} />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Zachar’t Mentale</h1>
            <p className="mt-0.5 text-sm text-ink-500">Espace professeur</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Identifiant">
            <input
              value={username}
              onChange={event => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
              className={inputClass}
            />
          </Field>

          <Field label="Mot de passe" error={error}>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </Field>

          <Button tone="primary" type="submit" disabled={busy} className="mt-1">
            <LogIn size={16} />
            {busy ? 'Connexion…' : 'Se connecter'}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          <a href="/inscription/" className="text-accent hover:underline">J’ai un code</a>
        </p>
      </form>
    </div>
  )
}
