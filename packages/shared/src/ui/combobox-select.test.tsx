import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ComboboxSelect } from './combobox-select'
import { FolderPicker, FOLDER_ROOT, type FolderNode } from './folder-picker'
import { Dialog, DialogContent, DialogTitle } from './dialog'

const folders: FolderNode[] = [
  {
    value: '/c', name: 'Collège', children: [
      { value: '/c/3', name: '3e', children: [{ value: '/c/3/g', name: 'Géométrie' }, { value: '/c/3/a', name: 'Algèbre' }] },
    ],
  },
]

function Picker({ onChange = () => {}, allowRoot = false }: { onChange?: (v: string) => void; allowRoot?: boolean }) {
  const [value, setValue] = useState<string | null>('/c')
  return <FolderPicker ariaLabel="Dossier" folders={folders} value={value} allowRoot={allowRoot} onChange={v => { setValue(v); onChange(v) }} />
}

const names = () => screen.queryAllByRole('option').map(o => o.textContent)

describe('ComboboxSelect', () => {
  it('shows the chosen option and lists everything, indented, when opened', async () => {
    const user = userEvent.setup()
    render(<Picker />)
    const field = screen.getByRole('combobox', { name: 'Dossier' })
    expect(field).toHaveValue('Collège')
    expect(field).toHaveAttribute('aria-expanded', 'false')
    await user.click(field)
    await user.keyboard('{ArrowDown}')
    expect(field).toHaveAttribute('aria-expanded', 'true')
    expect(names()).toEqual(['Collège', '3e', 'Géométrie', 'Algèbre'])
  })

  it('filters on the full path while typing, ignoring accents and case', async () => {
    const user = userEvent.setup()
    render(<Picker />)
    const field = screen.getByRole('combobox', { name: 'Dossier' })
    await user.click(field)
    await user.keyboard('3E/GEO')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(names()[0]).toContain('Géométrie')
    expect(names()[0]).toContain('Collège/3e/Géométrie')
  })

  it('opens from the closed field as soon as something is typed', async () => {
    const user = userEvent.setup()
    render(<Picker />)
    await user.click(screen.getByRole('combobox', { name: 'Dossier' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.keyboard('alg')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
  })

  it('picks with the arrows and Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Picker onChange={onChange} />)
    const field = screen.getByRole('combobox', { name: 'Dossier' })
    await user.click(field)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(field.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[2].id)
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('/c/3/g')
    expect(field).toHaveValue('Géométrie')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('jumps with Home and End while the filter is empty', async () => {
    const user = userEvent.setup()
    render(<Picker />)
    const field = screen.getByRole('combobox', { name: 'Dossier' })
    await user.click(field)
    await user.keyboard('{ArrowDown}{End}')
    expect(field.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[3].id)
    await user.keyboard('{Home}')
    expect(field.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id)
  })

  it('keeps the value when Escape closes the list', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Picker onChange={onChange} />)
    const field = screen.getByRole('combobox', { name: 'Dossier' })
    await user.click(field)
    await user.keyboard('alg')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    expect(field).toHaveValue('Collège')
  })

  it('says so when the filter leaves nothing, and Enter picks nothing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Picker onChange={onChange} />)
    await user.click(screen.getByRole('combobox', { name: 'Dossier' }))
    await user.keyboard('physique{Enter}')
    expect(screen.getByText('Aucun dossier')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('offers a « Racine » option first when allowed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Picker onChange={onChange} allowRoot />)
    await user.click(screen.getByRole('combobox', { name: 'Dossier' }))
    await user.keyboard('{ArrowDown}{Home}')
    expect(names()[0]).toBe('Racine')
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith(FOLDER_ROOT)
  })

  it('picks with the mouse', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Picker onChange={onChange} />)
    await user.click(screen.getByRole('combobox', { name: 'Dossier' }))
    await user.keyboard('{ArrowDown}')
    await user.click(screen.getByRole('option', { name: /Algèbre/ }))
    expect(onChange).toHaveBeenCalledWith('/c/3/a')
  })

  it('stays usable with 500 options', async () => {
    const user = userEvent.setup()
    const options = Array.from({ length: 500 }, (_, i) => ({ value: `v${i}`, label: `Dossier ${i}` }))
    render(<ComboboxSelect ariaLabel="Gros" options={options} value={null} onChange={() => {}} />)
    await user.click(screen.getByRole('combobox', { name: 'Gros' }))
    await user.keyboard('dossier 49')
    expect(screen.getAllByRole('option')).toHaveLength(11)
  })

  it('keeps the selection when reopened', async () => {
    const user = userEvent.setup()
    render(<Picker />)
    const field = screen.getByRole('combobox', { name: 'Dossier' })
    await user.click(field)
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(field).toHaveValue('3e')
    await user.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    expect(field.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id)
  })

  it('in a modal, Escape closes the list first and the modal second', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent>
          <DialogTitle>Nouveau</DialogTitle>
          <Picker />
        </DialogContent>
      </Dialog>
    )
    const field = screen.getByRole('combobox', { name: 'Dossier' })
    await user.click(field)
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ComboboxSelect creatable', () => {
  function Chapters({ onChange }: { onChange: (v: string) => void }) {
    const [value, setValue] = useState<string | null>(null)
    return (
      <ComboboxSelect
        ariaLabel="Chapitre"
        options={[{ value: 'Géométrie', label: 'Géométrie' }]}
        value={value}
        onChange={v => { setValue(v); onChange(v) }}
        creatable={{ label: q => `Créer « ${q} »`, toValue: q => q }}
      />
    )
  }

  it('takes the typed name as the value and offers to create it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Chapters onChange={onChange} />)
    await user.click(screen.getByRole('combobox', { name: 'Chapitre' }))
    await user.keyboard('Algèbre')
    expect(onChange).toHaveBeenLastCalledWith('Algèbre')
    expect(names()).toEqual(['Créer « Algèbre »'])
  })

  it('does not offer to create a name that exists (accents and case aside)', async () => {
    const user = userEvent.setup()
    render(<Chapters onChange={() => {}} />)
    await user.click(screen.getByRole('combobox', { name: 'Chapitre' }))
    await user.keyboard('geometrie')
    expect(names()).toEqual(['Géométrie'])
  })
})
