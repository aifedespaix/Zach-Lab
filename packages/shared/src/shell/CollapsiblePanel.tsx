import type { ReactNode } from 'react'
import { useCommand } from '../commands'
import { CollapsedRail } from './CollapsedRail'
import type { PanelWidthStorage } from './panelWidth'
import { ResizablePanel } from './ResizablePanel'
import { usePanelCollapsed } from './usePanelCollapsed'
import type { PanelSide } from './usePanelResize'

interface CollapsiblePanelProps {
  side: PanelSide
  /** The region's accessible name. */
  label: string
  resizeLabel?: string
  storage: PanelWidthStorage
  /** `localStorage` key of the folded state. */
  collapsedKey: string
  /** The app's command id that folds and unfolds this panel. */
  toggleCommand: string
  /** The contextual label while open / folded, e.g. « Replier l'arborescence » / « Déplier l'arborescence ». */
  foldLabel: string
  unfoldLabel: string
  children?: ReactNode
}

/**
 * A `ResizablePanel` that can be folded to a 32px rail and brought back.
 *
 * The command is registered BEFORE the folded early-return: folding the panel away must not take
 * the very shortcut that unfolds it. The panel's width needs no care here — `ResizablePanel`
 * saves it as it changes and reads it back when it mounts again.
 *
 * The app puts its own fold button in the panel's header with `toggleCommand`; the folded rail
 * carries the unfold one.
 */
export function CollapsiblePanel({
  side,
  label,
  resizeLabel,
  storage,
  collapsedKey,
  toggleCommand,
  foldLabel,
  unfoldLabel,
  children,
}: CollapsiblePanelProps) {
  const [collapsed, setCollapsed] = usePanelCollapsed(collapsedKey)
  useCommand(toggleCommand, () => setCollapsed(current => !current), true, collapsed ? unfoldLabel : foldLabel)

  if (collapsed) return <CollapsedRail side={side} command={toggleCommand} label={unfoldLabel} />
  return (
    <ResizablePanel side={side} label={label} resizeLabel={resizeLabel} storage={storage}>
      {children}
    </ResizablePanel>
  )
}
