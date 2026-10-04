import { Plus } from 'lucide-react'
import { Button } from '../ui'

/**
 * The discreet « + » at the foot of a block of lines or steps: the mouse's Enter. There is ONE per
 * block, under the last line — never one per line — so the rows stay as clean as a notebook's.
 *
 * `onMouseDown` keeps the caret where it is until the click lands: the new line then takes the focus
 * from the app's own logic, not from a button that stole it.
 */
export function AddLineButton({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onMouseDown={event => event.preventDefault()}
      onClick={onAdd}
      style={{ alignSelf: 'flex-start', opacity: 0.45, height: 22, width: 22 }}
      className="hover:opacity-100 focus-visible:opacity-100"
    >
      <Plus size={14} />
    </Button>
  )
}
