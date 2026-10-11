import { beforeEach, describe, expect, it } from 'vitest'
import { onPastilleClick, pastilleView } from './pastilles'
import { RIGHT_COLLAPSED_KEY, useCoursesStore } from './useCoursesStore'

describe('pastilleView', () => {
  it('allumée déplié si la mémoire le dit', () => {
    expect(pastilleView({ collapsed: false, remembered: true })).toEqual({ lit: true })
  })

  it('éteinte replié, même si la mémoire est allumée', () => {
    expect(pastilleView({ collapsed: true, remembered: true })).toEqual({ lit: false })
  })

  it('éteinte déplié si la mémoire est éteinte', () => {
    expect(pastilleView({ collapsed: false, remembered: false })).toEqual({ lit: false })
  })
})

describe('onPastilleClick', () => {
  it('replié et éteinte en mémoire : déplie et allume', () => {
    expect(onPastilleClick({ collapsed: true, remembered: false })).toEqual({ unfold: true, nextRemembered: true })
  })

  it('replié et allumée en mémoire : déplie et ne l\'éteint pas', () => {
    expect(onPastilleClick({ collapsed: true, remembered: true })).toEqual({ unfold: true, nextRemembered: true })
  })

  it('déplié : bascule, l\'allumée s\'éteint', () => {
    expect(onPastilleClick({ collapsed: false, remembered: true })).toEqual({ unfold: false, nextRemembered: false })
  })

  it('déplié : l\'éteinte s\'allume sans dépliage', () => {
    expect(onPastilleClick({ collapsed: false, remembered: false })).toEqual({ unfold: false, nextRemembered: true })
  })
})

describe('useCoursesStore : panneau replié', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(RIGHT_COLLAPSED_KEY, '1')
    useCoursesStore.setState({ notesVisible: true, bottomTab: 'calculatrice', coursesVisible: true })
  })

  it('cliquer sur la calculatrice allumée en mémoire la garde allumée et déplie le panneau', () => {
    useCoursesStore.getState().toggleBottom('calculatrice')
    const state = useCoursesStore.getState()
    expect(state.notesVisible).toBe(true)
    expect(state.bottomTab).toBe('calculatrice')
    expect(localStorage.getItem(RIGHT_COLLAPSED_KEY)).toBe('0')
  })

  it('cliquer sur les cours (allumés en mémoire) les garde allumés et déplie', () => {
    useCoursesStore.getState().toggleCourses()
    expect(useCoursesStore.getState().coursesVisible).toBe(true)
    expect(localStorage.getItem(RIGHT_COLLAPSED_KEY)).toBe('0')
  })

  it('déplié, cliquer sur la calculatrice allumée l\'éteint', () => {
    localStorage.setItem(RIGHT_COLLAPSED_KEY, '0')
    useCoursesStore.getState().toggleBottom('calculatrice')
    expect(useCoursesStore.getState().notesVisible).toBe(false)
  })
})
