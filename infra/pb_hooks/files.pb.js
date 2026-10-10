/// <reference path="../pb_data/types.d.ts" />

// `rev` est compté par le SERVEUR : l'horloge d'une machine ne décide de rien
// (chantier Synchro, principe 2). Les règles de la collection interdisent à un
// client de l'écrire ; ce hook est le seul à le faire.

onRecordCreateRequest((e) => {
  e.record.set('rev', 1)
  e.next()
}, 'files')

onRecordUpdateRequest((e) => {
  const original = e.record.original()
  const current = original.getInt('rev')

  // `base_rev` n'est pas un champ : c'est la révision que le client croit
  // mettre à jour. Périmée → 409, le client fabrique alors un doublon (S4).
  const base = e.requestInfo().body['base_rev']
  if (base !== undefined && base !== null && base !== '' && Number(base) !== current) {
    throw new ApiError(409, 'Ce fichier a changé sur le serveur depuis votre dernière synchronisation.', {})
  }

  // Une écriture qui ne change rien (même contenu, même chemin) ne fait pas
  // avancer la révision : sinon deux postes se renverraient des « nouveautés ».
  const changed = ['content', 'hash', 'path', 'deleted_at'].some(
    (name) => e.record.getString(name) !== original.getString(name)
  )
  e.record.set('rev', changed ? current + 1 : current)
  e.next()
}, 'files')

// La corbeille garde 30 jours (03-prof-et-eleves.md), puis le serveur purge.
cronAdd('purge_files_trash', '0 4 * * *', () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().replace('T', ' ')
  const old = $app.findRecordsByFilter('files', 'deleted_at != "" && deleted_at < {:cutoff}', '', 0, 0, { cutoff })
  for (const record of old) $app.delete(record)
})
