/**
 * The namespace of an app's stored keys: `<appId>:<name>`.
 *
 * The ids of the two shipped apps are `zachart-maths` and `zachart-mentale`, so
 * the keys they already wrote (`zachart-maths:zoom`…) are the very ones read
 * back: moving a preference onto `createPersisted` never resets a student's
 * choice. A new app picks its own id (`bun run new-app` writes it).
 */
export interface AppStorage {
  readonly appId: string
  /** `<appId>:<name>`. */
  key(name: string): string
}

export function defineAppStorage(appId: string): AppStorage {
  if (!/^[a-z][a-z0-9-]*$/.test(appId)) throw new Error(`Identifiant d'app invalide : « ${appId} »`)
  return { appId, key: name => `${appId}:${name}` }
}
