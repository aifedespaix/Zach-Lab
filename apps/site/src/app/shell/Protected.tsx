import { useEffect, useState, type ReactNode } from 'react'
import { currentSession, type PageId, type Session } from '../session/session'
import { guard } from '../session/guards'

/**
 * Ne rend rien tant que la session n'est pas jugée suffisante pour la page, et
 * redirige sinon. Les îlots sont rendus côté client uniquement : `currentSession`
 * lit le `localStorage`, qui n'existe pas à la construction.
 */
export function Protected({ page, children }: { page: PageId; children: (session: Session) => ReactNode }) {
  const [session] = useState(currentSession)
  const target = guard(session, page)

  useEffect(() => {
    if (target !== null) window.location.replace(target)
  }, [target])

  if (target !== null || session === null) return null
  return <>{children(session)}</>
}
