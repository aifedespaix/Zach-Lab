import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

/**
 * A hint on an icon-only control, through the app's own Tooltip rather than a
 * native `title`.
 *
 * `title` is the wrong instrument for these. It appears only after roughly a
 * second, cannot be styled, and — the part that matters — never appears on
 * keyboard focus, so the only users who ever got the explanation were the ones
 * already holding a pointer. The Radix tooltip opens on focus as well as hover.
 *
 * Without a `label` it renders its child untouched.
 *
 * The control's own `aria-label` stays and is NOT replaced by this: a tooltip is
 * not an accessible name, and the two answer different questions — the label
 * says what the control is, the hint says what it will do.
 *
 * Each hint brings its own `TooltipProvider`, so it works anywhere with no setup (a hint
 * rendered without a provider above it would throw). Providers only matter for the
 * skip-delay between neighbouring tooltips, and ours open with no delay at all, so there is
 * nothing to skip and nothing that could flicker.
 *
 * `z-[60]` rather than the shared `z-50`: these hints live inside dialogs and
 * panels that already sit at `zIndex: 50`, so an equally-ranked tooltip would be
 * on top only by virtue of being appended to `document.body` afterwards. That
 * holds today and would stop holding the moment another portal joins in.
 *
 * Known limitation, and it is Radix's rather than ours: a `<button disabled>`
 * receives no pointer events, so it shows no hint. Its `aria-label` and its
 * disabled state are still announced, so the control is explained — just not by
 * this.
 */
export function Hint({ label, children }: { label?: string; children: ReactNode }) {
  // Sans texte, rien à dire : le contrôle reste tel quel (touches dont le libellé se suffit, fichiers sains…).
  if (label === undefined || label === '') return <>{children}</>
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="z-[60]">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
