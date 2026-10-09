import { SuiteApp } from '@suite/shared/app'
import { HomeScreen, SaveFailedDialog, UnreadableFileDialog, createSessionStore, recentItem, useFileSession, useWindowTitle } from '@suite/shared/files'
import { app } from './app.config'
import { useCommand } from './commands'
import { TextDocument } from './TextDocument'
import { textFiles } from './textFiles'

const session = createSessionStore(app.id)
const nameOf = (path: string) => path.split(/[\\/]/).pop() ?? path

/** The frame, a home screen with the recent files, and a text area on the open file. */
export default function App() {
  const files = useFileSession(textFiles, { session })
  const recent = session(state => state.recentFiles)
  const open = files.path !== null
  useWindowTitle(app.name, open ? nameOf(files.path!) : null)
  useCommand('file.new', () => void files.create(null))

  return (
    <SuiteApp
      app={app}
      file={{ open, name: open ? nameOf(files.path!) : undefined, path: files.path ?? undefined, status: files.saveStatus === 'saved' ? 'saved' : files.saveStatus === 'error' ? 'error' : 'saving' }}
      overlays={
        <>
          {files.prompt && <SaveFailedDialog message={files.prompt.message} continueLabel={files.prompt.continueLabel} onContinue={files.prompt.onContinue} onCancel={files.dismissPrompt} />}
          {files.failure && <UnreadableFileDialog failure={files.failure} onClose={files.dismissFailure} />}
        </>
      }
    >
      {open ? (
        <TextDocument session={files} />
      ) : (
        <HomeScreen mark={app.mark} instruction="Crée un fichier texte (Ctrl+N) ou rouvre un des derniers." recent={recent.map(recentItem)} onOpen={path => void files.open(path)} />
      )}
    </SuiteApp>
  )
}
