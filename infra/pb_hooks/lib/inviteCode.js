// Logique pure des codes d'inscription, partagée par les hooks.
// Son jumeau TypeScript est apps/site/src/app/lib/inviteCode.ts ; les deux
// rejouent infra/fixtures/invite-code-states.json.

var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function normalizeCode(raw) {
  return String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// PocketBase écrit les dates « 2026-10-10 12:00:00.000Z » (espace, pas « T »).
function parseDate(value) {
  if (value == null || value === '') return NaN
  return Date.parse(String(value).replace(' ', 'T'))
}

function inviteCodeState(code, usedCount, nowMs) {
  if (code.revoked) return 'revoque'
  if (code.kind === 'duree') {
    var expiresAt = parseDate(code.expires_at)
    // Une durée sans échéance valide est un code mal formé : refusé, pas éternel.
    if (isNaN(expiresAt) || expiresAt <= nowMs) return 'expire'
  } else if (usedCount >= 1) {
    return 'utilise'
  }
  return 'actif'
}

function isUsable(state) {
  return state === 'actif'
}

module.exports = {
  ALPHABET: ALPHABET,
  normalizeCode: normalizeCode,
  inviteCodeState: inviteCodeState,
  isUsable: isUsable,
}
