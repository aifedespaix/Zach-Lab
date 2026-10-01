// Run with: bun test scripts/make-update.test.mjs
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { APPS, assetName, buildLatestJson, generateUpdates, parseArgs, rollingReleaseOf, tagOf, updaterProblems } from './make-update.mjs'

let root
const PUBKEY = 'dW50cnVzdGVk'

const CARGO_LOCK = `version = 4

[[package]]
name = "zachart-mentale"
version = "1.20.5"

[[package]]
name = "zachart-maths"
version = "0.1.0"
`

function writeApp(app, { productName, version, crate, updater }) {
  const dir = join(root, 'apps', app)
  mkdirSync(join(dir, 'src-tauri'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: app, version }, null, 2) + '\n')
  writeFileSync(join(dir, 'src-tauri', 'Cargo.toml'), `[package]\nname = "${crate}"\nversion = "${version}"\n`)
  writeFileSync(join(dir, 'src-tauri', 'tauri.conf.json'), JSON.stringify({ productName, version, plugins: { updater } }, null, 2) + '\n')
}

const READY = { pubkey: PUBKEY, endpoints: ['https://example.test/latest.json'] }

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'make-update-'))
  writeApp('zachart-mentale', { productName: 'Zachar’t Mentale', version: '1.20.5', crate: 'zachart-mentale', updater: READY })
  writeApp('zachart-maths', { productName: "Zach'Math", version: '0.1.0', crate: 'zachart-maths', updater: READY })
  writeFileSync(join(root, 'Cargo.lock'), CARGO_LOCK)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const KEYS = { TAURI_SIGNING_PRIVATE_KEY: 'cle-mentale', TAURI_SIGNING_PRIVATE_KEY_PASSWORD: 'mdp-m' }

/** A stand-in for `tauri build`: it writes what the real one writes, where it writes it. */
function fakeRun(calls) {
  return (command, args, { cwd, env }) => {
    calls.push({ args, cwd, env })
    if (args[0] === 'tauri') {
      const conf = JSON.parse(readFileSync(join(cwd, 'src-tauri', 'tauri.conf.json'), 'utf8'))
      const nsis = join(root, 'target', 'release', 'bundle', 'nsis')
      mkdirSync(nsis, { recursive: true })
      const file = join(nsis, `${conf.productName}_${conf.version}_x64-setup.exe`)
      writeFileSync(file, 'EXE')
      writeFileSync(`${file}.sig`, `SIG-${conf.productName}\n`)
    }
  }
}

const base = (extra = {}) => ({
  root,
  targets: ['mentale'],
  env: KEYS,
  platform: 'win32',
  log: () => {},
  now: () => new Date('2026-10-02T10:00:00Z'),
  ...extra,
})

describe('parseArgs', () => {
  it('reconnaît les cibles et leurs alias', () => {
    expect(parseArgs(['mentale']).targets).toEqual(['mentale'])
    expect(parseArgs(['zachart-maths']).targets).toEqual(['maths'])
    expect(parseArgs(['Math']).targets).toEqual(['maths'])
    expect(parseArgs(['all']).targets).toEqual(['mentale', 'maths'])
  })
  it('lit la version et les options, dans n\'importe quel ordre', () => {
    expect(parseArgs(['maths', 'patch'])).toMatchObject({ bump: 'patch', skipTests: false, notes: '' })
    expect(parseArgs(['--skip-tests', 'all', '1.2.3', '--notes', 'Un correctif', '--out', 'x'])).toMatchObject({
      bump: '1.2.3', skipTests: true, notes: 'Un correctif', out: 'x',
    })
  })
  it('refuse l\'app, la version ou l\'option inconnues, et un argument sans valeur', () => {
    expect(() => parseArgs([])).toThrow(/Quelle app/)
    expect(() => parseArgs(['physique'])).toThrow(/App inconnue/)
    expect(() => parseArgs(['maths', 'gros'])).toThrow(/Version non reconnue/)
    expect(() => parseArgs(['maths', '--vite'])).toThrow(/Option inconnue/)
    expect(() => parseArgs(['maths', '--notes'])).toThrow(/attend une valeur/)
    expect(() => parseArgs(['maths', 'patch', 'minor'])).toThrow(/en trop/)
  })
})

