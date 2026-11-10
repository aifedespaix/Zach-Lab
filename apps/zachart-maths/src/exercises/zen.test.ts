import { beforeEach, describe, expect, it } from 'vitest'
import { RIGHT_COLLAPSED_KEY } from '../cours/useCoursesStore'
import { LEFT_COLLAPSED_KEY, isZen, toggleZen } from './zen'

const folded = (key: string) => localStorage.getItem(key) === '1'

describe('zéro distraction', () => {
  beforeEach(() => localStorage.clear())

  it('range les deux panneaux puis les remet comme ils étaient', () => {
    localStorage.setItem(RIGHT_COLLAPSED_KEY, '1') // le droit était déjà rangé
    toggleZen()
    expect(isZen(folded(LEFT_COLLAPSED_KEY), folded(RIGHT_COLLAPSED_KEY))).toBe(true)
    toggleZen()
    expect(folded(LEFT_COLLAPSED_KEY)).toBe(false)
    expect(folded(RIGHT_COLLAPSED_KEY)).toBe(true)
  })

  it('rouvre tout si les deux étaient déjà rangés avant', () => {
    localStorage.setItem(LEFT_COLLAPSED_KEY, '1')
    localStorage.setItem(RIGHT_COLLAPSED_KEY, '1')
    toggleZen() // déjà « zen » : on rouvre
    expect(folded(LEFT_COLLAPSED_KEY)).toBe(false)
    expect(folded(RIGHT_COLLAPSED_KEY)).toBe(false)
  })
})
