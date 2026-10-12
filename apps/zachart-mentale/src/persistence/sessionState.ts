import { loadSession, saveSession, type RecentFile, type SessionState } from '@suite/shared/files'

export type { RecentFile, SessionState }

/** Mentale's id in the shared session: the prefix of its `zachart-mentale:session` key. */
const APP_ID = 'zachart-mentale'

/**
 * The last open file and expanded sidebar folders, kept in `localStorage` so a page reload
 * (dev HMR, or a plain browser refresh with no Tauri config to fall back to) puts the app back
 * where the user left it. The format and the key are the shared session's: `shared/files`.
 */
export const loadSessionState = (): SessionState => loadSession(APP_ID)

export const saveSessionState = (state: SessionState): void => saveSession(APP_ID, state)
