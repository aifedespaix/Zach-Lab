/** What an app plugs in to have its files opened, validated and written by the shared engine. */
export interface DocumentPort<T> {
  /** `null` = the file no longer exists. A rejection is an unreadable file. */
  read(path: string): Promise<T | null>
  write(path: string, doc: T): Promise<void>
  /** Not ok = the file is unreadable as a document (the previous file stays open). */
  validate?(raw: T): { ok: true } | { ok: false; issues: unknown[] }
  /** Present = an invalid file can be repaired into a copy (the app writes it). */
  repair?(raw: T): T
  /** Creates a file from the app's own form and returns its path. */
  create?(input: unknown): Promise<string>
}
