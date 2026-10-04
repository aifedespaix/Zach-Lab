import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { colorTerms } from './likeTerms'
import { coloredLatex, LikeTermsHelp } from './LikeTermsHelp'
import { assignTermColors } from './termColors'

const lines = (container: HTMLElement) => container.querySelectorAll('[data-like-terms-line]')
const slots = (container: HTMLElement) => container.querySelectorAll<HTMLElement>('[data-like-terms-slot]')

describe('coloredLatex', () => {
  it('enveloppe chaque terme coloré dans une boîte, et laisse le reste tel quel', () => {
    const colors = new Map([['x', '#111111'], ['', '#222222']])
    expect(coloredLatex(colorTerms('3x + 2'), colors)).toBe('\\colorbox{#111111}{$3x$} \\colorbox{#222222}{$+ 2$}')
  })

  it('ne colore pas un terme non lu, et recolle le LaTeX tel quel sans couleurs', () => {
    expect(coloredLatex(colorTerms('2(x+1) + 3'), new Map())).toBe('2(x+1) + 3')
  })

  it('rend une chaîne vide pour un membre vide', () => {
    expect(coloredLatex([], new Map())).toBe('')
  })
})

describe('LikeTermsHelp', () => {
  it('montre une ligne par étape, un fond par terme coloré, et garde sa hauteur minimale', () => {
    const { container } = render(<LikeTermsHelp steps={[{ left: '3x+2y+1', right: '5x+3y-4' }]} theme="light" />)
    expect(container.querySelector('[data-like-terms-help]')).toHaveAttribute('aria-hidden', 'true')
    expect(lines(container)).toHaveLength(1)
    expect(container.querySelectorAll('[style*="background-color"]')).toHaveLength(6)
    expect((container.querySelector('[data-like-terms-help]') as HTMLElement).style.minHeight).toBe('28px')
  })

  it('ne montre aucune ligne quand aucun groupe n\'a deux termes, mais garde son conteneur', () => {
    const { container } = render(<LikeTermsHelp steps={[{ left: '5x', right: '10' }]} theme="light" />)
    expect(container.querySelector('[data-like-terms-help]')).not.toBeNull()
    expect(slots(container)).toHaveLength(1)
    expect(lines(container)).toHaveLength(0)
  })

  it('montre la ligne quand un groupe a deux termes dans l\'étape', () => {
    for (const [left, right] of [['3x', '2x+5'], ['2x+3', '5'], ['2x+3-2x', '7'], ['x^2-4', '0']]) {
      const { container } = render(<LikeTermsHelp steps={[{ left, right }]} theme="light" />)
      expect(lines(container), `${left} = ${right}`).toHaveLength(1)
    }
  })

  it('ignore les étapes vides et celles qui n\'ont rien à regrouper', () => {
    const { container } = render(
      <LikeTermsHelp steps={[{ left: '', right: '' }, { left: '3x+2', right: '7' }, { left: '(1+2)', right: '' }]} theme="light" />,
    )
    expect(lines(container)).toHaveLength(1)
  })

  it('garde la même couleur pour un même groupe d\'une étape à l\'autre', () => {
    const steps = [{ left: '1+x', right: '7' }, { left: '2x', right: 'x+6' }]
    const { container } = render(<LikeTermsHelp steps={steps} theme="light" />)
    const xColor = assignTermColors(['', 'x'], 'light').get('x')!
    expect(container.innerHTML.split(xColor).length - 1).toBeGreaterThanOrEqual(2)
  })

  it('change de couleurs avec le thème', () => {
    const steps = [{ left: '3x+2y+1', right: '5' }]
    const light = render(<LikeTermsHelp steps={steps} theme="light" />).container.innerHTML
    const dark = render(<LikeTermsHelp steps={steps} theme="dark" />).container.innerHTML
    expect(light).not.toBe(dark)
  })

  it('ne lève rien sur une entrée absurde', () => {
    expect(() =>
      render(<LikeTermsHelp steps={[{ left: '\\frac{', right: '{{{x' }, { left: '3x+', right: '+-' }]} theme="dark" />),
    ).not.toThrow()
  })

  it('rend une case de hauteur fixe par étape, vide ou illisible comprise, la ligne colorée seulement quand il y a de quoi regrouper', () => {
    const steps = [{ left: '3x+2', right: '7' }, { left: '3(x+2)', right: '15' }, { left: '', right: '' }]
    const { container } = render(<LikeTermsHelp steps={steps} theme="light" />)
    const all = slots(container)
    expect(all).toHaveLength(3)
    for (const slot of all) expect(slot.style.minHeight).toBe('28px')
    expect(lines(container)).toHaveLength(1)
    expect(all[0].querySelector('[data-like-terms-line]')).not.toBeNull()
    expect(all[1].querySelector('[data-like-terms-line]')).toBeNull()
    expect(all[2].querySelector('[data-like-terms-line]')).toBeNull()
  })
})
