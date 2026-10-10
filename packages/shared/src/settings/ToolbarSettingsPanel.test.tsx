import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { defineCommandCatalog, standardCommands, STANDARD_CATEGORIES } from '../commands'
import { toolbarEntries, toolbarHiddenStore } from '../shell'
import { defineToolbar } from '../shell/toolbarZones'
import { ToolbarSettingsPanel } from './ToolbarSettingsPanel'

beforeAll(() => {
  defineCommandCatalog({
    categories: [...STANDARD_CATEGORIES],
    commands: standardCommands(['app.palette', 'app.settings', 'app.toggleTheme', 'file.new', 'file.close', 'edit.undo', 'edit.redo']),
  })
})
beforeEach(() => localStorage.clear())

const toolbar = defineToolbar({ items: [{ id: 'quiz', zone: 'app', label: 'Quiz', node: null }] })
const mount = (id: string) => render(<ToolbarSettingsPanel appId={id} entries={toolbarEntries(toolbar)} />)

describe('ToolbarSettingsPanel', () => {
  it('une case par item de la barre, groupées par zone ; les verrouillés sont cochés et grisés', () => {
    mount('p1')
    for (const name of ['Nouveau / Fermer', 'Annuler', 'Rétablir', 'Paramètres']) {
      const box = screen.getByRole('switch', { name: new RegExp(name) })
      expect(box).toBeChecked()
      expect(box).toBeDisabled()
    }
    expect(screen.getByRole('switch', { name: /Quiz/ })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Application' })).toBeInTheDocument()
  })

  it('le thème est décoché par défaut ; le cocher le remet et le retient', async () => {
    mount('p2')
    const theme = screen.getByRole('switch', { name: /Basculer le thème/ })
    expect(theme).not.toBeChecked()
    await userEvent.click(theme)
    expect(theme).toBeChecked()
    expect(toolbarHiddenStore('p2').getState().value).toEqual([])
    expect(localStorage.getItem('p2:toolbar-hidden')).toBe('[]')
  })

  it('décocher Quiz le masque, sans toucher aux autres', async () => {
    mount('p3')
    await userEvent.click(screen.getByRole('switch', { name: /Quiz/ }))
    expect(toolbarHiddenStore('p3').getState().value).toEqual(['app.toggleTheme', 'quiz'])
  })

  it('un id inconnu dans le fichier est ignoré', () => {
    localStorage.setItem('p4:toolbar-hidden', '["disparu"]')
    mount('p4')
    expect(screen.getByRole('switch', { name: /Quiz/ })).toBeChecked()
    expect(screen.getByRole('switch', { name: /Basculer le thème/ })).toBeChecked()
  })
})
