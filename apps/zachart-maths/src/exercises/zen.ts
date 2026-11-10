import { setPanelCollapsed } from '@suite/shared/shell'
import { RIGHT_COLLAPSED_KEY } from '../cours/useCoursesStore'

export const LEFT_COLLAPSED_KEY = 'zachart-maths:left-collapsed'
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Stockage indisponible : la mémoire vaut pour la session seulement.
  }
}

const BEFORE_KEY = 'zachart-maths:zen-before'

interface Before { left: boolean; right: boolean }

/** Le mode zéro distraction, c'est les deux panneaux rangés : il n'a pas d'état à lui, il se lit sur eux. */
export const isZen = (leftCollapsed: boolean, rightCollapsed: boolean) => leftCollapsed && rightCollapsed

function readBefore(): Before {
  try {
    const raw: unknown = JSON.parse(read(BEFORE_KEY) ?? 'null')
    if (typeof raw === 'object' && raw !== null && 'left' in raw && 'right' in raw) {
      return { left: (raw as Before).left === true, right: (raw as Before).right === true }
    }
  } catch {
    // Mémoire abîmée : on rouvre tout.
  }
  return { left: false, right: false }
}

/**
 * Entre en zéro distraction (range les deux panneaux en retenant lesquels étaient dépliés) ou en sort
 * (les rouvre comme ils étaient ; si rien n'était déplié avant, les deux).
 */
export function toggleZen(): void {
  const left = read(LEFT_COLLAPSED_KEY) === '1'
  const right = read(RIGHT_COLLAPSED_KEY) === '1'
  if (isZen(left, right)) {
    const before = readBefore()
    const reopenBoth = before.left && before.right
    setPanelCollapsed(LEFT_COLLAPSED_KEY, reopenBoth ? false : before.left)
    setPanelCollapsed(RIGHT_COLLAPSED_KEY, reopenBoth ? false : before.right)
    return
  }
  write(BEFORE_KEY, JSON.stringify({ left, right }))
  setPanelCollapsed(LEFT_COLLAPSED_KEY, true)
  setPanelCollapsed(RIGHT_COLLAPSED_KEY, true)
}