describe('noms et latest.json', () => {
  it('donne à chaque app un tag, une release roulante et un installeur au nom sûr', () => {
    expect(tagOf('zachart-mentale', '1.2.3')).toBe('zachart-v1.2.3')
    expect(tagOf('zachart-maths', '0.1.0')).toBe('zachart-maths-v0.1.0')
    expect(rollingReleaseOf('zachart-mentale')).toBe('updater-zachart')
    expect(rollingReleaseOf('zachart-maths')).toBe('updater-zachart-maths')
    expect(assetName('zachart-mentale', '1.2.3')).toBe('zachart-mentale_1.2.3_x64-setup.exe')
  })
  it('écrit ce que le plugin updater de Tauri attend', () => {
    expect(buildLatestJson({ version: '1.0.0', notes: 'n', signature: 's', url: 'u', pubDate: 'd' })).toEqual({
      version: '1.0.0', notes: 'n', pub_date: 'd', platforms: { 'windows-x86_64': { signature: 's', url: 'u' } },
    })
  })
})

describe('clé de signature', () => {
  it("Zach'Math signe avec la clé de Zachar’t Mentale", () => {
    expect(APPS.maths.keyEnv).toBe(APPS.mentale.keyEnv)
    expect(APPS.maths.passEnv).toBe(APPS.mentale.passEnv)
  })
})

describe('updaterProblems', () => {
  const conf = { plugins: { updater: READY } }
  it('ne trouve rien à redire quand tout est là', () => {
    expect(updaterProblems({ info: APPS.mentale, conf, env: KEYS, platform: 'win32' })).toEqual([])
  })
  it('signale hors Windows, sans clé, sans clé publique, sans adresse', () => {
    expect(updaterProblems({ info: APPS.mentale, conf, env: KEYS, platform: 'linux' }).join()).toContain('sous Windows')
    expect(updaterProblems({ info: APPS.maths, conf, env: {}, platform: 'win32' }).join()).toContain('TAURI_SIGNING_PRIVATE_KEY')
    const noKey = updaterProblems({ info: APPS.maths, conf: { plugins: { updater: { pubkey: '' } } }, env: KEYS, platform: 'win32' })
    expect(noKey.join()).toContain('signer generate')
    expect(noKey.join()).toContain('updater-zachart-maths/latest.json')
    expect(updaterProblems({ info: APPS.maths, conf: { plugins: { updater: { pubkey: PUBKEY, endpoints: [] } } }, env: KEYS, platform: 'win32' }).join()).toContain('endpoints')
  })
})

