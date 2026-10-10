import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ShortcutHint } from '../commands/ShortcutHint'
import { useBinding } from '../commands/useCommand'
import type { LucideIcon } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui'

/** One tab of the window. */
export interface SettingsPanelDef {
  id: string
  label: string
  /** A few words under the label — what the tab is about. */
  hint?: string
  icon: LucideIcon
  /**
   * The command that opens the window on this tab (`settings.open.<id>`, `app.shortcuts`): its LIVE binding
   * is printed on the tab, so a rebinding shows. Left out, or absent from the catalogue, nothing is printed.
   */
  shortcutCommand?: string
  /**
   * The tab's content. `markDirty` tells the window that a setting was edited,
   * so it offers « Enregistrer ». A panel that writes straight into a
   * `SettingsSource` needs no call: see `changedSince`.
   */
  render: (context: { markDirty: () => void }) => ReactNode
}

/**
 * Something the window can preview, save and undo — an app's settings store.
 *
 * Edits reach `restore` LIVE (the panels apply them as drafts, so the app
 * behind the window repaints as a slider moves) but only `commit` writes them
 * to disk.
 */
export interface SettingsSource<T = unknown> {
  /** The current values, taken when the window opens. */
  snapshot: () => T
  /** Puts back a snapshot, preview included. */
  restore: (snapshot: T) => void
  /** Persists whatever is currently applied. */
  commit: () => Promise<void>
  /**
   * For a source a panel writes into directly (a key recorder cannot hand a
   * draft back up through a callback the way a slider can): the window watches
   * it, instead of being told about each edit.
   */
  changedSince?: {
    subscribe: (listener: () => void) => () => void
    isChanged: (snapshot: T) => boolean
  }
}

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  panels: readonly SettingsPanelDef[]
  /**
   * The stores to snapshot on open, restore on cancel and commit on save. `any`:
   * each source is typed by its own snapshot, and the window never looks inside.
   */
  sources?: readonly SettingsSource<any>[]
  /** Which tab the window opens on — a menu entry can land straight on its own. Defaults to the first. */
  initialPanel?: string
  /**
   * Asks for a tab while the window is OPEN (a shortcut of a tab): switches to it, without taking a new
   * snapshot. A new `key` is a new request, so the same tab can be asked for again after clicking away.
   */
  focusPanel?: { id: string; key: number }
  title?: string
  description?: string
}

/** One tab: icon, label, hint, and the live binding of the command that opens it. */
function SettingsTab({ panel, selected, onSelect }: { panel: SettingsPanelDef; selected: boolean; onSelect: () => void }) {
  const { id, label, icon: Icon, hint, shortcutCommand } = panel
  const binding = useBinding(shortcutCommand ?? '')
  return (
    <button
      type="button"
      role="tab"
      id={`settings-tab-${id}`}
      aria-selected={selected}
      aria-controls={`settings-panel-${id}`}
      aria-keyshortcuts={binding ?? undefined}
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textAlign: 'left',
        padding: '9px 11px',
        borderRadius: 10,
        border: '1px solid transparent',
        background: selected ? 'var(--muted)' : 'transparent',
        borderColor: selected ? 'var(--border)' : 'transparent',
        color: selected ? 'inherit' : 'var(--muted-foreground)',
        fontWeight: selected ? 700 : 500,
        cursor: 'pointer',
        transition: 'background 0.12s ease, color 0.12s ease',
      }}
    >
      <Icon size={16} aria-hidden style={{ flexShrink: 0 }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13 }}>{label}</span>
        {hint !== undefined && <span style={{ display: 'block', fontSize: 10.5, opacity: 0.7, fontWeight: 500 }}>{hint}</span>}
      </span>
      {shortcutCommand !== undefined && <ShortcutHint binding={binding} />}
    </button>
  )
}

