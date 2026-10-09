import { SuiteApp } from '@suite/shared/app'
import { app } from './app.config'

/** Replace the `<main>` with the work area of the app; `left` and `right` take its side panels. */
export default function App() {
  return (
    <SuiteApp app={app}>
      <main style={{ flex: 1, padding: 16 }}>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
          Zone de travail vide. Remplace ce texte par le contenu de ton logiciel.
        </p>
      </main>
    </SuiteApp>
  )
}
