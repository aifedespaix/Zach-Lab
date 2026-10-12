import { beforeEach, describe, expect, it } from 'vitest'
import { viewStores } from '@suite/shared/view'

// Les préférences d'affichage de Zach'Math viennent du commun : leurs clés doivent rester celles
// qu'un élève a déjà enregistrées, sinon zoom et mode condensé repartent à zéro.
describe('préférences d’affichage de Zach’Math', () => {
  beforeEach(() => localStorage.clear())

  it('gardent les clés zachart-maths:zoom et zachart-maths:compact', () => {
    const stores = viewStores('zachart-maths')
    stores.zoom.getState().set(90)
    stores.compact.getState().set(true)
    expect(localStorage.getItem('zachart-maths:zoom')).toBe('90')
    expect(localStorage.getItem('zachart-maths:compact')).toBe('on')
  })
})
