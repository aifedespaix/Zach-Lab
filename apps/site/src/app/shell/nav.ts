import type { PageId, Session } from '../session/session'

export interface NavItem {
  id: PageId
  label: string
  href: string
}

const ITEMS: Record<'gestion' | 'dashboard' | 'eleves' | 'bibliotheque' | 'compte', NavItem> = {
  gestion: { id: 'gestion', label: 'Gestion', href: '/gestion/' },
  dashboard: { id: 'dashboard', label: 'Tableau de bord', href: '/dashboard/' },
  eleves: { id: 'eleves', label: 'Élèves', href: '/eleves/' },
  bibliotheque: { id: 'bibliotheque', label: 'Bibliothèque', href: '/bibliotheque/' },
  compte: { id: 'compte', label: 'Compte', href: '/compte/' },
}

export function navFor(session: Session): NavItem[] {
  if (session.kind === 'admin') return [ITEMS.gestion, ITEMS.dashboard, ITEMS.compte]
  if (session.kind === 'prof') return [ITEMS.dashboard, ITEMS.eleves, ITEMS.bibliotheque, ITEMS.compte]
  return []
}
