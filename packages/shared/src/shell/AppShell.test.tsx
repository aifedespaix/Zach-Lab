import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppShell } from './AppShell'
import { BootScreen } from './BootScreen'
import { ResizablePanel } from './ResizablePanel'
import { createPanelWidthStorage } from './panelWidth'

const leftStorage = createPanelWidthStorage({ key: 'test:shell-left', min: 100, max: 400, fallback: 200 })
const rightStorage = createPanelWidthStorage({ key: 'test:shell-right', min: 150, max: 600, fallback: 300 })

describe('AppShell', () => {
  beforeEach(() => localStorage.clear())

  it('n\'affiche que la zone centrale quand on ne lui donne ni panneau ni barre d\'outils', () => {
    render(
      <AppShell>
        <main>Contenu</main>
      </AppShell>,
    )
    expect(screen.getByRole('main')).toHaveTextContent('Contenu')
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('range les panneaux de part et d\'autre du centre, dans cet ordre', () => {
    render(
      <AppShell
        left={<ResizablePanel side="left" label="Panneau gauche" storage={leftStorage}>G</ResizablePanel>}
        right={<ResizablePanel side="right" label="Panneau droit" storage={rightStorage}>D</ResizablePanel>}
      >
        <main>Centre</main>
      </AppShell>,
    )
    const order = ['Panneau gauche', 'main', 'Panneau droit']
    const found = [
      screen.getByRole('complementary', { name: 'Panneau gauche' }),
      screen.getByRole('main'),
      screen.getByRole('complementary', { name: 'Panneau droit' }),
    ]
    expect(found).toHaveLength(order.length)
    // Précède : 4 = DOCUMENT_POSITION_FOLLOWING
    expect(found[0].compareDocumentPosition(found[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(found[1].compareDocumentPosition(found[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('met la barre d\'outils en tête de la colonne centrale, au-dessus du contenu', () => {
    render(
      <AppShell toolbar={<button type="button">Ouvrir</button>}>
        <main>Centre</main>
      </AppShell>,
    )
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('button', { name: 'Ouvrir' })).toBeInTheDocument()
    expect(header.compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('affiche les surcouches (écran de démarrage, dialogues) sans les mêler à la mise en page', () => {
    render(
      <AppShell overlays={<BootScreen>logo</BootScreen>}>
        <main>Centre</main>
      </AppShell>,
    )
    expect(screen.getByRole('status', { name: 'Chargement de l’application' })).toHaveTextContent('logo')
  })
})

describe('ResizablePanel', () => {
  beforeEach(() => localStorage.clear())

  it('est une région nommée avec sa poignée et son contenu', () => {
    render(
      <ResizablePanel side="left" label="Panneau gauche" resizeLabel="Redimensionner la barre" storage={leftStorage}>
        <p>Dedans</p>
      </ResizablePanel>,
    )
    const region = screen.getByRole('complementary', { name: 'Panneau gauche' })
    expect(within(region).getByText('Dedans')).toBeInTheDocument()
    expect(within(region).getByRole('separator', { name: 'Redimensionner la barre' })).toBeInTheDocument()
  })

  it('prend la largeur enregistrée, ou celle par défaut au premier lancement', () => {
    const { unmount } = render(<ResizablePanel side="left" label="P" storage={leftStorage}>x</ResizablePanel>)
    expect(screen.getByRole('complementary')).toHaveStyle({ width: '200px' })
    unmount()
    leftStorage.save(333)
    render(<ResizablePanel side="left" label="P" storage={leftStorage}>x</ResizablePanel>)
    expect(screen.getByRole('complementary')).toHaveStyle({ width: '333px' })
  })

  it.each(['abc', '-50', '99999', 'NaN', ''])('ramène la largeur enregistrée %j dans les bornes', raw => {
    localStorage.setItem('test:shell-left', raw)
    render(<ResizablePanel side="left" label="P" storage={leftStorage}>x</ResizablePanel>)
    const width = Number.parseInt(screen.getByRole('complementary').style.width, 10)
    expect(width).toBeGreaterThanOrEqual(100)
    expect(width).toBeLessThanOrEqual(400)
  })

  it('ne se laisse pas écraser par la mise en page flex : la zone centrale cède, pas le panneau', () => {
    render(<ResizablePanel side="right" label="P" storage={rightStorage}>x</ResizablePanel>)
    expect(screen.getByRole('complementary')).toHaveStyle({ flexShrink: '0' })
  })

  it('met sa bordure du côté de la zone centrale', () => {
    const { unmount } = render(<ResizablePanel side="left" label="P" storage={leftStorage}>x</ResizablePanel>)
    expect(screen.getByRole('complementary').style.borderRight).not.toBe('')
    unmount()
    render(<ResizablePanel side="right" label="P" storage={rightStorage}>x</ResizablePanel>)
    expect(screen.getByRole('complementary').style.borderLeft).not.toBe('')
  })
})

describe('BootScreen', () => {
  it('recouvre l\'écran et annonce le chargement', () => {
    render(<BootScreen>logo</BootScreen>)
    const status = screen.getByRole('status', { name: 'Chargement de l’application' })
    expect(status).toHaveStyle({ position: 'fixed' })
    expect(status).toHaveTextContent('logo')
  })
})
