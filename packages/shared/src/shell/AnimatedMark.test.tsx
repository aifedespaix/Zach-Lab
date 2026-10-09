import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnimatedMark, type MarkConfig } from './AnimatedMark'

const Z: MarkConfig = {
  points: [[36, 36], [92, 36], [36, 92], [92, 92]],
  colors: ['#EF4444', '#F97316', '#3B82F6', '#EAB308'],
  segments: [[[36, 36], [92, 36]], [[92, 36], [36, 92]], [[36, 92], [92, 92]]],
}

describe('AnimatedMark', () => {
  it('dessine quatre points de la couleur demandée et un trait par segment', () => {
    const { container } = render(<AnimatedMark mark={Z} mode="draw-fade" />)
    const dots = [...container.querySelectorAll('circle')]
    expect(dots.map(dot => dot.getAttribute('fill'))).toEqual(Z.colors)
    expect(container.querySelectorAll('polyline')).toHaveLength(3)
    expect(container.querySelector('polyline')).toHaveAttribute('points', '36,36 92,36')
  })

  it('porte le mode en classe, et se cache des lecteurs d\'écran', () => {
    const { container, rerender } = render(<AnimatedMark mark={Z} mode="draw-fade" size={120} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveClass('animated-mark--draw-fade')
    expect(svg).toHaveAttribute('width', '120')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    rerender(<AnimatedMark mark={Z} mode="draw-pulse" />)
    expect(container.querySelector('svg')).toHaveClass('animated-mark--draw-pulse')
  })

  it('chaque point glisse depuis le précédent par défaut (Z : le jaune vient du bleu)', () => {
    const { container } = render(<AnimatedMark mark={Z} mode="draw-fade" />)
    const [, orange, blue, yellow] = [...container.querySelectorAll('circle')]
    expect(orange.style.getPropertyValue('--from-x')).toBe('-56')
    expect(orange.style.getPropertyValue('--from-y')).toBe('0')
    expect(blue.style.getPropertyValue('--from-x')).toBe('56')
    expect(blue.style.getPropertyValue('--from-y')).toBe('-56')
    expect(yellow.style.getPropertyValue('--from-x')).toBe('-56')
  })

  it('`origins` remplace le point de départ (le creux d\'un M)', () => {
    const M: MarkConfig = {
      points: [[36, 92], [36, 36], [92, 36], [92, 92]],
      colors: Z.colors,
      segments: [],
      origins: [[36, 92], [64, 78], [92, 36]],
    }
    const { container } = render(<AnimatedMark mark={M} mode="draw-fade" />)
    const third = container.querySelectorAll('circle')[2]
    expect(third.style.getPropertyValue('--from-x')).toBe('-28')
    expect(third.style.getPropertyValue('--from-y')).toBe('42')
  })
})
