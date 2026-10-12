import { afterEach, describe, expect, it, vi } from 'vitest'
import { standardCommands } from '../commands'
import { printPage, PRINT_AREA_ATTRIBUTE } from './print'

afterEach(() => vi.restoreAllMocks())

describe('printPage', () => {
  it('ouvre la boîte d’impression du système', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    printPage()
    expect(print).toHaveBeenCalledOnce()
  })

  it('ne lève rien quand la boîte d’impression est indisponible', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new Error('pas d’impression ici')
    })
    expect(() => printPage()).not.toThrow()
  })

  it('désigne la zone à imprimer par un attribut dédié', () => {
    expect(PRINT_AREA_ATTRIBUTE).toBe('data-print-area')
  })
})

describe('file.print (commande standard)', () => {
  it('est liée à Ctrl/Cmd+P par défaut', () => {
    const [def] = standardCommands(['file.print'])
    expect(def.defaultBinding).toBe('Mod+P')
    expect(def.category).toBe('file')
  })
})
