import { SettingToggle } from '@suite/shared/settings'
import { SYMBOL_FAMILIES } from './toolbarCatalog'
import { useToolbarFamilies } from './useToolbarFamilies'

/** L'onglet « Barre d'outils » des paramètres : une famille de signes par interrupteur, appliqué en direct. */
export function ToolbarSettingsPanel() {
  const hidden = useToolbarFamilies(state => state.hidden)
  const setVisible = useToolbarFamilies(state => state.setVisible)
  return (
    <div>
      {SYMBOL_FAMILIES.map(family => (
        <SettingToggle
          key={family.name}
          label={family.name}
          description={family.symbols.map(symbol => symbol.glyph).join('  ')}
          checked={!hidden.includes(family.name)}
          onCheckedChange={visible => setVisible(family.name, visible)}
        />
      ))}
    </div>
  )
}
