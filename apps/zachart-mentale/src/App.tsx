// src/App.tsx
// Registers the command catalogue with the shared framework, as a side effect of
// loading the file. It must be a VALUE import: every other import of this module
// is `import type`, which the build erases, and without the catalogue there is
// no shortcut, no palette entry and no toolbar button (see catalogRegistration.test.ts).
import './types/commands'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MindMapCanvas } from './components/MindMapCanvas'
import { CanvasErrorBoundary } from './components/CanvasErrorBoundary'
import { CorruptedMapDialog } from './components/CorruptedMapDialog'
import { SaveFailedDialog } from './components/SaveFailedDialog'
import { FileSidebar } from './components/sidebar/FileSidebar'
import { QuizFrame } from './components/quiz/QuizFrame'
import { QuizSummaryModal } from './components/quiz/QuizSummaryModal'
import { useQuizSettingsStore } from './state/useQuizSettingsStore'
import { useCardsStore } from './state/useCardsStore'
import { useWorkspaceStore, describeError } from './state/useWorkspaceStore'
import { useQuizStore } from './state/useQuizStore'
import { useCardDetailStore } from './state/useCardDetailStore'
import { useCardHoverStore } from './state/useCardHoverStore'
import { useAutosave, useFileSession, type DocumentPort } from '@suite/shared/files'
import { loadMindMap, saveMindMap, mindMapExists, loadMindMapMeta } from './persistence/fileStore'
import { duplicateMap } from './persistence/fileOps'
import { useSyncStore } from './state/useSyncStore'
import { canEditContent } from './sync/permissions'
import { ReadOnlyMapDialog } from './components/ReadOnlyMapDialog'
import { fileNameOf, parentDirOf, repairedCopyPath } from './persistence/paths'
import { repairCards, validateCards, type CardIssue } from './validation/cardsValidation'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { useWindowTitle } from '@suite/shared/files'
import { windowTitleFor } from './persistence/windowTitle'
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard'
import { useFileDropZone } from './hooks/useFileDropZone'
import { useLaunchFile } from '@suite/shared/files'
import { imageBlockFrom } from './content/imageBlock'
import { mimeForPath } from './content/pickImage'
import { contentOf } from './content/blocks'
import { readFile } from '@tauri-apps/plugin-fs'
import { AppToolbar } from './components/toolbar/AppToolbar'
import { AppShell, BootScreen } from '@suite/shared/shell'
import { ClosingSyncScreen } from './components/ClosingSyncScreen'
import { AnimatedLogo } from './components/AnimatedLogo'
import { RecentFilesList } from './components/RecentFilesList'
import { collectMindMapPaths } from './persistence/fileTree'
import { APP_ID, useAppearanceSettingsStore } from './state/useAppearanceSettingsStore'
import { useShortcutSettingsStore } from '@suite/shared/commands'
import { useCardSelectionStore } from './state/useCardSelectionStore'
import { useThemeDomSync } from '@suite/shared/theme'
import { useApplyView } from '@suite/shared/view'
import { useAppUpdater, UpdateReadyBanner } from '@suite/shared/update'
import { useAutoSync } from './hooks/useAutoSync'
import type { SyncResult } from './sync/syncService'
import { CardDetailPanel } from './components/detail/CardDetailPanel'
import type { Card, MindMapMeta } from './types/card'

/** A map that failed validation, held until the user decides what to do with it. */
interface PendingRepair {
  path: string
  fileName: string
  /** The raw cards as read from disk — the repair works on a copy of these. */
  cards: Card[]
  issues: CardIssue[]
}

/** What a map file holds on disk: its cards and its metadata. */
interface MindMapDocument {
  cards: Card[]
  meta: MindMapMeta | null
}

/** How many « (Réparée n) » names to try before giving up on finding a free one. */
const MAX_REPAIR_ATTEMPTS = 100

/**
 * The boot screen's floor: on a fast disk `init` can resolve almost
 * instantly, which would turn the animation into an unreadable flash. This
 * keeps it on screen long enough to actually register, whatever the real
 * load time was.
 */
const BOOT_SCREEN_MIN_DURATION_MS = 1500

