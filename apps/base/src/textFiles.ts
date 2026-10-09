import { documentDir, join } from '@tauri-apps/api/path'
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { DocumentPort } from '@suite/shared/files'

/** The `.txt` files of `Documents/Base/`: the port that makes the work area a document. */
export const textFiles: DocumentPort<string> = {
  async read(path) {
    return (await exists(path)) ? readTextFile(path) : null
  },
  write: (path, text) => writeTextFile(path, text),
  async create() {
    const folder = await join(await documentDir(), 'Base')
    if (!(await exists(folder))) await mkdir(folder, { recursive: true })
    for (let n = 1; ; n++) {
      const path = await join(folder, n === 1 ? 'Sans titre.txt' : `Sans titre ${n}.txt`)
      if (await exists(path)) continue
      await writeTextFile(path, '')
      return path
    }
  },
}
