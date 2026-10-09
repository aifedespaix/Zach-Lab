import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '../ui'
import { AppIdProvider } from './appId'
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel'
import { useDensity, useFontFamily, useUiZoom } from './hooks'
import { spacing } from './spacing'
import { useApplyView } from './useApplyView'
import { viewStores } from './viewStores'
import { ZOOM_MAX, ZOOM_MIN, zoomStyle } from './zoom'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppIdProvider id="demo">
    <TooltipProvider>{children}</TooltipProvider>
  </AppIdProvider>
)

beforeEach(() => {
  localStorage.clear()
  const { zoom, compact, font } = viewStores('demo')
  zoom.getState().reset()
  compact.getState().reset()
  font.getState().reset()
  localStorage.clear()
  document.documentElement.removeAttribute('style')
})

describe('useUiZoom', () => {
  it('dézoome et zoome par pas de 10 %, bornés à 50–150, et se souvient du choix sous <id>:zoom', () => {
    const { result } = renderHook(() => useUiZoom(), { wrapper })
    act(() => result.current.zoomOut())
    expect(result.current.percent).toBe(90)
    expect(localStorage.getItem('demo:zoom')).toBe('90')
    act(() => {
      for (let i = 0; i < 20; i++) result.current.zoomOut()
    })
    expect(result.current.percent).toBe(ZOOM_MIN)
    act(() => {
      for (let i = 0; i < 20; i++) result.current.zoomIn()
    })
    expect(result.current.percent).toBe(ZOOM_MAX)
    act(() => result.current.reset())
    expect(result.current.percent).toBe(100)
  })

  it('relit le zoom déjà enregistré (clé historique de Maths) et le ramène dans les bornes', () => {
    localStorage.setItem('zachart-maths:zoom', '70')
    expect(viewStores('zachart-maths').zoom.getState().value).toBe(70)
    localStorage.setItem('other:zoom', '999')
    expect(viewStores('other').zoom.getState().value).toBe(ZOOM_MAX)
    localStorage.setItem('garbage:zoom', 'abc')
    expect(viewStores('garbage').zoom.getState().value).toBe(100)
  })

  it('un app a ses propres stores', () => {
    viewStores('one').zoom.getState().set(60)
    expect(viewStores('two').zoom.getState().value).toBe(100)
  })
})

describe('useDensity', () => {
  it('se bascule et se retient sous <id>:compact en on/off', () => {
    const { result } = renderHook(() => useDensity(), { wrapper })
    expect(result.current.compact).toBe(false)
    act(() => result.current.toggle())
    expect(result.current.compact).toBe(true)
    expect(localStorage.getItem('demo:compact')).toBe('on')
    act(() => result.current.toggle())
    expect(localStorage.getItem('demo:compact')).toBe('off')
  })

  it('relit « on » de Zach\'Math', () => {
    localStorage.setItem('maths2:compact', 'on')
    expect(viewStores('maths2').compact.getState().value).toBe(true)
  })

  it('spacing(compact) donne les espacements normaux ou condensés', () => {
    expect(spacing(false).zone).toBe(16)
    expect(spacing(true).zone).toBe(4)
  })
})

describe('useApplyView', () => {
  it('pose zoom, --app-zoom et --app-height sur la racine, et les retire au démontage', () => {
    const { unmount } = renderHook(() => useApplyView('demo'))
    const root = document.documentElement
    expect(root.style.zoom).toBe('')
    expect(root.style.getPropertyValue('--app-zoom')).toBe('1')
    act(() => viewStores('demo').zoom.getState().set(50))
    expect(root.style.zoom).toBe('50%')
    expect(root.style.getPropertyValue('--app-height')).toBe('calc(100vh / 0.5)')
    unmount()
    expect(root.style.getPropertyValue('--app-zoom')).toBe('')
  })

  it('applique la police, et la retire quand elle est vide', () => {
    renderHook(() => useApplyView('demo'))
    const root = document.documentElement
    act(() => viewStores('demo').font.getState().set('Georgia, serif'))
    expect(root.style.getPropertyValue('--font-sans')).toBe('Georgia, serif')
    act(() => viewStores('demo').font.getState().reset())
    expect(root.style.getPropertyValue('--font-sans')).toBe('')
  })

  it('ne touche à rien quand l\'app désactive le zoom', () => {
    renderHook(() => useApplyView('demo', { zoom: false }))
    expect(document.documentElement.style.getPropertyValue('--app-zoom')).toBe('')
  })

  it('zoomStyle', () => {
    expect(zoomStyle(100).zoom).toBe('')
    expect(zoomStyle(150)).toEqual({ zoom: '150%', appZoom: '1.5', appHeight: 'calc(100vh / 1.5)' })
  })
})

describe('AppearanceSettingsPanel', () => {
  it('règle le zoom, la densité et la police', async () => {
    const user = userEvent.setup()
    render(<AppearanceSettingsPanel />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Zoomer' }))
    expect(viewStores('demo').zoom.getState().value).toBe(110)
    await user.click(screen.getByRole('switch'))
    expect(viewStores('demo').compact.getState().value).toBe(true)
    await user.selectOptions(screen.getByLabelText('Police de l’interface'), 'Avec empattements')
    expect(viewStores('demo').font.getState().value).toMatch(/serif/)
  })

  it('masque ce que l\'app désactive', () => {
    render(<AppearanceSettingsPanel view={{ zoom: false, font: false }} />, { wrapper })
    expect(screen.queryByRole('button', { name: 'Zoomer' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Police de l’interface')).not.toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('useFontFamily lit le store', () => {
    viewStores('demo').font.getState().set('serif')
    const { result } = renderHook(() => useFontFamily(), { wrapper })
    expect(result.current.fontFamily).toBe('serif')
  })
})