describe('generateUpdates', () => {
  it('teste, construit avec la clé de l\'app et les artefacts d\'update, puis range les fichiers', () => {
    const calls = []
    const [result] = generateUpdates(base({ run: fakeRun(calls), notes: 'Corrige X' }))

    expect(calls.map(c => c.args.slice(0, 3))).toEqual([['run', '--filter', 'zachart-mentale'], ['tauri', 'build', '--config']])
    const build = calls[1]
    expect(JSON.parse(build.args[3])).toEqual({ bundle: { createUpdaterArtifacts: true } })
    expect(build.cwd).toBe(join(root, 'apps', 'zachart-mentale'))
    expect(build.env.TAURI_SIGNING_PRIVATE_KEY).toBe('cle-mentale')
    expect(build.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD).toBe('mdp-m')

    expect(result).toMatchObject({ app: 'zachart-mentale', version: '1.20.5', tag: 'zachart-v1.20.5' })
    expect(readdirSync(result.dir).sort()).toEqual(['latest.json', 'zachart-mentale_1.20.5_x64-setup.exe', 'zachart-mentale_1.20.5_x64-setup.exe.sig'])
    const latest = JSON.parse(readFileSync(join(result.dir, 'latest.json'), 'utf8'))
    expect(latest).toEqual({
      version: '1.20.5',
      notes: 'Corrige X',
      pub_date: '2026-10-02T10:00:00.000Z',
      platforms: {
        'windows-x86_64': {
          signature: 'SIG-Zachar’t Mentale',
          url: 'https://github.com/aifedespaix/Zachar-t-Mentale/releases/download/zachart-v1.20.5/zachart-mentale_1.20.5_x64-setup.exe',
        },
      },
    })
  })

  it('mentale est publiée en release normale, maths en pré-release, chacune avec sa roulante', () => {
    const results = generateUpdates(base({ targets: ['mentale', 'maths'], skipTests: true, run: fakeRun([]) }))
    const [mentale, maths] = results.map(r => r.commands)
    expect(mentale[0]).not.toContain('--prerelease')
    expect(mentale[2]).toContain('gh release upload updater-zachart ')
    expect(maths[0]).toContain('--prerelease')
    expect(maths[0]).toContain('zachart-maths-v0.1.0')
    expect(maths[2]).toContain('gh release upload updater-zachart-maths ')
  })

  it('--skip-tests ne lance que le build', () => {
    const calls = []
    generateUpdates(base({ skipTests: true, run: fakeRun(calls) }))
    expect(calls.map(c => c.args[0])).toEqual(['tauri'])
  })

  it('refuse de rien construire si une app du lot n\'est pas prête (pas de clé publique)', () => {
    writeApp('zachart-maths', { productName: "Zach'Math", version: '0.1.0', crate: 'zachart-maths', updater: { pubkey: '', endpoints: [] } })
    const calls = []
    expect(() => generateUpdates(base({ targets: ['mentale', 'maths'], run: fakeRun(calls) }))).toThrow(/Rien n'a été construit[\s\S]*Zach'Math/)
    expect(calls).toEqual([])
    expect(existsSync(join(root, 'updates'))).toBe(false)
  })

  it('refuse sans clé de signature, avant tout build', () => {
    const calls = []
    expect(() => generateUpdates(base({ env: {}, run: fakeRun(calls) }))).toThrow(/TAURI_SIGNING_PRIVATE_KEY/)
    expect(calls).toEqual([])
  })

  it('bumpe la version d\'abord, puis construit cette version-là', () => {
    const [result] = generateUpdates(base({ bump: 'patch', skipTests: true, run: fakeRun([]) }))
    expect(result.version).toBe('1.20.6')
    expect(JSON.parse(readFileSync(join(root, 'apps', 'zachart-mentale', 'src-tauri', 'tauri.conf.json'), 'utf8')).version).toBe('1.20.6')
    expect(result.bumpCommands[0]).toStartWith('git add')
    expect(existsSync(join(result.dir, 'zachart-mentale_1.20.6_x64-setup.exe'))).toBe(true)
  })

  it('échoue clairement si le build n\'a pas produit d\'installeur ou de signature', () => {
    expect(() => generateUpdates(base({ skipTests: true, run: () => {} }))).toThrow(/Installeur introuvable/)
    const noSig = (command, args, { cwd }) => {
      if (args[0] !== 'tauri') return
      const nsis = join(root, 'target', 'release', 'bundle', 'nsis')
      mkdirSync(nsis, { recursive: true })
      writeFileSync(join(nsis, 'Zachar’t Mentale_1.20.5_x64-setup.exe'), 'EXE')
    }
    expect(() => generateUpdates(base({ skipTests: true, run: noSig }))).toThrow(/Signature introuvable/)
  })

  it('ne prend pas l\'installeur d\'une autre app ou d\'une autre version dans le même dossier', () => {
    const nsis = join(root, 'target', 'release', 'bundle', 'nsis')
    mkdirSync(nsis, { recursive: true })
    writeFileSync(join(nsis, "Zach'Math_1.20.5_x64-setup.exe"), 'AUTRE')
    writeFileSync(join(nsis, 'Zachar’t Mentale_1.20.4_x64-setup.exe'), 'ANCIEN')
    const [result] = generateUpdates(base({ skipTests: true, run: fakeRun([]) }))
    expect(readFileSync(join(result.dir, 'zachart-mentale_1.20.5_x64-setup.exe'), 'utf8')).toBe('EXE')
  })

  it('un échec de test arrête tout avant le build', () => {
    const calls = []
    const run = (command, args) => {
      calls.push(args[0])
      if (args[0] === 'run') throw new Error('les tests échouent')
    }
    expect(() => generateUpdates(base({ run }))).toThrow(/tests échouent/)
    expect(calls).toEqual(['run'])
  })
})
