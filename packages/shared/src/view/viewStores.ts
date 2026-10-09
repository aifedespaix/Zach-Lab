import { createPersisted, persistedFlag, persistedNumber, type PersistedStore } from '../storage'
import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from './zoom'

export interface ViewStores {
  zoom: PersistedStore<number>
  /** `true` = condensed. */
  compact: PersistedStore<boolean>
  /** A CSS `font-family`; empty = the theme's own. */
  font: PersistedStore<string>
}

const stores = new Map<string, ViewStores>()

/**
 * The view preferences of an app, one set per app id, read once. Keys: `<id>:zoom`,
 * `<id>:compact` (`on`/`off`) and `<id>:font` — Zach'Math's `zachart-maths:zoom` / `:compact` are these.
 */
export function viewStores(appId: string): ViewStores {
  let found = stores.get(appId)
  if (found === undefined) {
    found = {
      zoom: persistedNumber({ key: `${appId}:zoom`, fallback: ZOOM_DEFAULT, min: ZOOM_MIN, max: ZOOM_MAX, step: ZOOM_STEP }),
      compact: persistedFlag({ key: `${appId}:compact`, fallback: false, on: 'on', off: 'off' }),
      font: createPersisted<string>({ key: `${appId}:font`, fallback: '', parse: raw => raw }),
    }
    stores.set(appId, found)
  }
  return found
}
