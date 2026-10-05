import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnimatedLogo } from './AnimatedLogo'
import css from './index.css?raw'
import favicon from '../public/favicon.svg?raw'

describe('AnimatedLogo', () => {
  it('pose quatre points dans l\'ordre d\'écriture du M, reliés par trois traits', () => {
    const { container } = render(<AnimatedLogo mode="draw-fade" />)
    const dots = [...container.querySelectorAll('circle')]
    expect(dots.map(d => [d.getAttribute('cx'), d.getAttribute('cy')])).toEqual([['36', '92'], ['36', '36'], ['92', '36'], ['92', '92']])
    expect(dots.map(d => d.getAttribute('fill'))).toEqual(['#EF4444', '#F97316', '#3B82F6', '#EAB308'])
    expect(container.querySelectorAll('polyline')).toHaveLength(3)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('applique le mode demandé et la taille', () => {
    const { container } = render(<AnimatedLogo mode="draw-pulse" size={160} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveClass('animated-logo--draw-pulse')
    expect(svg).toHaveAttribute('width', '160')
  })

  it('chaque classe de la marque a ses règles dans index.css, dans les deux modes', () => {
    for (const mode of ['draw-fade', 'draw-pulse']) {
      for (const part of ['dot--1', 'dot--2', 'dot--3', 'dot--4', 'seg--1', 'seg--2', 'seg--3']) {
        expect(css, `${mode} ${part}`).toContain(`.animated-logo--${mode} .animated-logo-${part}`)
      }
    }
    expect(css).toContain('prefers-reduced-motion')
  })

  it('le 3e point part du creux du M (64,78 → 92,36), pas de la gauche', () => {
    // décalage = creux − point : (64−92, 78−36)
    expect(css.match(/translate\(-28px, 42px\) scale\(0\.6\)/g)).toHaveLength(2)
    expect(css).not.toContain('translate(-56px, 0)')
  })

  it('le favicon est le même M que l\'animation : mêmes points, mêmes couleurs', () => {
    expect(favicon).toContain('points="36,92 36,36 64,78 92,36 92,92"')
    for (const color of ['#EF4444', '#F97316', '#3B82F6', '#EAB308']) expect(favicon).toContain(color)
  })
})
