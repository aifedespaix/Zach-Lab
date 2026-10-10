import { useState, type ReactNode } from 'react'
import { describeApiError } from './api'

/** Date lisible ; PocketBase écrit « 2026-10-10 12:00:00.000Z » (UTC, espace au lieu du T). */
export function formatDate(value: string, withTime = false): string {
  const date = new Date(value.trim().replace(' ', 'T'))
  if (value === '' || Number.isNaN(date.getTime())) return '—'
  return withTime ? date.toLocaleString('fr-FR') : date.toLocaleDateString('fr-FR')
}

/**
 * Exécute une action puis recharge ; toute erreur devient un message affiché.
 * Une erreur locale (sans `status`, ex. date illisible levée par `createCode`) garde son texte :
 * `describeApiError` la présenterait à tort comme « Serveur injoignable ».
 */
export function useRunner(reload: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setError(null)
    try {
      await action()
      await reload()
      return true
    } catch (e) {
      setError(e instanceof Error && !('status' in e) ? e.message : describeApiError(e))
      return false
    }
  }
  return { error, run, fail: setError }
}

export function InlineError({ message }: { message: string | null }) {
  if (message === null) return null
  return <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-ink-100">{message}</p>
}

/** Un secret (mot de passe, code) n'est montré qu'une fois : il n'est stocké nulle part ailleurs. */
export function SecretNotice({ children }: { children: ReactNode }) {
  return <div role="status" className="space-y-2 rounded-xl border border-accent/40 bg-accent-soft/20 px-4 py-3 text-sm">{children}</div>
}

/** Mot de passe réinitialisé, montré une seule fois. */
export function PasswordNotice({ username, password }: { username: string; password: string }) {
  return (
    <SecretNotice>
      <p>Nouveau mot de passe de <strong>{username}</strong> : <code className="select-all">{password}</code></p>
      <p className="text-ink-500">Notez-le : il ne sera plus affiché.</p>
    </SecretNotice>
  )
}

/** Tableau à partir de `md`, cartes en dessous : deux rendus d'une même ligne, un seul visible. */
export function ResponsiveRows<T>({ items, headers, cells, actions, rowKey }: {
  items: readonly T[]
  headers: readonly string[]
  cells: (item: T) => ReactNode[]
  actions: (item: T) => ReactNode
  rowKey: (item: T) => string
}) {
  return (
    <>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="text-xs text-ink-500">
          <tr>
            {headers.map(h => <th key={h} scope="col" className="px-2 py-2 font-medium">{h}</th>)}
            <th scope="col" className="px-2 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={rowKey(item)} className="border-t border-ink-850 align-top">
              {cells(item).map((cell, i) => <td key={i} className="px-2 py-3">{cell}</td>)}
              <td className="px-2 py-3"><div className="flex flex-wrap items-start gap-2">{actions(item)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="space-y-3 md:hidden">
        {items.map(item => (
          <li key={rowKey(item)} className="space-y-2 rounded-2xl border border-ink-850 bg-ink-900 p-4">
            {cells(item).map((cell, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-xs text-ink-500">{headers[i]}</span>
                <span className="min-w-0 break-words text-right">{cell}</span>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">{actions(item)}</div>
          </li>
        ))}
      </ul>
    </>
  )
}
