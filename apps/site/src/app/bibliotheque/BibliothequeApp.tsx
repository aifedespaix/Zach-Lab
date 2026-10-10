import { useEffect, useState } from 'react'
import { FilePlus2, Files, FolderTree, GitCompareArrows, ScrollText } from 'lucide-react'
import { LibraryView } from './components/LibraryView'
import { NewMapView } from './components/NewMapView'
import { ConflictsView } from './components/ConflictsView'
import { DuplicatesView } from './components/DuplicatesView'
import { LogsView } from './components/LogsView'
import { currentUser } from './lib/pb'
import { openConflictCount, useLibrary } from './state/useLibrary'
import { Badge } from '@/ui/primitives'
import { Protected } from '../shell/Protected'
import { AppShell } from '../shell/AppShell'

/**
 * La coque : qui est connecté, et quel onglet est ouvert.
 *
 * La navigation passe par le FRAGMENT de l'URL (`#/conflits`) et non par
 * l'historique. Ce n'est pas une économie de bibliothèque, c'est une propriété
 * de déploiement : le SPA est servi par PocketBase depuis `/pb_public`, et un
 * chemin réel (`/conflits`) dépendrait de la façon dont ce serveur traite une
 * URL inconnue. Un fragment n'atteint jamais le serveur — il marche partout, y
 * compris derrière un sous-chemin, et le bouton « retour » du téléphone
 * fonctionne quand même.
 */
const TABS = [
  { id: 'fichiers', label: 'Fichiers', icon: FolderTree },
  { id: 'nouvelle', label: 'Nouvelle', icon: FilePlus2 },
  { id: 'conflits', label: 'Conflits', icon: GitCompareArrows },
  { id: 'doublons', label: 'Doublons', icon: Files },
  { id: 'journal', label: 'Journal', icon: ScrollText },
] as const

type TabId = (typeof TABS)[number]['id']

function tabFromHash(): TabId {
  const raw = window.location.hash.replace(/^#\/?/, '')
  return TABS.some(tab => tab.id === raw) ? (raw as TabId) : 'fichiers'
}

/** La page est derrière `Protected` : seul un prof arrive jusqu'au contenu. */
export function BibliothequeApp() {
  return (
    <Protected page="bibliotheque">
      {session => (
        <AppShell session={session} page="bibliotheque" title="Bibliothèque">
          <Bibliotheque />
        </AppShell>
      )}
    </Protected>
  )
}

function Bibliotheque() {
  // Calculé une fois : la session ne change pas pendant la vie de la page
  // (se déconnecter recharge vers /login/).
  const [user] = useState(currentUser)
  const [tab, setTab] = useState<TabId>(tabFromHash)
  const { conflicts, refreshAll } = useLibrary()

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (user === null) return
    void refreshAll()
  }, [user, refreshAll])

  // Protected garantit un prof ; si le magasin dit autre chose, ne rien rendre
  // vaut mieux qu'un écran dont chaque bouton répondrait « 403 ».
  if (user === null) return null

  const openConflicts = openConflictCount(conflicts)

  return (
    <div className="flex flex-col gap-4">
      {/* Les onglets sont en haut, à toutes les largeurs : la barre du bas
          appartient maintenant à la navigation du site. */}
      <nav aria-label="Onglets de la bibliothèque" className="flex border-b border-ink-850">
        {TABS.map(entry => {
          const Icon = entry.icon
          const active = tab === entry.id
          return (
            <a
              key={entry.id}
              href={`#/${entry.id}`}
              aria-current={active ? 'page' : undefined}
              className={`tap relative flex flex-1 flex-col items-center justify-center gap-0.5 pb-2 text-[11px] transition-colors ${
                active ? 'text-accent' : 'text-ink-500'
              }`}
            >
              <Icon size={20} />
              {entry.label}
              {entry.id === 'conflits' && openConflicts > 0 && (
                <span className="absolute right-[22%] top-0">
                  <Badge tone="danger">{openConflicts}</Badge>
                </span>
              )}
            </a>
          )
        })}
      </nav>

      {/* Chaque onglet garde son état monté : revenir aux fichiers depuis les
          conflits ne doit pas replier l'arbre ni reperdre une recherche en
          cours — c'est l'aller-retour le plus fréquent de tout l'outil. */}
      <div className="min-h-0 flex-1">
        <Pane active={tab === 'fichiers'}>
          <LibraryView user={user} />
        </Pane>
        <Pane active={tab === 'nouvelle'}>
          <NewMapView user={user} />
        </Pane>
        <Pane active={tab === 'conflits'}>
          <ConflictsView user={user} />
        </Pane>
        <Pane active={tab === 'doublons'}>
          <DuplicatesView />
        </Pane>
        <Pane active={tab === 'journal'}>
          <LogsView />
        </Pane>
      </div>
    </div>
  )
}

/**
 * Un onglet monté en permanence, masqué quand il n'est pas actif.
 *
 * `hidden` plutôt que `display: none` en style : c'est l'attribut que le
 * lecteur d'écran comprend comme « pas là », alors qu'un panneau seulement
 * invisible resterait dans l'ordre de lecture et dans celui de la tabulation.
 */
function Pane({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div hidden={!active} className="h-full">
      {children}
    </div>
  )
}
