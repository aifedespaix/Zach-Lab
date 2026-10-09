import { Minus, Plus } from 'lucide-react'
import { CommandButton } from '../commands'
import { Hint } from '../ui'
import { useUiZoom } from './hooks'

/** − · « 100 % » (click = back to 100 %) · + — for the `view` zone of the bar. */
export function ZoomControls() {
  const { percent, reset } = useUiZoom()
  return (
    <div role="group" aria-label="Zoom" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <CommandButton command="view.zoomOut" icon={Minus} variant="ghost" size="icon-sm" />
      <Hint label="Remettre le zoom à 100 %">
        <button
          type="button"
          aria-label="Zoom à 100 %"
          onClick={reset}
          style={{ minWidth: 44, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
        >
          {percent} %
        </button>
      </Hint>
      <CommandButton command="view.zoomIn" icon={Plus} variant="ghost" size="icon-sm" />
    </div>
  )
}
