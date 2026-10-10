import { Fragment } from 'react'
import { useStore } from 'zustand'
import { useBinding } from '../commands/useCommand'
import { formatBinding } from '../commands/keys'
import { isToolbarItemLocked, toolbarHiddenStore, type ToolbarEntry, type ToolbarZone } from '../shell'
import { SettingToggle } from './SettingToggle'
import { SettingsSection } from './SettingsSection'

const ZONE_TITLES: Record<ToolbarZone, string> = {
  file: 'Fichier',
  edit: 'Édition',
  title: 'Titre',
  app: 'Application',
  panels: 'Panneaux',
  view: 'Affichage',
  system: 'Système',
}

function EntryRow({ appId, entry }: { appId: string; entry: ToolbarEntry }) {
  const store = toolbarHiddenStore(appId)
  const hidden = useStore(store, state => state.value)
  const binding = useBinding(entry.command ?? '')
  const locked = entry.locked || isToolbarItemLocked(entry.id)
  const shortcut = entry.command === undefined ? '' : formatBinding(binding)
  return (
    <SettingToggle
      label={entry.label}
      description={[locked ? 'Toujours présent' : '', shortcut].filter(Boolean).join(' · ') || undefined}
      checked={locked || !hidden.includes(entry.id)}
      disabled={locked}
      onCheckedChange={checked =>
        store.getState().set(current => (checked ? current.filter(id => id !== entry.id) : [...new Set([...current, entry.id])]))
      }
    />
  )
}

/**
 * « Boutons de la barre »: one switch per item of the top bar, by zone. Applied at once and remembered
 * (no draft). A hidden item stays a command: its shortcut and the palette still work.
 */
export function ToolbarSettingsPanel({ appId, entries }: { appId: string; entries: readonly ToolbarEntry[] }) {
  const zones = [...new Set(entries.map(entry => entry.zone))]
  return (
    <>
      {zones.map(zone => (
        <Fragment key={zone}>
          <SettingsSection title={ZONE_TITLES[zone]}>
            {entries
              .filter(entry => entry.zone === zone)
              .map(entry => (
                <EntryRow key={entry.id} appId={appId} entry={entry} />
              ))}
          </SettingsSection>
        </Fragment>
      ))}
    </>
  )
}
