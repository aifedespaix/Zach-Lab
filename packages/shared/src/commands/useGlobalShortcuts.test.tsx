import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineCommandCatalog, resetCommandCatalog } from './catalog'
import { useCommand } from './useCommand'
import { useCommandRegistry } from './useCommandRegistry'
import { useGlobalShortcuts, type GlobalShortcutOptions } from './useGlobalShortcuts'
import { useShortcutSettingsStore } from './useShortcutSettingsStore'

function Harness({ options, run }: { options?: GlobalShortcutOptions; run: Record<string, () => void> }) {
  useGlobalShortcuts(options)
  return (
    <>
      {Object.entries(run).map(([id, handler]) => (
        <Registration key={id} id={id} run={handler} />
      ))}
      <div className="surface">
        <span data-testid="on-surface" />
      </div>
      <div data-testid="off-surface" />
      <input aria-label="champ" />
    </>
  )
}

function Registration({ id, run }: { id: string; run: () => void }) {
  useCommand(id, run)
  return null
}

function press(target: Element, init: KeyboardEventInit & { key: string }) {
  return fireEvent.keyDown(target, { bubbles: true, cancelable: true, ...init })
}

beforeEach(() => {
  defineCommandCatalog({
    categories: [{ id: 'app', label: 'Application' }],
    commands: [
      { id: 'a.plain', label: 'Simple', description: 'x', category: 'app', defaultBinding: 'Mod+J' },
      { id: 'a.always', label: 'Toujours', description: 'x', category: 'app', defaultBinding: 'Mod+K', allowWhenSuspended: true },
      { id: 'a.canvas', label: 'Surface', description: 'x', category: 'app', defaultBinding: 'Enter', scope: 'canvas' },
      { id: 'a.typing', label: 'Saisie', description: 'x', category: 'app', defaultBinding: 'Mod+L', allowInEditable: true },
    ],
  })
  useCommandRegistry.setState({ registrations: {} })
  useShortcutSettingsStore.getState().resetAll()
})
afterEach(() => resetCommandCatalog())

describe('useGlobalShortcuts — options injectées par l\'app', () => {
  it('lance une commande sans option du tout', () => {
    const plain = vi.fn()
    render(<Harness run={{ 'a.plain': plain }} />)
    press(document.body, { key: 'j', ctrlKey: true })
    expect(plain).toHaveBeenCalledOnce()
  })

  it('suspendue : bloque les commandes ordinaires, laisse passer celles qui l\'autorisent', () => {
    const plain = vi.fn()
    const always = vi.fn()
    let suspended = true
    render(<Harness options={{ isSuspended: () => suspended }} run={{ 'a.plain': plain, 'a.always': always }} />)

    press(document.body, { key: 'j', ctrlKey: true })
    press(document.body, { key: 'k', ctrlKey: true })
    expect(plain).not.toHaveBeenCalled()
    expect(always).toHaveBeenCalledOnce()

    // La suspension est relue à chaque touche, pas figée au montage.
    suspended = false
    press(document.body, { key: 'j', ctrlKey: true })
    expect(plain).toHaveBeenCalledOnce()
  })

  it('canvasSelector : une commande de scope canvas ne part que depuis cette surface', () => {
    const canvas = vi.fn()
    const { getByTestId } = render(<Harness options={{ canvasSelector: '.surface' }} run={{ 'a.canvas': canvas }} />)

    press(getByTestId('off-surface'), { key: 'Enter' })
    expect(canvas).not.toHaveBeenCalled()

    press(getByTestId('on-surface'), { key: 'Enter' })
    expect(canvas).toHaveBeenCalledOnce()
  })

  it('canvasSelector : le corps de la page compte comme la surface (rien n\'a le focus)', () => {
    const canvas = vi.fn()
    render(<Harness options={{ canvasSelector: '.surface' }} run={{ 'a.canvas': canvas }} />)
    press(document.body, { key: 'Enter' })
    expect(canvas).toHaveBeenCalledOnce()
  })

  it('sans canvasSelector, une commande de scope canvas se comporte comme une commande globale', () => {
    const canvas = vi.fn()
    const { getByTestId } = render(<Harness run={{ 'a.canvas': canvas }} />)
    press(getByTestId('off-surface'), { key: 'Enter' })
    expect(canvas).toHaveBeenCalledOnce()
  })

  it('ne vole jamais une touche à un champ de saisie, sauf commande qui l\'autorise', () => {
    const plain = vi.fn()
    const typing = vi.fn()
    const { getByLabelText } = render(<Harness run={{ 'a.plain': plain, 'a.typing': typing }} />)
    press(getByLabelText('champ'), { key: 'j', ctrlKey: true })
    press(getByLabelText('champ'), { key: 'l', ctrlKey: true })
    expect(plain).not.toHaveBeenCalled()
    expect(typing).toHaveBeenCalledOnce()
  })

  it('reste muet tant qu\'un dialogue est ouvert', () => {
    const plain = vi.fn()
    render(<Harness run={{ 'a.plain': plain }} />)
    const modal = document.createElement('div')
    modal.setAttribute('data-slot', 'dialog-content')
    modal.setAttribute('data-state', 'open')
    document.body.appendChild(modal)
    press(document.body, { key: 'j', ctrlKey: true })
    expect(plain).not.toHaveBeenCalled()
    modal.remove()
    press(document.body, { key: 'j', ctrlKey: true })
    expect(plain).toHaveBeenCalledOnce()
  })

  it('n\'empêche pas le comportement du navigateur pour une commande absente ou désactivée', () => {
    render(<Harness run={{}} />)
    const notPrevented = press(document.body, { key: 'j', ctrlKey: true })
    // `fireEvent` renvoie false quand preventDefault a été appelé.
    expect(notPrevented).toBe(true)
  })

  it('un changement d\'options ne réinstalle pas l\'écouteur (pas de doublon de déclenchement)', () => {
    const plain = vi.fn()
    const { rerender } = render(<Harness options={{ isSuspended: () => false }} run={{ 'a.plain': plain }} />)
    rerender(<Harness options={{ isSuspended: () => false }} run={{ 'a.plain': plain }} />)
    act(() => {
      press(document.body, { key: 'j', ctrlKey: true })
    })
    expect(plain).toHaveBeenCalledOnce()
  })
})
