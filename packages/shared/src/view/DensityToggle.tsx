import { Rows3 } from 'lucide-react'
import { CommandButton } from '../commands'
import { useDensity } from './hooks'

/** The condensed-mode button of the bar: lit while condensed. */
export function DensityToggle() {
  const { compact } = useDensity()
  return (
    <CommandButton
      command="view.toggleDensity"
      icon={Rows3}
      variant="ghost"
      size="icon-sm"
      pressed={compact}
      className={compact ? 'toggle-on' : undefined}
    />
  )
}
