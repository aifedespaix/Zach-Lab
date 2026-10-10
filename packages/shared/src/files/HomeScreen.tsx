import type { ReactNode } from 'react'
import { AnimatedMark, RecentFilesList, type MarkConfig, type RecentItem } from '../shell'

/** The screen with no file open: the pulsing mark, the instruction, the recent files, and the app's own slot. */
export function HomeScreen({ mark, instruction, recentTitle = 'Fichiers récents', recent, onOpen, children }: {
  mark: MarkConfig
  instruction: string
  recentTitle?: string
  recent: readonly RecentItem[]
  onOpen: (path: string) => void
  /** Under the list: a button, a dropped-file hint… */
  children?: ReactNode
}) {
  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 }}>
      <AnimatedMark mark={mark} mode="draw-pulse" size={96} />
      <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>{instruction}</p>
      <RecentFilesList title={recentTitle} items={recent} onOpen={onOpen} />
      {children}
    </main>
  )
}

/** A recent file as `RecentFilesList` shows it: its name and its parent folder. */
export function recentItem(file: { path: string; openedAt: string }): RecentItem {
  const parts = file.path.split(/[\\/]/).filter(Boolean)
  return { path: file.path, name: parts[parts.length - 1] ?? file.path, folder: parts[parts.length - 2] ?? '', openedAt: file.openedAt }
}
