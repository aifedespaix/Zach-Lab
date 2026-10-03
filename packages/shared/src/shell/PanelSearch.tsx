import { useEffect, useRef, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '../ui'

interface PanelSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** The field's accessible name, e.g. « Rechercher un exercice ». */
  ariaLabel: string
  /** Bump it (> 0) to put the caret in the field and select its text — a shortcut's job. */
  focusRequest?: number
  /** A control sitting to the right of the field, e.g. a type filter. */
  trailing?: ReactNode
}

/**
 * The search field at the top of a side panel, full width.
 *
 * Controlled: what the field holds is a VIEW over the panel's content and the app decides what
 * that means. Escape clears and hands the keyboard back without a second gesture.
 */
export function PanelSearch({ value, onChange, placeholder = 'Rechercher…', ariaLabel, focusRequest = 0, trailing }: PanelSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusRequest === 0) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusRequest])

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <Search size={13} style={{ position: 'absolute', left: 7, color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
        <input
          ref={inputRef}
          className="panel-search"
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Escape') return
            onChange('')
            event.currentTarget.blur()
          }}
          style={{ paddingLeft: 24, paddingRight: value === '' ? 8 : 26 }}
        />
        {value !== '' && (
          <Button variant="ghost" size="icon-sm" aria-label="Effacer la recherche" onClick={() => onChange('')} style={{ position: 'absolute', right: 2 }}>
            <X size={13} />
          </Button>
        )}
      </div>
      {trailing}
    </div>
  )
}
