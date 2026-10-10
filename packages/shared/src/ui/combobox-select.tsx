"use client"

import * as React from "react"
import { cn } from "cn"
import { Popover as PopoverPrimitive } from "radix-ui"

import { filterOptions, foldText, type ComboboxOption } from "./combobox-filter"

export type { ComboboxOption } from "./combobox-filter"

interface ComboboxCreate<T extends string> {
  /** The row offered when the typed text matches no option exactly. */
  label: (query: string) => string
  /** The value a typed name stands for. */
  toValue: (query: string) => T
}

interface ComboboxSelectProps<T extends string> {
  options: ComboboxOption<T>[]
  value: T | null
  onChange: (value: T) => void
  placeholder?: string
  /** Shown when the filter leaves nothing. */
  emptyText?: string
  ariaLabel: string
  /**
   * Lets the field take a name that is not in the list: typing calls `onChange`
   * with `toValue(text)` as you go, and a row offers to create it.
   */
  creatable?: ComboboxCreate<T>
  className?: string
}

type Row<T extends string> = { option: ComboboxOption<T>; create: boolean }

/**
 * A select you can type in: the field shows the chosen option, typing filters
 * the list (accent- and case-insensitive, on the full path when options carry
 * one). The list is portalled, so it opens above a modal's own scroll area, and
 * Escape closes it before it closes the modal.
 */
export function ComboboxSelect<T extends string>({
  options,
  value,
  onChange,
  placeholder,
  emptyText = "Aucun résultat",
  ariaLabel,
  creatable,
  className,
}: ComboboxSelectProps<T>) {
  const id = React.useId()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const [open, setOpen] = React.useState(false)
  // `null`: the field shows the chosen option; a string: the user is typing.
  const [query, setQuery] = React.useState<string | null>(null)
  const [active, setActive] = React.useState(0)

  const selected = options.find(option => option.value === value)
  const shown = query ?? selected?.label ?? value ?? ""
  const typed = query ?? ""

  const rows = React.useMemo<Row<T>[]>(() => {
    const matches = filterOptions(options, typed).map(option => ({ option, create: false }))
    if (creatable === undefined || typed.trim() === "") return matches
    const name = typed.trim()
    if (options.some(option => foldText(option.label) === foldText(name))) return matches
    return [...matches, { option: { value: creatable.toValue(name), label: creatable.label(name) }, create: true }]
  }, [options, typed, creatable])

  const indent = typed.trim() === ""

  // The chosen option is the one highlighted when the list opens on it.
  const openList = () => {
    if (open) return
    const at = rows.findIndex(row => row.option.value === value)
    setActive(Math.max(at, 0))
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setQuery(null)
  }

  const pick = (row: Row<T> | undefined) => {
    if (row === undefined) return
    onChange(row.option.value)
    close()
  }

  React.useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-active="true"]`)?.scrollIntoView?.({ block: "nearest" })
  }, [open, active])

  const move = (to: number) => setActive(Math.min(Math.max(to, 0), Math.max(rows.length - 1, 0)))

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        if (!open) openList()
        else move(active + 1)
        break
      case "ArrowUp":
        event.preventDefault()
        if (!open) openList()
        else move(active - 1)
        break
      // Home/End keep their caret meaning once the user is typing a filter.
      case "Home":
        if (open && typed === "") { event.preventDefault(); move(0) }
        break
      case "End":
        if (open && typed === "") { event.preventDefault(); move(rows.length - 1) }
        break
      case "Enter":
        if (open) { event.preventDefault(); pick(rows[active]) }
        break
      case "Escape":
        if (open) { event.preventDefault(); event.stopPropagation(); close() }
        break
    }
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={next => { if (!next) close() }}>
      <PopoverPrimitive.Anchor asChild>
        <input
          ref={inputRef}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && rows[active] !== undefined ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={shown}
          onChange={event => {
            const text = event.target.value
            setQuery(text)
            setActive(0)
            setOpen(true)
            if (creatable !== undefined) onChange(creatable.toValue(text.trim()))
          }}
          onFocus={event => event.currentTarget.select()}
          onKeyDown={onKeyDown}
          onBlur={() => { if (!open) setQuery(null) }}
          data-slot="combobox-select"
          className={cn(
            "w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            className
          )}
        />
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          // The field keeps the focus: the list is only ever driven from it.
          onOpenAutoFocus={event => event.preventDefault()}
          onCloseAutoFocus={event => event.preventDefault()}
          onInteractOutside={event => {
            if (inputRef.current?.contains(event.target as Node)) event.preventDefault()
          }}
          // Same width as the field, so the list stays under it inside a modal.
          style={{ width: "var(--radix-popover-trigger-width)" }}
          className="z-[60] max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={ariaLabel} style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {rows.map((row, index) => (
              <li
                key={`${row.create}:${row.option.value}`}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={row.option.value === value && !row.create}
                data-active={index === active}
                // `mousedown`: before the field loses the focus and the list closes.
                onMouseDown={event => { event.preventDefault(); pick(row) }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer items-baseline gap-2 rounded-sm px-2 py-1.5 text-sm",
                  index === active && "bg-accent text-accent-foreground"
                )}
                style={{ paddingLeft: indent && !row.create ? 8 + (row.option.depth ?? 0) * 14 : undefined }}
              >
                <span className="min-w-0 truncate">{row.option.label}</span>
                {!row.create && !indent && row.option.detail !== undefined && row.option.detail !== row.option.label && (
                  <span className="min-w-0 truncate text-xs text-muted-foreground">{row.option.detail}</span>
                )}
              </li>
            ))}
            {rows.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">{emptyText}</li>}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
