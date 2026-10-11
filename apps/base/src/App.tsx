import { SuiteApp } from '@suite/shared/app'
import { useHistoryCommands } from '@suite/shared/history'
import { useFileSession } from '@suite/shared/files'
import { app } from './app.config'
import { useCommand } from './commands'
import { documentPort, newDocumentName } from './documents'
import { TextDocument } from './TextDocument'

/** `left` and `right` take the side panels; the work area is `TextDocument` here, replace it. */
export default function App() {
  const session = useFileSession(documentPort)
  useHistoryCommands(session)
  useCommand('file.new', () => {
    const name = newDocumentName()
    void documentPort.write(name, '').then(() => session.open(name))
  })
  useCommand('file.close', () => void session.close(), session.path !== null)
  return (
    <SuiteApp app={app} file={{ open: session.path !== null, name: session.path ?? undefined, path: session.path ?? undefined }}>
      <main style={{ flex: 1, display: 'flex' }}>
        <TextDocument session={session} />
      </main>
    </SuiteApp>
  )
}
