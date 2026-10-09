import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StatusBanner } from './StatusBanner'

describe('StatusBanner', () => {
  it('une erreur est une alerte, une info un statut (classes de theme.css)', () => {
    const { rerender } = render(<StatusBanner kind="error">Perdu</StatusBanner>)
    expect(screen.getByRole('alert')).toHaveClass('status-banner')
    expect(screen.getByRole('alert')).not.toHaveClass('status-banner--info')
    rerender(<StatusBanner kind="info">Prêt</StatusBanner>)
    expect(screen.getByRole('status')).toHaveClass('status-banner', 'status-banner--info')
  })

  it('l\'action et la croix n\'apparaissent que si on les donne', async () => {
    const user = userEvent.setup()
    const run = vi.fn()
    const onDismiss = vi.fn()
    const { rerender } = render(<StatusBanner kind="info">Texte</StatusBanner>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    rerender(
      <StatusBanner kind="info" action={{ label: 'Redémarrer', run }} onDismiss={onDismiss} dismissLabel="Fermer">
        Texte
      </StatusBanner>,
    )
    await user.click(screen.getByRole('button', { name: 'Redémarrer' }))
    await user.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(run).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
