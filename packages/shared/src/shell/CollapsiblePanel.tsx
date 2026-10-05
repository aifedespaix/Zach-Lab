import { PanelLeftClose, PanelRightClose } from 'lucide-react'
import type { ReactNode } from 'react'
import { CommandButton, useCommand } from '../commands'
import { CollapsedRail } from './CollapsedRail'
import { PanelFooter, PanelFooterSeparator } from './PanelFooter'
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
  /** The app's own footer actions, shown before the fold button. */
  footer?: ReactNode
  /** What the folded rail says, written vertically — the open sheet and its counts, say. Defaults to `unfoldLabel`. */
  railContent?: ReactNode
  /** Width of the folded rail, 32 by default; a rail whose text may need two columns takes more. */
  railWidth?: number
  children?: ReactNode
}

/**
 * A `ResizablePanel` that folds to a rail and unfolds back, animated.
 *
 * The panel stays mounted when folded (its width animates, the content fades into the rail), so its
 * content is `inert` meanwhile: no focus, no tab stop. The command is registered whatever the state,
 * so the shortcut that folds the panel is the one that unfolds it. The panel's width needs no care
 * here — `ResizablePanel` keeps it while folded.
 *
 * The fold button lives in the panel's footer (after the app's `footer` actions); the folded rail
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
  footer,
  railContent,
  railWidth,
  children,
}: CollapsiblePanelProps) {
  const [collapsed, setCollapsed] = usePanelCollapsed(collapsedKey)
  useCommand(toggleCommand, () => setCollapsed(current => !current), true, collapsed ? unfoldLabel : foldLabel)

  return (
    <ResizablePanel
      side={side}
      label={label}
      resizeLabel={resizeLabel}
      storage={storage}
      collapsed={collapsed}
      railWidth={railWidth}
      rail={
        <CollapsedRail side={side} command={toggleCommand} label={unfoldLabel}>
          {railContent ?? unfoldLabel}
        </CollapsedRail>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>{children}</div>
        <PanelFooter label={`Actions — ${label}`}>
          {footer}
          {footer !== undefined && <PanelFooterSeparator />}
          <span style={{ marginLeft: 'auto' }} aria-hidden />
          <CommandButton
            command={toggleCommand}
            icon={side === 'left' ? PanelLeftClose : PanelRightClose}
            label={foldLabel}
            variant="ghost"
            size="icon-sm"
          />
        </PanelFooter>
      </div>
    </ResizablePanel>
  )
}
