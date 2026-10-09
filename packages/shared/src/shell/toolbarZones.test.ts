import { describe, expect, it } from 'vitest'
import { ZONE_PRIORITY, arrangeToolbar, defineToolbar, type ToolbarItem } from './toolbarZones'

const item = (id: string, zone: ToolbarItem['zone'], priority?: number): ToolbarItem => ({ id, zone, node: null, priority })

describe('arrangeToolbar', () => {
  it('range par zone dans l’ordre imposé, puis dans l’ordre donné', () => {
    const arranged = arrangeToolbar([
      item('s', 'system'),
      item('v', 'view'),
      item('a1', 'app'),
      item('f', 'file'),
      item('a2', 'app'),
      item('t', 'title'),
      item('p', 'panels'),
      item('e', 'edit'),
    ])
    expect(arranged.map(i => i.id)).toEqual(['f', 'e', 't', 'a1', 'a2', 'p', 'v', 's'])
  })
  it('donne la priorité de la zone, sauf si l’item a la sienne', () => {
    const [a, b] = arrangeToolbar([item('a', 'app'), item('b', 'app', 1)])
    expect(a.priority).toBe(ZONE_PRIORITY.app)
    expect(b.priority).toBe(1)
  })
  it('garde fichier et système en dernier à partir, et le titre en premier', () => {
    expect(ZONE_PRIORITY.file).toBeGreaterThan(ZONE_PRIORITY.app)
    expect(ZONE_PRIORITY.system).toBeGreaterThan(ZONE_PRIORITY.app)
    expect(ZONE_PRIORITY.title).toBeLessThan(ZONE_PRIORITY.app)
  })
})

describe('defineToolbar', () => {
  it('refuse deux items de même id', () => {
    expect(() => defineToolbar({ items: [item('x', 'app'), item('x', 'view')] })).toThrow(/en double/)
  })
})
