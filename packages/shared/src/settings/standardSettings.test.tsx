import { Cog } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { mergeSettings, standardSettings } from './standardSettings'

const updates = { status: 'idle', checkNow: vi.fn(), updateReady: false, applyUpdate: vi.fn() } as const
const own = (id: string) => ({ id, label: id, icon: Cog, render: () => null })

describe('standardSettings', () => {
  it('donne Raccourcis puis Mises à jour, et la source des raccourcis', () => {
    const standard = standardSettings({ updates })
    expect(standard.panels.map(panel => panel.id)).toEqual(['shortcuts', 'updates'])
    expect(standard.sources).toHaveLength(1)
  })

  it('sans mises à jour ni raccourcis, rien', () => {
    const standard = standardSettings({ shortcuts: false })
    expect(standard.panels).toEqual([])
    expect(standard.sources).toEqual([])
  })
})

describe('mergeSettings', () => {
  it('place les panneaux de l\'app entre Raccourcis et Mises à jour', () => {
    const merged = mergeSettings(standardSettings({ updates }), { panels: [own('toolbar'), own('quiz')] })
    expect(merged.panels.map(panel => panel.id)).toEqual(['shortcuts', 'toolbar', 'quiz', 'updates'])
  })

  it('un panneau de l\'app qui reprend un id standard le remplace', () => {
    const mine = own('shortcuts')
    const merged = mergeSettings(standardSettings({ updates }), { panels: [mine] })
    expect(merged.panels.map(panel => panel.id)).toEqual(['shortcuts', 'updates'])
    expect(merged.panels[0]).toBe(mine)
  })

  it('les sources de l\'app passent avant les standard', () => {
    const source = { snapshot: () => 1, restore: () => {}, commit: async () => {} }
    const merged = mergeSettings(standardSettings({ updates }), { sources: [source] })
    expect(merged.sources[0]).toBe(source)
    expect(merged.sources).toHaveLength(2)
  })

  it('sans rien de l\'app, les panneaux standard seuls', () => {
    expect(mergeSettings(standardSettings({ updates })).panels).toHaveLength(2)
  })
})
