import { describe, it, expect } from 'vitest'
import { filterOptions, foldText, type ComboboxOption } from './combobox-filter'

const options: ComboboxOption[] = [
  { value: 'a', label: 'Collège', detail: 'Collège' },
  { value: 'b', label: '3e', detail: 'Collège/3e' },
  { value: 'c', label: 'Géométrie', detail: 'Collège/3e/Géométrie' },
  { value: 'd', label: 'Algèbre', detail: 'Collège/3e/Algèbre' },
]

describe('foldText', () => {
  it('drops accents, case and surrounding spaces', () => {
    expect(foldText('  GÉométrie ')).toBe('geometrie')
  })
})

describe('filterOptions', () => {
  it('keeps everything, in order, for an empty query', () => {
    expect(filterOptions(options, '')).toBe(options)
    expect(filterOptions(options, '   ')).toBe(options)
  })

  it('ignores accents and case', () => {
    expect(filterOptions(options, 'GEOMETRIE').map(o => o.value)).toEqual(['c'])
    expect(filterOptions(options, 'algebre').map(o => o.value)).toEqual(['d'])
  })

  it('matches on the full path, not only the name', () => {
    expect(filterOptions(options, '3e/géo').map(o => o.value)).toEqual(['c'])
    expect(filterOptions(options, '3e').map(o => o.value)).toEqual(['b', 'c', 'd'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterOptions(options, 'physique')).toEqual([])
  })
})
