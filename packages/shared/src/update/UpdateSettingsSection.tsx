import { SettingsSection } from '../settings/SettingsSection'
import { Button } from '../ui'
import type { UpdateCheckHandle, UpdateCheckStatus } from './useAppUpdater'

const UPDATE_STATUS_LABEL: Partial<Record<UpdateCheckStatus, string>> = {
  checking: 'Vérification en cours…',
  'up-to-date': 'À jour',
  error: 'Échec de la vérification',
}

/**
 * The « Mises à jour » group of a settings panel: a manual check, or — once an
 * update is downloaded — the same restart action the app-wide banner offers.
 * Every app drops it into a panel and feeds it `useAppUpdater()`'s state.
 */
export function UpdateSettingsSection({
  status,
  checkNow,
  updateReady,
  applyUpdate,
}: Partial<UpdateCheckHandle> & Pick<UpdateCheckHandle, 'status' | 'checkNow'>) {
  return (
    <SettingsSection title="Mises à jour" description="Vérifie manuellement si une nouvelle version est disponible.">
      {updateReady ? (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5 }}>Mise à jour prête</span>
          <Button
            onClick={() => {
              void applyUpdate?.()
            }}
          >
            Redémarrer
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            variant="outline"
            onClick={() => {
              void checkNow()
            }}
            disabled={status === 'checking'}
          >
            Rechercher les mises à jour
          </Button>
          {UPDATE_STATUS_LABEL[status] && (
            <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>{UPDATE_STATUS_LABEL[status]}</span>
          )}
        </div>
      )}
    </SettingsSection>
  )
}
