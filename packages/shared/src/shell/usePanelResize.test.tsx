import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPanelWidthStorage } from './panelWidth'
import { PanelResizeHandle } from './PanelResizeHandle'
import { KEYBOARD_RESIZE_STEP, usePanelResize, type PanelSide } from './usePanelResize'

const storage = createPanelWidthStorage({ key: 'test:resize', min: 100, max: 400, fallback: 200 })

function Panel({ side }: { side: PanelSide }) {
  const resize = usePanelResize({ storage, side })
  return (
    <div data-testid="panel" style={{ width: resize.width }}>
      <PanelResizeHandle resize={resize} side={side} label="Redimensionner" />
      <span data-testid="state">{resize.resizing ? 'drag' : 'idle'}</span>
    </div>
  )
}

function widthOf() {
  return Number(screen.getByRole('separator').getAttribute('aria-valuenow'))
}

/** jsdom has no layout: give the panel the box a real one would have. */
function boxPanel(left: number, right: number) {
  screen.getByTestId('panel').getBoundingClientRect = () =>
    ({ left, right, top: 0, bottom: 0, width: right - left, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
}

describe('usePanelResize', () => {
  beforeEach(() => localStorage.clear())

  it('démarre à la largeur enregistrée, lue dès le premier rendu', () => {
    storage.save(320)
    render(<Panel side="left" />)
    expect(widthOf()).toBe(320)
  })

  it('démarre à la largeur par défaut au premier lancement', () => {
    render(<Panel side="left" />)
    expect(widthOf()).toBe(200)
  })

  it('annonce ses bornes au clavier et aux lecteurs d\'écran', () => {
    render(<Panel side="left" />)
    const handle = screen.getByRole('separator')
    expect(handle).toHaveAttribute('aria-valuemin', '100')
    expect(handle).toHaveAttribute('aria-valuemax', '400')
    expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    expect(handle).toHaveAttribute('tabindex', '0')
  })

  it('panneau de gauche : la largeur suit le pointeur depuis le bord gauche, et n\'est enregistrée qu\'au relâchement', () => {
    render(<Panel side="left" />)
    boxPanel(0, 200)
    const handle = screen.getByRole('separator')

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 200 })
    expect(screen.getByTestId('state')).toHaveTextContent('drag')
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 260 })
    expect(widthOf()).toBe(260)
    expect(storage.load()).toBe(200) // rien d'écrit pendant le geste

    fireEvent.pointerUp(handle, { pointerId: 1 })
    expect(screen.getByTestId('state')).toHaveTextContent('idle')
    expect(storage.load()).toBe(260)
  })

  it('panneau de droite : la largeur se mesure depuis le bord droit', () => {
    render(<Panel side="right" />)
    boxPanel(600, 800)
    const handle = screen.getByRole('separator')
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 600 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 540 })
    expect(widthOf()).toBe(260)
  })

  it('reste dans les bornes pendant un glissement, quel que soit le pointeur', () => {
    render(<Panel side="left" />)
    boxPanel(0, 200)
    const handle = screen.getByRole('separator')
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 200 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 9000 })
    expect(widthOf()).toBe(400)
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: -500 })
    expect(widthOf()).toBe(100)
  })

  it('ignore les mouvements quand aucun glissement n\'est en cours', () => {
    render(<Panel side="left" />)
    boxPanel(0, 200)
    fireEvent.pointerMove(screen.getByRole('separator'), { pointerId: 1, clientX: 350 })
    expect(widthOf()).toBe(200)
  })

  it('un glissement annulé (perte de focus de la fenêtre) enregistre quand même où il s\'est arrêté', () => {
    render(<Panel side="left" />)
    boxPanel(0, 200)
    const handle = screen.getByRole('separator')
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 200 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 240 })
    fireEvent.pointerCancel(handle, { pointerId: 1 })
    expect(screen.getByTestId('state')).toHaveTextContent('idle')
    expect(storage.load()).toBe(240)
  })

  it('panneau de gauche au clavier : flèche droite élargit, flèche gauche rétrécit, et c\'est enregistré', () => {
    render(<Panel side="left" />)
    const handle = screen.getByRole('separator')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(widthOf()).toBe(200 + KEYBOARD_RESIZE_STEP)
    expect(storage.load()).toBe(200 + KEYBOARD_RESIZE_STEP)
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(widthOf()).toBe(200 - KEYBOARD_RESIZE_STEP)
  })

  it('panneau de droite au clavier : les directions sont inversées', () => {
    render(<Panel side="right" />)
    const handle = screen.getByRole('separator')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(widthOf()).toBe(200 + KEYBOARD_RESIZE_STEP)
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(widthOf()).toBe(200 - KEYBOARD_RESIZE_STEP)
  })

  it('le clavier ne dépasse pas les bornes', () => {
    storage.save(400)
    render(<Panel side="left" />)
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' })
    expect(widthOf()).toBe(400)
  })

  it('laisse passer les autres touches', () => {
    render(<Panel side="left" />)
    const notPrevented = fireEvent.keyDown(screen.getByRole('separator'), { key: 'Tab' })
    expect(notPrevented).toBe(true)
    expect(widthOf()).toBe(200)
  })

  it('le double-clic remet la largeur par défaut, et l\'enregistre', () => {
    storage.save(350)
    render(<Panel side="left" />)
    fireEvent.doubleClick(screen.getByRole('separator'))
    expect(widthOf()).toBe(200)
    expect(storage.load()).toBe(200)
  })
})
