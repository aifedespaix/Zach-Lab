import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Ellipsis } from 'lucide-react'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, Hint } from '../ui'

export interface OverflowItem {
  id: string
  /** What the bar shows when there is room. */
  node: ReactNode
  /** What the « … » menu shows instead when there is not (usually `CommandDropdownItem`s). */
  menu: ReactNode
  /** Higher stays on the bar longer. Default 0; ties fall on the later items first. */
  priority?: number
}

/**
 * Which items stay on the bar. Pure, so the rule is testable without a layout engine.
 *
 * Everything fits: all of them. Otherwise the « … » button takes its own room and
 * the lowest-priority items (the later ones among equals) leave one by one until
 * the rest fit. An unmeasured bar (`available <= 0`, e.g. jsdom) keeps everything.
 */
export function visibleIds(
  items: readonly { id: string; width: number; priority?: number }[],
  available: number,
  gap: number,
  overflowWidth: number,
): Set<string> {
  const all = new Set(items.map(item => item.id))
  if (available <= 0) return all
  const need = (kept: readonly { width: number }[], extra: number) =>
    kept.reduce((sum, item) => sum + item.width, 0) + Math.max(0, kept.length - 1 + extra) * gap + extra * overflowWidth
  if (need(items, 0) <= available) return all
  const kept = [...items]
  const order = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.priority ?? 0) - (b.item.priority ?? 0) || b.index - a.index)
  for (const { item } of order) {
    if (need(kept, 1) <= available || kept.length === 0) break
    kept.splice(kept.indexOf(item), 1)
  }
  return new Set(kept.map(item => item.id))
}

const GAP = 8
const OVERFLOW_WIDTH = 32

/**
 * A toolbar that never overflows its row: what does not fit moves, in order of
 * priority, into a « … » menu that lists the same actions with their shortcuts.
 *
 * Every item is always rendered — the ones that left the bar are only taken out
 * of the flow (`visibility: hidden`, absolute) — so their width stays measurable
 * and they come back by themselves when the window grows.
 */
export function OverflowToolbar({ items, label = 'Plus d’actions' }: { items: readonly OverflowItem[]; label?: string }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const widths = useRef(new Map<string, number>())
  const [available, setAvailable] = useState(0)
  const [, setMeasured] = useState(0)

  const measure = useCallback(() => {
    const row = rowRef.current
    if (row === null) return
    for (const el of row.querySelectorAll<HTMLElement>('[data-overflow-item]')) {
      const width = el.offsetWidth
      if (width > 0) widths.current.set(el.dataset.overflowItem ?? '', width)
    }
    setAvailable(row.clientWidth)
    setMeasured(count => count + 1)
  }, [])

  useLayoutEffect(() => {
    measure()
    const row = rowRef.current
    if (row === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  // Les largeurs ne changent qu'avec la liste : re-mesure quand ses ids changent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, items.map(item => item.id).join('|')])

  const shown = visibleIds(
    items.map(item => ({ id: item.id, width: widths.current.get(item.id) ?? 0, priority: item.priority })),
    available,
    GAP,
    OVERFLOW_WIDTH,
  )
  const hidden = items.filter(item => !shown.has(item.id))

  return (
    <div ref={rowRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: GAP, flex: 1, minWidth: 0 }}>
      {items.map(item => (
        <span
          key={item.id}
          data-overflow-item={item.id}
          style={
            shown.has(item.id)
              ? { display: 'inline-flex', alignItems: 'center', flexShrink: 0 }
              : { display: 'inline-flex', position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }
          }
        >
          {item.node}
        </span>
      ))}
      {hidden.length > 0 && (
        <DropdownMenu>
          <Hint label={label}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={label} style={{ flexShrink: 0 }}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="end">{hidden.map(item => <span key={item.id} style={{ display: 'contents' }}>{item.menu}</span>)}</DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
