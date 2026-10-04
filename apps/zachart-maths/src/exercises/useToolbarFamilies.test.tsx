import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { Toolbar } from './Toolbar'
import { ToolbarSettingsPanel } from './ToolbarSettingsPanel'
import { SYMBOL_FAMILIES } from './toolbarCatalog'
import { useToolbarFamilies } from './useToolbarFamilies'

const first = SYMBOL_FAMILIES[0].name

beforeEach(() => {
  localStorage.clear()
  useToolbarFamilies.setState({ hidden: [] })
})

describe('useToolbarFamilies', () => {
  it('masque une famille en direct, la restaure, et n\'écrit que sur commit', async () => {
    const saved = useToolbarFamilies.getState().snapshot()
    useToolbarFamilies.getState().setVisible(first, false)
    expect(useToolbarFamilies.getState().hidden).toEqual([first])
    expect(localStorage.getItem('zachart-maths:toolbar-hidden')).toBeNull()

    useToolbarFamilies.getState().restore(saved)
    expect(useToolbarFamilies.getState().hidden).toEqual([])

    useToolbarFamilies.getState().setVisible(first, false)
    await useToolbarFamilies.getState().commit()
    expect(JSON.parse(localStorage.getItem('zachart-maths:toolbar-hidden')!)).toEqual([first])
  })
})

describe('Toolbar et réglages', () => {
  it('une famille masquée disparaît de la barre', () => {
    useToolbarFamilies.setState({ hidden: [first] })
    render(<Toolbar target="text" onSymbol={() => {}} />)
    expect(screen.queryByRole('group', { name: first })).toBeNull()
    expect(screen.getByRole('group', { name: SYMBOL_FAMILIES[1].name })).toBeTruthy()
  })

  it('un interrupteur met la barre à jour tout de suite', async () => {
    render(
      <>
        <ToolbarSettingsPanel />
        <Toolbar target="text" onSymbol={() => {}} />
      </>,
    )
    expect(screen.getByRole('group', { name: first })).toBeTruthy()
    await userEvent.click(screen.getByRole('switch', { name: new RegExp(first) }))
    expect(screen.queryByRole('group', { name: first })).toBeNull()
  })
})