/**
 * The single settings window of an app: one button in the header, one tab per
 * panel inside.
 *
 * Edits are LIVE but not SAVED. Every change goes straight into the stores
 * through the panels, so the app behind the window repaints as you drag a
 * colour slider — you are choosing against the real thing, not a swatch —
 * while nothing reaches disk until "Enregistrer". "Annuler" replays the
 * snapshot taken when the window opened, which puts the app back exactly as it
 * was, preview included.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  panels,
  sources = [],
  initialPanel,
  focusPanel,
  title = 'Paramètres',
  description = 'Les changements s\'affichent tout de suite. Ils ne sont conservés qu\'après « Enregistrer ».',
}: SettingsDialogProps) {
  const [panelId, setPanelId] = useState<string | undefined>(initialPanel)
  const [dirty, setDirty] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  // Refs, not state: the snapshots are never rendered, and re-rendering on them
  // would be a re-render per open with nothing to show for it. `sources` is read
  // through a ref too — an inline array must not retake the snapshots.
  const sourcesRef = useRef(sources)
  sourcesRef.current = sources
  const snapshots = useRef<unknown[]>([])
  const initialPanelRef = useRef(initialPanel)
  initialPanelRef.current = initialPanel

  // Re-snapshot on every OPEN, not once on mount: the window is reopened many
  // times per session, and a snapshot from the first open would revert edits
  // saved in between — silently undoing work the user had already committed.
  useEffect(() => {
    if (!open) return
    const current = sourcesRef.current
    snapshots.current = current.map(source => source.snapshot())
    setPanelId(initialPanelRef.current)
    setDirty(false)
    setSaveFailed(false)

    // A source that changes on its own is watched only while the window is open.
    const unsubscribers = current.map((source, index) =>
      source.changedSince?.subscribe(() => {
        if (source.changedSince?.isChanged(snapshots.current[index])) setDirty(true)
      }),
    )
    return () => unsubscribers.forEach(unsubscribe => unsubscribe?.())
  }, [open])

  useEffect(() => {
    if (open && focusPanel !== undefined) setPanelId(focusPanel.id)
  }, [open, focusPanel])

  const markDirty = useCallback(() => setDirty(true), [])

  const discard = useCallback(() => {
    sourcesRef.current.forEach((source, index) => source.restore(snapshots.current[index]))
    setDirty(false)
    onOpenChange(false)
  }, [onOpenChange])

  async function save() {
    try {
      await Promise.all(sourcesRef.current.map(source => source.commit()))
    } catch {
      // Stay open and modified: closing on a failed write would look like
      // success, and the edits would be gone at the next launch.
      setSaveFailed(true)
      return
    }
    setSaveFailed(false)
    setDirty(false)
    onOpenChange(false)
  }

  const active = panels.find(panel => panel.id === panelId) ?? panels[0]

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        // Closing by any route other than "Enregistrer" is a cancel, and must
        // undo the live preview — leaving a half-dragged colour applied but
        // unsaved would show one thing now and another after a restart.
        if (!next) discard()
      }}
    >
      <DialogContent
        // A FIXED height, not a max-height: with the tabs sharing one frame,
        // an auto-height dialog grew and shrank as you flipped between a short
        // tab and a long one, so the whole window jumped under the cursor.
        // Pinning it at the 85vh cap keeps every tab the same size and lets the
        // middle row scroll instead.
        className="sm:max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] h-[85vh] overflow-hidden"
        // A stray click on the backdrop must not throw away a page of colour
        // tweaks. Escape and "Annuler" still discard — both are deliberate.
        onPointerDownOutside={event => {
          if (dirty) event.preventDefault()
        }}
        onInteractOutside={event => {
          if (dirty) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', gap: 20, minHeight: 0 }}>
          {active === undefined ? (
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Aucun réglage à afficher.</p>
          ) : (
            <>
              <nav
                role="tablist"
                aria-label="Sections des paramètres"
                aria-orientation="vertical"
                style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 176, flexShrink: 0 }}
              >
                {panels.map(panel => (
                  <SettingsTab key={panel.id} panel={panel} selected={active.id === panel.id} onSelect={() => setPanelId(panel.id)} />
                ))}
              </nav>

              <div
                role="tabpanel"
                id={`settings-panel-${active.id}`}
                aria-labelledby={`settings-tab-${active.id}`}
                tabIndex={0}
                style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingRight: 6 }}
              >
                {active.render({ markDirty })}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
            <span role="status" style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {dirty ? 'Modifications non enregistrées' : 'Tout est enregistré'}
            </span>
            {saveFailed && (
              <span role="alert" style={{ fontSize: 12, color: 'var(--destructive)' }}>
                Impossible d’enregistrer les réglages. Réessaie, ou annule pour revenir en arrière.
              </span>
            )}
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={discard}>
              Annuler
            </Button>
            <Button onClick={save} disabled={!dirty}>
              Enregistrer
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
