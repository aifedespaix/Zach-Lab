import { useCallback, useEffect, useState } from 'react'
import { describeApiError, listCodes, listUsers } from './api'
import type { CodeRow, UserRow } from './summaries'

interface State { users: UserRow[]; codes: CodeRow[]; loading: boolean; error: string | null }

/** Charge comptes et codes ensemble : les codes affichent leurs inscrits, il faut les deux à jour. */
export function useGestion(): State & { reload(): Promise<void> } {
  const [state, setState] = useState<State>({ users: [], codes: [], loading: true, error: null })
  const reload = useCallback(async () => {
    try {
      const [users, codes] = await Promise.all([listUsers(), listCodes()])
      setState({ users, codes, loading: false, error: null })
    } catch (e) {
      // On garde les anciennes données : une panne passagère ne doit pas vider l'écran.
      setState(s => ({ ...s, loading: false, error: describeApiError(e) }))
    }
  }, [])
  useEffect(() => { void reload() }, [reload])
  return { ...state, reload }
}
