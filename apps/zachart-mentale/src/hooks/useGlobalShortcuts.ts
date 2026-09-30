import {
  commandAcceptsEvent as sharedCommandAcceptsEvent,
  isCanvasTarget as sharedIsCanvasTarget,
  useGlobalShortcuts as useSharedGlobalShortcuts,
  type CommandDefinition,
  type GlobalShortcutOptions,
} from '@suite/shared/commands'
import { useQuizStore } from '../state/useQuizStore'

export { isModalOpen, isTypingTarget } from '@suite/shared/commands'

/** The mind map is React Flow's surface — the canvas a `canvas`-scoped command needs focus on. */
const CANVAS_SELECTOR = '.react-flow'

const OPTIONS: GlobalShortcutOptions = {
  // Nothing may change a card under a quiz in progress: an undo could move the
  // very card being asked about, a delete could remove it mid-question.
  isSuspended: () => useQuizStore.getState().active,
  canvasSelector: CANVAS_SELECTOR,
}

/** The mind map itself has focus — see the shared `isCanvasTarget`. */
export function isCanvasTarget(target: EventTarget | null): boolean {
  return sharedIsCanvasTarget(target, CANVAS_SELECTOR)
}

/** Whether `event` is allowed to trigger `command`, given where focus is and what the app is doing. */
export function commandAcceptsEvent(command: CommandDefinition, event: KeyboardEvent): boolean {
  return sharedCommandAcceptsEvent(command, event, OPTIONS)
}

/** The app's single keyboard entry point — the shared dispatcher, wired to the quiz and the canvas. */
export function useGlobalShortcuts(): void {
  useSharedGlobalShortcuts(OPTIONS)
}
