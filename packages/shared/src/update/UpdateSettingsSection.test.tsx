import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateSettingsSection } from './UpdateSettingsSection'

describe('UpdateSettingsSection', () => {
  it('runs the manual check from the button', async () => {
    const checkNow = vi.fn().mockResolvedValue(undefined)
    render(<UpdateSettingsSection status="idle" checkNow={checkNow} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Rechercher les mises à jour' }))
    expect(checkNow).toHaveBeenCalled()
  })

  it.each([
    ['up-to-date', 'À jour'],
    ['error', 'Échec de la vérification'],
    ['checking', 'Vérification en cours…'],
  ] as const)('shows the %s status', (status, label) => {
    render(<UpdateSettingsSection status={status} checkNow={vi.fn()} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('disables the check while one is running', () => {
    render(<UpdateSettingsSection status="checking" checkNow={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Rechercher les mises à jour' })).toBeDisabled()
  })

  it('offers the restart once an update is ready', async () => {
    const applyUpdate = vi.fn().mockResolvedValue(undefined)
    render(<UpdateSettingsSection status="idle" checkNow={vi.fn()} updateReady applyUpdate={applyUpdate} />)
    expect(screen.queryByRole('button', { name: 'Rechercher les mises à jour' })).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Redémarrer' }))
    expect(applyUpdate).toHaveBeenCalled()
  })
})
