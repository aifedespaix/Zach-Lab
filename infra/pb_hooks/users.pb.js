/// <reference path="../pb_data/types.d.ts" />

// Un prof qui a encore des élèves ne se supprime pas — même par le
// superutilisateur, qui contourne les règles de collection : c'est donc un hook
// et non une règle. Sans lui, les élèves se retrouveraient sans prof.
onRecordDeleteRequest((e) => {
  if (e.record.getString('role') === 'prof') {
    const count = e.app.countRecords('users', $dbx.hashExp({ teacher: e.record.id }))
    if (count > 0) {
      throw new BadRequestError(
        `Ce professeur a encore ${count} élève(s) : rattachez-les à un autre professeur ou supprimez-les d’abord.`
      )
    }
  }
  e.next()
}, 'users')
