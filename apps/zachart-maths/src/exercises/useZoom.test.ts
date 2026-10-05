import { beforeEach, describe, expect, it } from 'vitest'
import { useCompact } from './useCompact'
import { ZOOM_KEY, ZOOM_MAX, ZOOM_MIN, useZoom } from './useZoom'

describe('zoom', () => {
  beforeEach(() => {
    localStorage.clear()
    useZoom.setState({ percent: 100 })
  })

  it('dézoome et zoome par pas de 10 %, bornés à 50–150, et se souvient du choix', () => {
    useZoom.getState().zoomOut()
    expect(useZoom.getState().percent).toBe(90)
    expect(localStorage.getItem(ZOOM_KEY)).toBe('90')
    for (let i = 0; i < 20; i++) useZoom.getState().zoomOut()
    expect(useZoom.getState().percent).toBe(ZOOM_MIN)
    for (let i = 0; i < 20; i++) useZoom.getState().zoomIn()
    expect(useZoom.getState().percent).toBe(ZOOM_MAX)
    useZoom.getState().reset()
    expect(useZoom.getState().percent).toBe(100)
  })
})

describe('mode condensé', () => {
  it('se bascule et se retient', () => {
    useCompact.setState({ enabled: false })
    useCompact.getState().toggle()
    expect(useCompact.getState().enabled).toBe(true)
    expect(localStorage.getItem('zachart-maths:compact')).toBe('on')
  })
})
