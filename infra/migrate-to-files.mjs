// Migration `cartes_mentales` → `files` (chantier Synchro S1).
//   PB_URL=… PB_ADMIN_EMAIL=… PB_ADMIN_PASSWORD=… bun infra/migrate-to-files.mjs [--apply]
// Simulation par défaut. Rejouable : ce qui existe déjà (même owner, app, file_id)
// est sauté. `rev` n'est pas écrit ici : le hook `files.pb.js` le pose à 1.
// `cartes_mentales` n'est ni modifiée ni supprimée (c'est le lot S9).
import { FILES_COLLECTION, MIND_MAPS_COLLECTION, USERS_COLLECTION } from './pocketbase-schema.mjs'

export const MENTALE_APP = 'zachart-mentale'

/** Même empreinte que `apps/zachart-mentale/src/sync/contentHash.ts` : SHA-256 tronqué à 8 octets. */
export async function contentHash(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest).slice(0, 8)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Pure : quels `files` créer à partir des cartes.
 * @returns {{ create: object[], skip: string[], unknownAuthors: string[] }}
 */
export async function planMigration(cartes, existingFiles, users) {
  const idByUsername = new Map(users.map(user => [user.username, user.id]))
  const done = new Set(existingFiles.map(file => `${file.owner}|${file.app}|${file.file_id}`))
  const create = []
  const skip = []
  const unknownAuthors = []
  for (const carte of cartes) {
    const owner = idByUsername.get(carte.author)
    if (owner === undefined) {
      if (!unknownAuthors.includes(carte.author)) unknownAuthors.push(carte.author)
      continue
    }
    if (done.has(`${owner}|${MENTALE_APP}|${carte.file_id}`)) {
      skip.push(carte.file_id)
      continue
    }
    create.push({
      file_id: carte.file_id,
      app: MENTALE_APP,
      kind: carte.type ?? '',
      path: carte.path,
      content: carte.content,
      hash: await contentHash(carte.content),
      owner,
      updated_by: owner,
    })
  }
  return { create, skip, unknownAuthors }
}

async function main() {
  const { PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD } = process.env
  if (!PB_URL || !PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    console.error('PB_URL, PB_ADMIN_EMAIL et PB_ADMIN_PASSWORD sont requis (environnement).')
    process.exit(1)
  }
  const apply = process.argv.includes('--apply')
  const { default: PocketBase } = await import('pocketbase')
  const pb = new PocketBase(PB_URL)
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)

  const [cartes, existing, users] = await Promise.all([
    pb.collection(MIND_MAPS_COLLECTION).getFullList(),
    pb.collection(FILES_COLLECTION).getFullList(),
    pb.collection(USERS_COLLECTION).getFullList(),
  ])
  const { create, skip, unknownAuthors } = await planMigration(cartes, existing, users)
  console.log(`${create.length} à créer, ${skip.length} déjà migrés, ${unknownAuthors.length} auteur(s) inconnu(s)`)
  for (const name of unknownAuthors) console.log(`  ! auteur inconnu, cartes ignorées : ${name}`)
  if (!apply) return console.log('Simulation : relancer avec --apply pour écrire.')
  for (const record of create) await pb.collection(FILES_COLLECTION).create(record)
  console.log('Migration appliquée.')
}

if (import.meta.main) main().catch(error => { console.error(error); process.exit(1) })
