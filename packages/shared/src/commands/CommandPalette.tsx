import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui'
import { ShortcutHint } from './ShortcutHint'
import { categoryLabel, commandList } from './catalog'
import { useCommandRegistry } from './useCommandRegistry'
import { useShortcutSettingsStore } from './useShortcutSettingsStore'
import { runCommand } from './useCommand'
import { rankCommandsByText, type CommandRanker } from './rankCommandsByText'

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * How a query is matched against the commands. Defaults to a plain
   * accent-insensitive substring match; an app with a real search engine
   * plugs it in here.
   */
  rank?: CommandRanker
}

/**
 * Search every action the app can perform, and run it.
 *
 * The catalogue is already the single source of truth for labels, descriptions
 * and bindings, so this is mostly a view onto it — which also makes it the
 * fastest way to DISCOVER a shortcut: find the action by name, read the key
 * printed beside it, and next time skip the palette.
 *
 * Disabled commands stay listed rather than being hidden. « Coller la carte »
 * missing from the list looks like a missing feature; « Coller la carte »
 * greyed out says the clipboard is empty.
 */
export function CommandPalette({ open, onOpenChange, rank = rankCommandsByText }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const registrations = useCommandRegistry(state => state.registrations)
  const bindings = useShortcutSettingsStore(state => state.bindings)
  const listRef = useRef<HTMLUListElement>(null)

  // Every opening starts from an empty query: a palette that remembers the last
  // search makes the first keystroke of the next one land in the wrong place.
  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlighted(0)
    }
  }, [open])

  const results = useMemo(() => {
    return rank(query, commandList())
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score
        // Available actions first on an equal match: what you can do now is
        // almost always what you were looking for.
        const aEnabled = registrations[a.command.id]?.enabled === true
        const bEnabled = registrations[b.command.id]?.enabled === true
        if (aEnabled !== bEnabled) return aEnabled ? -1 : 1
        return 0
      })
      .map(entry => entry.command)
  }, [query, registrations, rank])

  const active = results[Math.min(highlighted, results.length - 1)]

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-highlighted="true"]')
    // Called optionally: keyboard navigation must not depend on an engine
    // implementing scrolling — jsdom, for one, does not.
    if (active instanceof HTMLElement) active.scrollIntoView?.({ block: 'nearest' })
  }, [highlighted, query])

  function launch(id: string) {
    onOpenChange(false)
    // After the dialog closes, for the same focus reason the menus defer: a
    // command that opens another dialog would otherwise fight this one's
    // closing focus restore.
    setTimeout(() => runCommand(id), 0)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl grid-rows-[auto_minmax(0,1fr)] max-h-[70vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Palette de commandes</DialogTitle>
          <DialogDescription>
            Cherche une action par son nom. Le raccourci correspondant est indiqué à droite.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 10 }}>
          <input
            autoFocus
            aria-label="Rechercher une commande"
            value={query}
            onChange={event => {
              setQuery(event.target.value)
              setHighlighted(0)
            }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setHighlighted(index => Math.min(index + 1, results.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setHighlighted(index => Math.max(index - 1, 0))
              } else if (event.key === 'Enter' && active !== undefined) {
                event.preventDefault()
                if (registrations[active.id]?.enabled === true) launch(active.id)
              }
            }}
            placeholder="Renommer, exporter, zoom…"
            style={{
              width: '100%',
              padding: '9px 11px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'inherit',
              fontSize: 14,
            }}
          />

          <ul
            ref={listRef}
            role="listbox"
            aria-label="Commandes"
            style={{ listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', minHeight: 0 }}
          >
            {results.length === 0 && (
              <li style={{ padding: '12px 4px', fontSize: 13, color: 'var(--muted-foreground)' }}>
                Aucune commande ne correspond à « {query} ».
              </li>
            )}
            {results.map((command, index) => {
              const enabled = registrations[command.id]?.enabled === true
              const isActive = command === active
              return (
                <li key={command.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-highlighted={isActive}
                    disabled={!enabled}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => launch(command.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid transparent',
                      background: isActive ? 'var(--muted)' : 'transparent',
                      borderColor: isActive ? 'var(--border)' : 'transparent',
                      color: 'inherit',
                      opacity: enabled ? 1 : 0.45,
                      cursor: enabled ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
                        {registrations[command.id]?.label ?? command.label}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 11.5,
                          color: 'var(--muted-foreground)',
                          marginTop: 1,
                        }}
                      >
                        {categoryLabel(command.category)} · {command.description}
                      </span>
                    </span>
                    <ShortcutHint binding={bindings[command.id]} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
