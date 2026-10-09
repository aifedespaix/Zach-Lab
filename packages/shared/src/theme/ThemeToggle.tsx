import { Moon, Sun } from 'lucide-react'
import { Button } from '../ui'
import { useResolvedTheme } from './useResolvedTheme'
import { useToggleTheme } from './useToggleTheme'

/** The light/dark button; the reveal opens from the pointer. */
export function ThemeToggle({ label = 'Basculer le thème' }: { label?: string }) {
  const toggle = useToggleTheme()
  const Icon = useResolvedTheme() === 'dark' ? Sun : Moon
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={event => toggle(event)}>
      <Icon aria-hidden />
    </Button>
  )
}
