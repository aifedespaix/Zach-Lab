import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCommandRegistry } from '../commands'
import { useHistoryCommands } from './useHistoryCommands'

describe('useHistoryCommands', () => {
  it('enregistre edit.undo / edit.redo, grisés selon la profondeur', () => {
    const undo = vi.fn()
    const redo = vi.fn()
    const { rerender, unmount } = renderHook(p => useHistoryCommands(p), {
      initialProps: { undo, redo, canUndo: true, canRedo: false },
    })
    const regs = () => useCommandRegistry.getState().registrations
    expect(regs()['edit.undo']?.enabled).toBe(true)
    expect(regs()['edit.redo']?.enabled).toBe(false)
    useCommandRegistry.getState().run('edit.undo')
    expect(undo).toHaveBeenCalledOnce()
    rerender({ undo, redo, canUndo: false, canRedo: true })
    expect(regs()['edit.undo']?.enabled).toBe(false)
    expect(regs()['edit.redo']?.enabled).toBe(true)
    unmount()
    expect(regs()['edit.undo']).toBeUndefined()
  })
})
