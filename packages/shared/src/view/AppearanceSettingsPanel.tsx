import { Minus, Plus } from 'lucide-react'
import { SettingToggle } from '../settings/SettingToggle'
import { SettingsSection } from '../settings/SettingsSection'
import { Button } from '../ui'
import { useDensity, useFontFamily, useUiZoom } from './hooks'
import type { ViewOptions } from './useApplyView'
import { ZOOM_MAX, ZOOM_MIN } from './zoom'

/** The fonts the panel offers. `''` is the theme's own. */
export const FONT_CHOICES: readonly { label: string; value: string }[] = [
  { label: 'Par défaut (Geist)', value: '' },
  { label: 'Système', value: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: 'Avec empattements', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Largeur fixe', value: 'ui-monospace, "Cascadia Code", Consolas, monospace' },
]

/** « Apparence »: zoom, density and font. Changes apply at once and are remembered. */
export function AppearanceSettingsPanel({ view = {} }: { view?: ViewOptions }) {
  const { percent, zoomIn, zoomOut, reset } = useUiZoom()
  const { compact, set: setCompact } = useDensity()
  const { fontFamily, set: setFont } = useFontFamily()
  return (
    <>
      {view.zoom !== false && (
        <SettingsSection title="Zoom" description="Taille de toute l’application.">
          <div role="group" aria-label="Zoom de l’interface" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button variant="outline" size="icon-sm" aria-label="Dézoomer" disabled={percent <= ZOOM_MIN} onClick={zoomOut}>
              <Minus aria-hidden />
            </Button>
            <span style={{ minWidth: 48, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{percent} %</span>
            <Button variant="outline" size="icon-sm" aria-label="Zoomer" disabled={percent >= ZOOM_MAX} onClick={zoomIn}>
              <Plus aria-hidden />
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              100 %
            </Button>
          </div>
        </SettingsSection>
      )}
      {view.density !== false && (
        <SettingsSection title="Densité">
          <SettingToggle
            label="Mode condensé"
            description="Réduit les marges et les espacements pour voir plus de contenu à la fois."
            checked={compact}
            onCheckedChange={setCompact}
          />
        </SettingsSection>
      )}
      {view.font !== false && (
        <SettingsSection title="Police">
          <select
            aria-label="Police de l’interface"
            value={FONT_CHOICES.some(choice => choice.value === fontFamily) ? fontFamily : ''}
            onChange={event => setFont(event.target.value)}
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)' }}
          >
            {FONT_CHOICES.map(choice => (
              <option key={choice.label} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </SettingsSection>
      )}
    </>
  )
}
