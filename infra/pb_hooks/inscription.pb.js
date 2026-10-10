/// <reference path="../pb_data/types.d.ts" />

// L'inscription d'un prof avec un code. Aucune règle de collection ne sait
// exprimer « un visiteur non connecté crée un compte si ce code est valable » ;
// ce hook le fait, dans UNE transaction : la vérification du code et la création
// du compte réussissent ou échouent ensemble.
routerAdd('POST', '/api/inscription', (e) => {
  const invite = require(`${__hooks}/lib/inviteCode.js`)
  const refuse = 'Code invalide ou expiré.'

  const body = e.requestInfo().body || {}
  const code = invite.normalizeCode(body.code)
  const username = String(body.username || '').trim()
  const password = String(body.password || '')

  if (code.length !== 10) throw new BadRequestError(refuse)
  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(username)) {
    throw new BadRequestError('Identifiant invalide : lettres, chiffres, point, tiret et underscore.')
  }
  if (password.length < 10) throw new BadRequestError('Mot de passe trop court : 10 caractères minimum.')

  $app.runInTransaction((txApp) => {
    let record
    try {
      record = txApp.findFirstRecordByFilter('invite_codes', 'code = {:code}', { code: code })
    } catch (_) {
      throw new BadRequestError(refuse)
    }

    const used = txApp.countRecords('users', $dbx.hashExp({ invite_code: code }))
    const state = invite.inviteCodeState(
      {
        kind: record.getString('kind'),
        expires_at: record.getString('expires_at'),
        revoked: record.getBool('revoked'),
      },
      used,
      Date.now()
    )
    if (!invite.isUsable(state)) throw new BadRequestError(refuse)

    // Vérifié APRÈS le code : on ne révèle un pseudo pris qu'à qui détient un code valable.
    if (txApp.countRecords('users', $dbx.hashExp({ username: username })) > 0) {
      throw new BadRequestError('Cet identifiant est déjà pris.')
    }

    const user = new Record(txApp.findCollectionByNameOrId('users'))
    user.set('username', username)
    user.set('role', 'prof')
    user.set('invite_code', code)
    user.setPassword(password)
    txApp.save(user)

    // Garde de concurrence : deux requêtes peuvent avoir lu « 0 utilisé » avant
    // que l'une ait écrit. Après notre écriture, on recompte ; si le code est
    // unique et que plusieurs comptes le portent, on annule (rollback).
    if (
      record.getString('kind') === 'unique' &&
      txApp.countRecords('users', $dbx.hashExp({ invite_code: code })) > 1
    ) {
      throw new BadRequestError(refuse)
    }
  })

  return e.json(200, { ok: true })
})
