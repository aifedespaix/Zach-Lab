import { useEffect, useState, type ReactNode } from 'react'
import { BootScreen } from './BootScreen'

interface AppBootProps {
  /** The app has what it needs to show itself (its workspace is loaded). */
  ready: boolean
  /** The mark stays at least this long, even when the disk answers at once: it gets to be written once. */
  floorMs: number
  /** The app's mark, typically an `AnimatedMark`. */
  children: ReactNode
}

/** The loading cover: up until `ready` AND the floor has elapsed, whichever comes last. */
export function AppBoot({ ready, floorMs, children }: AppBootProps) {
  const [floorElapsed, setFloorElapsed] = useState(floorMs <= 0)
  useEffect(() => {
    if (floorMs <= 0) return
    const timer = setTimeout(() => setFloorElapsed(true), floorMs)
    return () => clearTimeout(timer)
  }, [floorMs])
  if (ready && floorElapsed) return null
  return <BootScreen>{children}</BootScreen>
}
