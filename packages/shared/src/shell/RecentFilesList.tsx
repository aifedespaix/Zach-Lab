import { FileJson } from 'lucide-react'
import { formatRelativeTime } from '../lib/relativeTime'

export interface RecentItem { path: string; name: string; folder: string; openedAt: string }

/**
 * Les raccourcis de réouverture de l'écran vide. Le dossier parent accompagne chaque titre : deux
 * fichiers du même nom dans deux dossiers restent discernables sans afficher le chemin entier.
 * Purement présentationnel : l'app dit quoi afficher, et peut greffer un badge (`adornment`) ou un
 * menu (`wrap`) sans que ce composant connaisse son stockage.
 */
export function RecentFilesList({ title, items, onOpen, adornment, wrap }: {
  title: string
  items: readonly RecentItem[]
  onOpen: (path: string) => void
  /** Du contenu en plus dans la rangée (badge…), entre le nom et l'heure. */
  adornment?: (item: RecentItem) => React.ReactNode
  /** Enveloppe le bouton de la rangée (menu clic droit…). */
  wrap?: (item: RecentItem, row: React.ReactElement) => React.ReactNode
}) {
  if (items.length === 0) return null
  return (
    <div className="recent-files">
      <div className="recent-files__title">{title}</div>
      <ul className="recent-files__list">
        {items.map(item => {
          const row = (
            <button type="button" className="recent-files__row" onClick={() => onOpen(item.path)}>
              <FileJson size={16} className="recent-files__icon" aria-hidden="true" />
              <span className="recent-files__text">
                <span className="recent-files__name">{item.name}</span>
                <span className="recent-files__folder">{item.folder}</span>
              </span>
              {adornment?.(item)}
              <span className="recent-files__time">{formatRelativeTime(item.openedAt)}</span>
            </button>
          )
          return <li key={item.path}>{wrap === undefined ? row : wrap(item, row)}</li>
        })}
      </ul>
    </div>
  )
}