/**
 * The first « [Nom] (Réparée).zmap » that does not exist yet. A repair must
 * never overwrite anything — neither the corrupt original nor an earlier
 * repaired copy the user may have already worked in.
 */
async function freeRepairedPath(path: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
    const candidate = repairedCopyPath(path, attempt)
    if (!(await mindMapExists(candidate))) return candidate
  }
  throw new Error(`trop de copies réparées de ${fileNameOf(path)} existent déjà`)
}

function App() {
  const cards = useCardsStore(s => s.history.present)
  const loadCards = useCardsStore(s => s.loadCards)
  const currentFilePath = useWorkspaceStore(s => s.currentFilePath)
  const setCurrentFile = useWorkspaceStore(s => s.setCurrentFile)
  const refreshFolder = useWorkspaceStore(s => s.refreshFolder)
  const workspaceInitializing = useWorkspaceStore(s => s.initializing)
  const recentFiles = useWorkspaceStore(s => s.recentFiles)
  const rootFolders = useWorkspaceStore(s => s.rootFolders)
  // A file gone from every scanned tree — moved or deleted outside the app —
  // must not leave a dead row on the empty-state screen.
  const openableRecentFiles = useMemo(() => {
    const existing = collectMindMapPaths(rootFolders.flatMap(f => f.tree))
    return recentFiles.filter(file => existing.has(file.path))
  }, [recentFiles, rootFolders])
  const quizActive = useQuizStore(s => s.active)
  const [saveFailed, setSaveFailed] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingRepair, setPendingRepair] = useState<PendingRepair | null>(null)
  // The read-only fork offer is opened on demand — when the user reaches for a
  // locked map's lock — rather than blocking the map the moment it is opened.
  const [forkPromptOpen, setForkPromptOpen] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [repairError, setRepairError] = useState<string | null>(null)
  // The path whose cards are actually in the canvas right now. `currentFilePath`
  // is only an INTENT until the load succeeds AND the structure validates; this
  // is the fact. It is what a failed switch reverts to, what the canvas is keyed
  // and gated on, and what autosave writes to — so nothing can ever render, or
  // be written, for a file the app has not fully loaded.
  const [loadedPath, setLoadedPath] = useState<string | null>(null)
  const [loadedMeta, setLoadedMeta] = useState<MindMapMeta | null>(null)
  const currentUser = useSyncStore(s => s.currentUser)
  const mainRef = useRef<HTMLElement | null>(null)
  useGlobalShortcuts()
  // Only does anything when the user turned automatic sync on.
  useAutoSync()
  useWindowTitle(windowTitleFor(currentFilePath))
  useThemeDomSync()
  // Paints the font (and the zoom variables, off here: Mentale's canvas is not checked at other zooms, S1).
  useApplyView(APP_ID, { zoom: false })
  const { updateReady, dismissed, applyUpdate, dismissUpdate, status: updateStatus, checkNow: checkForUpdates } =
    useAppUpdater()
  const { flush } = useAutosave(
    cardsToSave => saveMindMap(loadedPath ?? '', cardsToSave),
    cards,
    {
      delay: 500,
      enabled: loadedPath !== null && loadedPath === currentFilePath,
      scope: loadedPath ?? '',
      onError: () => setSaveFailed(true),
    }
  )
  const syncResult = useSyncStore(s => s.lastResult)
  /** L'avancement du run de fermeture, montré par l'écran de chargement. */
  const syncProgress = useSyncStore(s => s.progress)
  /**
   * The ONE follow-up a sync's relocations get.
   *
   * It lives here rather than in the sidebar because a sync has three triggers
   * — the button, the background timer, the settings panel — and a run that
   * relocated the open file automatically otherwise left `currentFilePath` on
   * the old path: `useAutosave`, still armed for that path, recreated the old
   * file holding the user's newest edits while the synced copy at the new path
   * went stale. The map was silently split in two, and the tree row left behind
   * opened as « ce fichier n'existe plus ».
   *
   * The order is not cosmetic: `flush` first, because the `loadedPath` change
   * that follows cancels the debounce — a pending save has to be on disk before
   * that. Then the pointer. Then the tree, which a pull and a relocation both
   * leave behind the disk.
   */
  const handledSyncResult = useRef<SyncResult | null>(null)
  useEffect(() => {
    if (syncResult === null || syncResult === handledSyncResult.current) return
    handledSyncResult.current = syncResult
    // Neither a pull, a relocation nor a type adoption: nothing moved on
    // disk, so the tree is current and there is nobody to follow. `?? 0`: the
    // counters are optional in `SyncResult`, and its readers take them that way.
    if (syncResult.pulled === 0 && (syncResult.relocated ?? 0) === 0 && (syncResult.reclassified ?? 0) === 0) return

    // The path open when the result came in: THAT file's move is the one that
    // matters here, not another file's in the same folder.
    const openPath = useWorkspaceStore.getState().currentFilePath
    const moved =
      openPath === null ? undefined : (syncResult.moved ?? []).find(entry => entry.from === openPath)

    void (async () => {
      try {
        await flush()
      } catch {
        // Already surfaced through `useAutosave`'s own error callback — the
        // « Erreur de sauvegarde » banner. The open file stays the one edited.
      }
      // Re-read as we act: `flush` may have waited, and the user may have
      // opened something else in the meantime. Dragging them back to the moved
      // file would be a second surprise.
      if (moved !== undefined && useWorkspaceStore.getState().currentFilePath === moved.from) {
        setCurrentFile(moved.to)
      }
      // Une adoption de type a réécrit le `meta` sur le disque sans changer le
      // chemin : forcer la révision fait relire chaque ligne par
      // `useMindMapAuthor`, sinon la pilule garde l’ancien type.
      useWorkspaceStore.getState().bumpFileMetaRevision()
      const folder = useSyncStore.getState().syncFolderPath
      if (folder !== null) await refreshFolder(folder)
    })()
  }, [syncResult, flush, setCurrentFile, refreshFolder])
  const { requestOpenFile, prompt, dismissPrompt, closing } = useUnsavedChangesGuard(flush, setCurrentFile)
  /**
   * An image dropped on a card is appended to that card's definition.
   *
   * Reads the card fresh from the store rather than closing over a snapshot:
   * a drop can land long after this callback was created, and appending to a
   * stale block list would silently discard edits made in between.
   */
  const handleDropImageOnCard = useCallback(
    async (cardId: string, path: string) => {
      const mapPath = useWorkspaceStore.getState().currentFilePath
      if (mapPath === null) return
      const meta = await loadMindMapMeta(mapPath).catch(() => null)
      const dropUser = useSyncStore.getState().currentUser
      if (meta !== null && (dropUser === null || !canEditContent(meta, dropUser))) return
      try {
        const source = { bytes: await readFile(path), mime: mimeForPath(path), name: fileNameOf(path) }
        // Re-checked AFTER the read: a large file takes long enough for the
        // user to switch maps, and writing into the old map's sidecar would
        // leave an orphan file and drop the image on the floor in silence.
        if (useWorkspaceStore.getState().currentFilePath !== mapPath) return
        const block = await imageBlockFrom(mapPath, source)
        if (useWorkspaceStore.getState().currentFilePath !== mapPath) return
        const cards = useCardsStore.getState().history.present
        const card = cards.find(entry => entry.id === cardId)
        if (card === undefined) return
        useCardsStore.getState().updateContent(cardId, [...contentOf(card), block])
      } catch (error) {
        // The app-wide channel the file operations already use, rather than
        // this component's own load-error state: a failed drop is a workspace
        // failure, not a failure to open the map.
        useWorkspaceStore
          .getState()
          .setWorkspaceError(
            error instanceof Error ? error.message : 'Impossible d’ajouter cette image à la carte.'
          )
      }
    },
    []
  )

  const { isDragActive, dropError } = useFileDropZone(mainRef, requestOpenFile, handleDropImageOnCard)
  // Same entry point as the sidebar and drag & drop, so a map opened from the
  // Explorer goes through the unsaved-changes guard like any other switch.
  useLaunchFile(requestOpenFile, { command: 'launch_mind_map', event: 'open-mind-map' })

  useEffect(() => {
    useQuizSettingsStore.getState().init()
    useAppearanceSettingsStore.getState().init()
    useShortcutSettingsStore.getState().init()
    useSyncStore.getState().init()
  }, [])

  const [bootFloorElapsed, setBootFloorElapsed] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setBootFloorElapsed(true), BOOT_SCREEN_MIN_DURATION_MS)
    return () => clearTimeout(timer)
  }, [])
  const showBootScreen = workspaceInitializing || !bootFloorElapsed

  /**
   * Open fiches belong to the map that is open, not to the application.
   *
   * Carrying them across a file switch would leave the panel showing cards
   * that no longer exist — or, worse, cards from the previous map whose ids
   * happen to collide with the new one's.
   */
  useEffect(() => {
    useCardDetailStore.getState().closeAll()
    // Selection belongs to the map too: a card id carried across a switch would
    // aim every card shortcut at a card that is no longer on screen — or, worse,
    // at whatever card of the new map happens to share its id.
    useCardSelectionStore.getState().reset()
    // The hover that links a card to its fiche belongs to the previous map too:
    // a hovered id left over on reload would light up the wrong card's fiche.
    useCardHoverStore.getState().reset()
    // The fork offer belongs to the map that raised it: a copy that just opened
    // must not land with the previous file's offer still on screen.
    setForkPromptOpen(false)
  }, [loadedPath])

  /**
   * A quiz closes every fiche, and this is correctness rather than tidiness:
   * `qcm-definition` asks the user to recognise a definition, and a fiche left
   * open beside the question hands them the answer. Same reasoning as the file
   * sidebar, which a quiz also hides.
   */
  useEffect(() => {
    if (quizActive) {
      useCardDetailStore.getState().closeAll()
      useCardSelectionStore.getState().reset()
      useCardHoverStore.getState().reset()
    }
  }, [quizActive])

  /** A deleted card's fiche goes with it; undo brings both back. */
  useEffect(() => {
    useCardDetailStore.getState().retain(new Set(cards.map(card => card.id)))
  }, [cards])

  // The map's file access, as the document session sees it. `validate` keeps the
  // rejected cards so the repair dialog can offer a copy of them.
  const rejectedCardsRef = useRef<Card[]>([])
  const mindMapPort = useMemo<DocumentPort<MindMapDocument>>(
    () => ({
      read: async path => {
        const [cards, meta] = await Promise.all([loadMindMap(path), loadMindMapMeta(path)])
        return cards === null ? null : { cards, meta }
      },
      // The session never edits its own copy (the card store does), so this is
      // only reached by the session's autosave, which stays idle.
      write: (path, doc) => saveMindMap(path, doc.cards),
      validate: raw => {
        const report = validateCards(raw.cards)
        if (report.valid) return { ok: true }
        rejectedCardsRef.current = raw.cards
        return { ok: false, issues: report.issues }
      },
    }),
    []
  )
  const session = useFileSession(mindMapPort)

  // The file a document session holds is the FACT (its cards are read, validated
  // and ready); `currentFilePath` is only the INTENT. The session opens the
  // intent, and only a loaded, valid file ever reaches the store and the canvas.
  const sessionPathRef = useRef<string | null>(null)
  sessionPathRef.current = session.path
  useEffect(() => {
    if (currentFilePath === null) {
      if (session.path !== null) void session.close()
      return
    }
    if (currentFilePath === session.path) return
    setSaveFailed(false)
    setLoadError(null)
    void session.open(currentFilePath)
  }, [currentFilePath, session.path, session.open, session.close])

  // A file the session holds is copied into the card store, then recorded as loaded:
  // the canvas mounts only once its cards are in the store.
  useEffect(() => {
    if (session.path === null) {
      setLoadedPath(null)
      setLoadedMeta(null)
      return
    }
    if (session.doc === null || session.path === loadedPath) return
    loadCards(session.doc.cards)
    setLoadedMeta(session.doc.meta)
    setLoadedPath(session.path)
  }, [session.path, session.doc, loadedPath, loadCards])

  // A failed open keeps the previous file: `currentFilePath` goes back to the one
  // the session still holds (or to null), so the app never lies about what it edits.
  useEffect(() => {
    const error = session.error
    if (error === null) return
    const previousPath = sessionPathRef.current
    const failSwitch = (message: string | null) => {
      setLoadError(message)
      setCurrentFile(previousPath)
    }
    switch (error.kind) {
      case 'missing':
        failSwitch(`Impossible d’ouvrir ${fileNameOf(error.path)} : ce fichier n’existe plus.`)
        return
      case 'invalid':
        // The repair dialog says its own piece, so no load-error line here.
        setRepairError(null)
        setPendingRepair({
          path: error.path,
          fileName: fileNameOf(error.path),
          cards: rejectedCardsRef.current,
          issues: error.issues as CardIssue[],
        })
        failSwitch(null)
        return
      case 'read':
        console.error(
          'Échec du chargement de la carte mentale (le fichier existe mais est illisible ou corrompu) — autosave désactivée pour ne pas l’écraser :',
          error.cause
        )
        failSwitch(`Impossible d’ouvrir ${fileNameOf(error.path)} : fichier illisible ou corrompu.`)
        return
      case 'save':
        setSaveFailed(true)
        setCurrentFile(previousPath)
        return
    }
  }, [session.error, setCurrentFile])

  /**
   * "Créer une copie réparée": repair a DUPLICATE of the raw data, save it
   * beside the original under a free « (Réparée) » name, and open it — through
   * the normal load path, so the copy is validated like any other file before
   * it reaches the canvas. The broken original is never written to.
   */
  const handleRepair = useCallback(async () => {
    if (!pendingRepair) return
    setRepairing(true)
    setRepairError(null)
    try {
      const repaired = repairCards(structuredClone(pendingRepair.cards))
      const targetPath = await freeRepairedPath(pendingRepair.path)
      await saveMindMap(targetPath, repaired)
      // So the copy shows up in the tree next to the file it came from. A bare
      // filename has no folder to re-scan (nothing the sidebar could be showing
      // it in), and asking to scan '' would only raise a workspace error.
      const folder = parentDirOf(pendingRepair.path)
      if (folder) await refreshFolder(folder)
      setPendingRepair(null)
      setCurrentFile(targetPath)
    } catch (error) {
      // Kept open on failure: closing would drop the only offer of a fix.
      setRepairError(`La réparation a échoué : ${describeError(error)}`)
    } finally {
      setRepairing(false)
    }
  }, [pendingRepair, refreshFolder, setCurrentFile])

  const currentFileName = currentFilePath ? fileNameOf(currentFilePath) : null
  const isReadOnly = currentUser !== null && !canEditContent(loadedMeta, currentUser)

  /**
   * Publishes "this map is someone else's" to the store every editing
   * affordance already consults.
   *
   * The canvas overlay only blocks the POINTER. The header's buttons sit above
   * it, and a keyboard shortcut never touches it at all — so without this, a
   * `Suppr` or a `Ctrl+V` would happily edit a file the user was just told is
   * read-only, and autosave would write the result to disk.
   */
  useEffect(() => {
    useCardsStore.getState().setReadOnly(isReadOnly)
  }, [isReadOnly])


  return (
    <AppShell
      // The file tree and the fiches panel are gone for the duration of a quiz: leaving the tree there
      // let the user switch mind maps mid-quiz — which silently answers nothing, loses the round, and is
      // never what clicking a file during a quiz was meant to do. "Terminer le quiz", in the frame's
      // header, is the way back to the editor and to the rest of the workspace. The fiches panel sits
      // outside the canvas column so it spans the full height and takes its width out of the canvas
      // rather than covering it — nothing is hidden, and the tree stays readable beside the fiche it
      // explains.
      left={!quizActive ? <FileSidebar onOpenFile={requestOpenFile} /> : undefined}
      right={!quizActive ? <CardDetailPanel /> : undefined}
      toolbar={
        <>
        {/*
          The whole toolbar is gone for the duration of a quiz, like the file
          tree beside it: every action on it edits the map, and no card may
          change under a quiz in progress. The commands it registers go with
          it, so their shortcuts stop firing too.

          The cards handed to it are the ones in memory, not the file on disk:
          those are what the user is looking at, and they are already
          validated (nothing reaches the canvas otherwise).
        */}
        {!quizActive && (
          <AppToolbar
            filePath={loadedPath}
            cards={cards}
            meta={loadedMeta}
            onOpenFile={requestOpenFile}
            onRequestFork={() => setForkPromptOpen(true)}
            flush={flush}
            updateCheck={{ status: updateStatus, checkNow: checkForUpdates, updateReady, applyUpdate }}
            saveFailed={saveFailed}
          />
        )}
        </>
      }
      overlays={
        <>
          {showBootScreen && (
            <BootScreen>
              <AnimatedLogo mode="draw-fade" size={120} />
            </BootScreen>
          )}
          {/* La synchronisation de fermeture couvre tout : on ne veut pas qu'un clic
              atterrisse dans un canevas pendant qu'il est en train de partir. */}
          {closing && <ClosingSyncScreen progress={syncProgress} />}
        {pendingRepair && (
          <CorruptedMapDialog
            fileName={pendingRepair.fileName}
            repairedFileName={fileNameOf(repairedCopyPath(pendingRepair.path))}
            issues={pendingRepair.issues}
            repairing={repairing}
            error={repairError}
            onCancel={() => setPendingRepair(null)}
            onRepair={handleRepair}
          />
        )}

        {prompt && (
          <SaveFailedDialog
            message={prompt.message}
            detail={prompt.detail}
            continueLabel={prompt.continueLabel}
            onCancel={dismissPrompt}
            onContinue={prompt.onContinue}
          />
        )}
        </>
      }
    >
      {loadError && (
        <div role="alert" className="status-banner">
          <span style={{ flex: 1 }}>⚠ {loadError}</span>
          <button
            type="button"
            aria-label="Masquer le message d’erreur"
            onClick={() => setLoadError(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 15 }}
          >
            ×
          </button>
        </div>
      )}
      {dropError && (
        <div role="alert" className="status-banner">
          <span style={{ flex: 1 }}>⚠ {dropError}</span>
        </div>
      )}
      {!loadError && !dropError && updateReady && !dismissed && (
        <UpdateReadyBanner onApply={applyUpdate} onDismiss={dismissUpdate} />
      )}
      <main ref={mainRef} data-print-area style={{ flex: 1, position: 'relative' }}>
        {isDragActive && (
          <div
            style={{
              position: 'absolute',
              inset: 8,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed var(--primary)',
              borderRadius: 8,
              background: 'color-mix(in oklch, var(--primary), transparent 90%)',
              color: 'var(--primary)',
              fontSize: 16,
              fontWeight: 500,
              pointerEvents: 'none',
            }}
          >
            Déposez la carte mentale ici pour l’ouvrir
          </div>
        )}
        {loadedPath ? (
          // Keyed by the loaded file: switching maps REMOUNTS the canvas
          // instead of feeding a new card set to the previous one. React Flow
          // seeds its node array and runs `fitView` once, on mount — reusing
          // the instance left the viewport framing the file that was open
          // before (often nowhere near the new cards), which is what made a
          // map look like it opened and then vanished.
          <QuizFrame>
            <CanvasErrorBoundary key={loadedPath} onClose={() => setCurrentFile(null)}>
              <MindMapCanvas />
            </CanvasErrorBoundary>
          </QuizFrame>
        ) : currentFilePath ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <AnimatedLogo mode="draw-fade" size={120} />
            <p style={{ margin: 0, maxWidth: 380, color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.5 }}>
              Ouverture de {currentFileName}…
            </p>
          </div>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <AnimatedLogo mode="draw-pulse" size={openableRecentFiles.length > 0 ? 120 : 160} />
            <p style={{ margin: 0, maxWidth: 380, color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.5 }}>
              Sélectionnez ou créez une carte mentale dans la barre latérale, ou glissez-déposez un fichier ici pour
              l’ouvrir.
            </p>
            <RecentFilesList files={openableRecentFiles} onOpen={requestOpenFile} />
          </div>
        )}
        {forkPromptOpen && isReadOnly && loadedPath && loadedMeta && (
          <ReadOnlyMapDialog
            author={loadedMeta.author}
            onContinue={() => setForkPromptOpen(false)}
            onDuplicate={
              currentUser === null
                ? null
                : async () => {
                    const newPath = await duplicateMap(loadedPath, currentUser.username, currentUser.role)
                    await refreshFolder(parentDirOf(loadedPath))
                    setForkPromptOpen(false)
                    setCurrentFile(newPath)
                  }
            }
          />
        )}
        <QuizSummaryModal />
      </main>
    </AppShell>
  )
}

export default App
