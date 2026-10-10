// Scénarios contre un VRAI PocketBase (hooks montés, schéma appliqué).
//   PB_URL=… PB_ADMIN_EMAIL=… PB_ADMIN_PASSWORD=… bun run infra/integration.mjs
// Sort en code 1 au premier échec constaté (tous les scénarios sont joués).
// S1-S9 font bien plus de 5 inscriptions par minute : ils se jouent sur un serveur
// configuré avec `setup-pocketbase.mjs --no-rate-limits`. S10 (la limitation de
// débit) se joue seul, après `setup-pocketbase.mjs` : `… integration.mjs --only-rate-limit`.
const { PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD } = process.env
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const PASSWORD = 'MotDePasse1234!'
const run = Date.now().toString(36)
let failures = 0
let adminToken = ''
const onlyRateLimit = process.argv.includes('--only-rate-limit')

function check(name, condition, detail = '') {
  if (condition) return console.log(`  ✓ ${name}`)
  failures += 1
  console.log(`  ✗ ${name} ${detail}`)
}
const denied = status => status === 400 || status === 403 || status === 404

async function api(path, { method = 'GET', token = '', body } = {}) {
  const response = await fetch(`${PB_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* corps vide ou non JSON */ }
  return { status: response.status, json }
}

const randomCode = () =>
  Array.from({ length: 10 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

async function createCode(fields = {}) {
  const code = randomCode()
  const { status, json } = await api('/api/collections/invite_codes/records', {
    method: 'POST', token: adminToken, body: { code, kind: 'unique', ...fields },
  })
  if (status !== 200) throw new Error(`création du code impossible : ${status} ${JSON.stringify(json)}`)
  return { code, id: json.id }
}
const signup = (code, username, password = PASSWORD) =>
  api('/api/inscription', { method: 'POST', body: { code, username, password } })
async function login(username, password = PASSWORD) {
  const { status, json } = await api('/api/collections/users/auth-with-password', {
    method: 'POST', body: { identity: username, password },
  })
  return { status, token: json?.token ?? '', id: json?.record?.id ?? '' }
}
async function newProf(tag) {
  const username = `prof_${tag}_${run}`
  const { code } = await createCode()
  const result = await signup(code, username)
  if (result.status !== 200) throw new Error(`prof ${tag} : ${result.status}`)
  return { username, ...(await login(username)) }
}
const day = 86_400_000
const iso = ms => new Date(ms).toISOString().replace('T', ' ')

async function main() {
  const auth = await api('/api/collections/_superusers/auth-with-password', {
    method: 'POST', body: { identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD },
  })
  adminToken = auth.json?.token ?? ''
  if (!adminToken) throw new Error(`connexion admin impossible (${auth.status})`)

  if (onlyRateLimit) await scenarioS10()
  else await scenariosS1toS9()

  if (failures > 0) { console.log(`\n${failures} échec(s)`); process.exit(1) }
  console.log('\nTout est conforme.')
}

async function scenariosS1toS9() {
  console.log('S1 code unique')
  { const { code } = await createCode()
    check('première inscription : 200', (await signup(code, `s1a_${run}`)).status === 200)
    check('seconde inscription : refusée', denied((await signup(code, `s1b_${run}`)).status)) }

  console.log('S2 code à durée')
  { const future = await createCode({ kind: 'duree', expires_at: iso(Date.now() + day) })
    check('1er inscrit : 200', (await signup(future.code, `s2a_${run}`)).status === 200)
    check('2e inscrit : 200', (await signup(future.code, `s2b_${run}`)).status === 200)
    const past = await createCode({ kind: 'duree', expires_at: iso(Date.now() - day) })
    check('code expiré : refusé', denied((await signup(past.code, `s2c_${run}`)).status)) }

  console.log('S3 code révoqué (même après création)')
  { const { code, id } = await createCode()
    await api(`/api/collections/invite_codes/records/${id}`, { method: 'PATCH', token: adminToken, body: { revoked: true } })
    const result = await signup(code, `s3_${run}`)
    check('refusé', denied(result.status))
    check('message unique, sans indice', result.json?.message === 'Code invalide ou expiré.', JSON.stringify(result.json)) }

  console.log('S4 code mal saisi mais reconnaissable')
  { const { code } = await createCode()
    check('espaces, tiret et minuscules acceptés',
      (await signup(` ${code.slice(0, 5).toLowerCase()}-${code.slice(5).toLowerCase()} `, `s4_${run}`)).status === 200)
    check('code inconnu : refusé', denied((await signup(randomCode(), `s4b_${run}`)).status)) }

  console.log('S5 identifiant déjà pris : le code n’est pas consommé')
  { const taken = await createCode()
    await signup(taken.code, `s5_${run}`)
    const { code } = await createCode()
    check('refusé', denied((await signup(code, `s5_${run}`)).status))
    check('le code sert encore', (await signup(code, `s5b_${run}`)).status === 200) }

  console.log('S6 entrées invalides')
  { const { code } = await createCode()
    check('mot de passe court', denied((await signup(code, `s6_${run}`, 'court')).status))
    check('identifiant illégal', denied((await signup(code, 'a b/c')).status))
    check('le code sert encore', (await signup(code, `s6b_${run}`)).status === 200) }

  console.log('S7 huit inscriptions simultanées sur un code unique')
  { const { code } = await createCode()
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => signup(code, `s7_${i}_${run}`)))
    check('exactement une réussit', results.filter(r => r.status === 200).length === 1,
      results.map(r => r.status).join(',')) }

  console.log('S8 cloisonnement des profs')
  { const a = await newProf('a')
    const b = await newProf('b')
    const create = (prof, name, extra = {}) => api('/api/collections/users/records', {
      method: 'POST', token: prof.token,
      body: { username: name, password: PASSWORD, passwordConfirm: PASSWORD, role: 'eleve', teacher: prof.id, ...extra },
    })
    const eleve = await create(a, `e1_${run}`)
    check('A crée un élève à lui', eleve.status === 200, JSON.stringify(eleve.json))
    check('A ne crée pas un élève pour B', denied((await create(a, `e2_${run}`, { teacher: b.id })).status))
    check('A ne crée pas un prof', denied((await create(a, `e3_${run}`, { role: 'prof' })).status))
    check('A ne crée pas un élève portant un invite_code', denied((await create(a, `e4_${run}`, { invite_code: randomCode() })).status))
    check('A ne pose pas un invite_code sur son élève', denied((await api(`/api/collections/users/records/${eleve.json?.id}`,
      { method: 'PATCH', token: a.token, body: { invite_code: randomCode() } })).status))
    const listB = await api('/api/collections/users/records?perPage=200', { token: b.token })
    check('B ne voit pas l’élève de A', !listB.json?.items?.some(u => u.id === eleve.json?.id))
    check('B ne modifie pas l’élève de A', denied((await api(`/api/collections/users/records/${eleve.json?.id}`,
      { method: 'PATCH', token: b.token, body: { username: `hack_${run}` } })).status))
    check('B ne supprime pas l’élève de A', denied((await api(`/api/collections/users/records/${eleve.json?.id}`,
      { method: 'DELETE', token: b.token })).status))
    check('A ne se promeut pas', denied((await api(`/api/collections/users/records/${a.id}`,
      { method: 'PATCH', token: a.token, body: { role: 'eleve' } })).status))
    check('A ne change pas son teacher', denied((await api(`/api/collections/users/records/${a.id}`,
      { method: 'PATCH', token: a.token, body: { teacher: b.id } })).status))
    const reset = await api(`/api/collections/users/records/${eleve.json?.id}`, {
      method: 'PATCH', token: a.token, body: { password: 'NouveauMdp1234!', passwordConfirm: 'NouveauMdp1234!' },
    })
    check('A réinitialise le mot de passe de son élève (sans l’ancien)', reset.status === 200, JSON.stringify(reset.json))
    check('l’élève se connecte avec le nouveau', (await login(`e1_${run}`, 'NouveauMdp1234!')).status === 200)
    const refused = await api(`/api/collections/users/records/${a.id}`, { method: 'DELETE', token: adminToken })
    check('supprimer un prof qui a des élèves : refusé, même par l’admin', refused.status === 400, String(refused.status))
    check('A supprime son élève', (await api(`/api/collections/users/records/${eleve.json?.id}`,
      { method: 'DELETE', token: a.token })).status === 204)
    check('puis l’admin supprime A', (await api(`/api/collections/users/records/${a.id}`,
      { method: 'DELETE', token: adminToken })).status === 204) }

  console.log('S9 accès anonyme et prof aux codes')
  { check('anonyme ne liste pas les codes', denied((await api('/api/collections/invite_codes/records')).status))
    const prof = await newProf('s9')
    check('un prof ne liste pas les codes', denied((await api('/api/collections/invite_codes/records', { token: prof.token })).status))
    check('anonyme ne crée pas de compte', denied((await api('/api/collections/users/records', { method: 'POST',
      body: { username: `anon_${run}`, password: PASSWORD, passwordConfirm: PASSWORD, role: 'prof' } })).status)) }

}

async function scenarioS10() {
  console.log('S10 limitation de débit')
  { const results = []
    for (let i = 0; i < 8; i++) results.push((await signup('AAAAAAAAAA', `rl_${i}_${run}`)).status)
    check('au moins une réponse 429', results.includes(429), results.join(',')) }
}

main().catch((error) => { console.error(error); process.exit(1) })
