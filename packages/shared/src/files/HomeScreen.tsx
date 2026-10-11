import type { ReactElement, ReactNode } from 'react'
import { AnimatedMark, type MarkConfig } from '../shell/AnimatedMark'
import { RecentFilesList, type RecentItem } from '../shell/RecentFilesList'

export interface HomeScreenProps {
  /** La marque de l'app, animée en attente (« rien d'ouvert »). */
  mark: MarkConfig
  /** La consigne : « Sélectionnez ou créez un fichier… », dite par l'app. */
  message: string
  /** Titre de la liste des fichiers récents. */
  recentTitle: string
  recent: readonly RecentItem[]
  onOpen: (path: string) => void
  /** Un badge ou un menu par rangée, comme `RecentFilesList`. */
  adornment?: (item: RecentItem) => ReactNode
  wrap?: (item: RecentItem, row: ReactElement) => ReactNode
  /** Actions propres à l'app sous la consigne (« Créer un fichier »…). */
  children?: ReactNode
}

/**
 * L'écran vide : rien d'ouvert. La marque respire, la consigne dit quoi faire, les récents
 * permettent de reprendre, et l'app glisse ses actions en enfants. Aucun stockage ici.
 */
export function HomeScreen({ mark, message, recentTitle, recent, onOpen, adornment, wrap, children }: HomeScreenProps) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <AnimatedMark mark={mark} mode="draw-pulse" size={recent.length > 0 ? 120 : 160} />
      <p style={{ margin: 0, maxWidth: 380, color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.5 }}>{message}</p>
      {children}
      <RecentFilesList title={recentTitle} items={recent} onOpen={onOpen} adornment={adornment} wrap={wrap} />
    </div>
  )
}
