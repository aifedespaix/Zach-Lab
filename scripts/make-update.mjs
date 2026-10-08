#!/usr/bin/env bun
// Builds the SIGNED update of one app of the suite (or both), on this machine.
//
// Usage: bun run update:mentale | update:maths | update:all  [-- <patch|minor|major|X.Y.Z>] [options]
//   bump             optional: bumps the version first (same files as `version:bump`)
//   --skip-tests     do not run the app's tests before building
//   --notes <texte>  the release notes written in latest.json
//   --out <dossier>  where the files go (default: `updates/` at the repository root)
//
// For each app it runs the tests, `tauri build` with the updater artifacts on (the
// signed NSIS installer and its `.sig`), then gathers in `updates/<app>/<version>/`:
//   <app>_<version>_x64-setup.exe, its .sig, and the `latest.json` the app polls.
// The file names are plain ASCII on purpose: GitHub rewrites spaces and « ’ » in asset
// names, which would break the URL written in `latest.json`.
//
// It does NOT publish anything. It prints the `gh` commands to do it — the release is
// public, so it stays a decision of whoever runs this. (Pushing a tag still works and
// still goes through `.github/workflows/release.yml`; use one way or the other for a
// given version, not both.)
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { TAG_PREFIX, bumpVersion } from './bump-version.mjs'

export const REPO = 'aifedespaix/Zach-Lab'

/**
 * What this script knows of each app. The signing key is taken from the environment by
 * NAME, per app (docs/RELEASE.md); Zach'Math shares Zachar’t Mentale's key.
 */
export const APPS = {
  mentale: {
    app: 'zachart-mentale',
    title: 'Zachar’t Mentale',
    keyEnv: 'TAURI_SIGNING_PRIVATE_KEY',
    passEnv: 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
    prerelease: false,
  },
  maths: {
    app: 'zachart-maths',
    title: 'Zach’Math',
    // Same signing key as Zachar’t Mentale (docs/RELEASE.md).
    keyEnv: 'TAURI_SIGNING_PRIVATE_KEY',
    passEnv: 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
    // Only Zachar’t Mentale is a normal release: `releases/latest` is the entry point of its
    // installed copies, and another app's release must not take it over.
    prerelease: true,
  },
}

const ALIASES = {
  mentale: 'mentale',
  'zachart-mentale': 'mentale',
  maths: 'maths',
  math: 'maths',
  'zachart-maths': 'maths',
  all: 'all',
  tout: 'all',
}
const SEMVER = /^\d+\.\d+\.\d+$/

/** `<cible> [patch|minor|major|X.Y.Z] [--skip-tests] [--notes t] [--out d]`, flags in any place. */
export function parseArgs(args) {
  const options = { targets: [], bump: undefined, skipTests: false, notes: '', out: undefined }
  const positional = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--skip-tests') options.skipTests = true
    else if (arg === '--notes' || arg === '--out') {
      const value = args[++i]
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} attend une valeur.`)
      options[arg === '--notes' ? 'notes' : 'out'] = value
    } else if (arg.startsWith('--')) throw new Error(`Option inconnue : ${arg}.`)
    else positional.push(arg)
  }
  const [target, bump, ...extra] = positional
  if (target === undefined) throw new Error('Quelle app ? mentale, maths ou all.')
  if (extra.length > 0) throw new Error(`Argument en trop : ${extra[0]}.`)
  const key = ALIASES[target.toLowerCase()]
  if (key === undefined) throw new Error(`App inconnue : « ${target} ». Attendu : mentale, maths ou all.`)
  options.targets = key === 'all' ? Object.keys(APPS) : [key]
  if (bump !== undefined) {
    if (!SEMVER.test(bump) && !['patch', 'minor', 'major'].includes(bump)) {
      throw new Error(`Version non reconnue : « ${bump} ». Attendu : patch, minor, major, ou X.Y.Z.`)
    }
    options.bump = bump
  }
  return options
}

export const assetName = (app, version) => `${app}_${version}_x64-setup.exe`
export const tagOf = (app, version) => `${TAG_PREFIX[app] ?? app}-v${version}`
export const rollingReleaseOf = app => `updater-${TAG_PREFIX[app] ?? app}`

/** The file the installed app polls: where to download the installer, and the signature that proves it is ours. */
export function buildLatestJson({ version, notes, signature, url, pubDate }) {
  return {
    version,
    notes,
    pub_date: pubDate,
    platforms: { 'windows-x86_64': { signature, url } },
  }
}

/**
 * Everything that would make the build useless, found BEFORE compiling anything: a signed
 * update takes minutes to build, and « no key » or « no public key » shows up only at the end.
 */
export function updaterProblems({ info, conf, env, platform }) {
  const problems = []
  if (platform !== 'win32') {
    problems.push("L'installeur NSIS se construit sous Windows (plateforme actuelle : " + platform + ').')
  }
  if (!env[info.keyEnv]) {
    problems.push(`${info.title} : la clé de signature est absente — définis ${info.keyEnv} (le contenu de la clé, ou le chemin du fichier).`)
  }
  const updater = conf.plugins?.updater ?? {}
  if (!updater.pubkey) {
    problems.push(
      `${info.title} : pas de clé publique dans apps/${info.app}/src-tauri/tauri.conf.json (plugins.updater.pubkey). ` +
        `Une app sans clé ne peut pas vérifier ses mises à jour : \`bun tauri signer generate\`, ranger la clé privée dans ${info.keyEnv} ` +
        `et la clé publique dans tauri.conf.json, avec \`plugins.updater.endpoints\` = ` +
        `["https://github.com/${REPO}/releases/download/${rollingReleaseOf(info.app)}/latest.json"] (voir docs/RELEASE.md).`,
    )
  } else if (!Array.isArray(updater.endpoints) || updater.endpoints.length === 0) {
    problems.push(`${info.title} : plugins.updater.endpoints est vide dans tauri.conf.json — l'app ne saurait pas où chercher.`)
  }
  return problems
}

const readConf = (root, app) => JSON.parse(readFileSync(join(root, 'apps', app, 'src-tauri', 'tauri.conf.json'), 'utf8'))

/** The one installer `tauri build` wrote for this exact version (the folder holds every app's). */
function findInstaller(nsisDir, productName, version) {
  const suffix = `_${version}_x64-setup.exe`
  const found = existsSync(nsisDir) ? readdirSync(nsisDir).filter(f => f.startsWith(`${productName}_`) && f.endsWith(suffix)) : []
  if (found.length !== 1) {
    throw new Error(
      `Installeur introuvable dans ${nsisDir} : attendu un seul « ${productName}${suffix} », trouvé ${found.length}. ` +
        'Le build a-t-il bien produit les artefacts de mise à jour ?',
    )
  }
  return join(nsisDir, found[0])
}

/** Spawns a command and fails loudly: a half-built update must never look like a finished one. */
export function runCommand(command, args, { cwd, env }) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`« ${[command, ...args].join(' ')} » a échoué (code ${result.status}).`)
}

/**
 * Checks, then builds, then gathers the update of the given apps (`['mentale', 'maths']`).
 * `run`, `platform`, `env` and `now` are injected so the whole flow is testable without Tauri.
 */
export function generateUpdates({
  root,
  targets,
  bump,
  skipTests = false,
  notes = '',
  out = join(root, 'updates'),
  env = process.env,
  platform = process.platform,
  run = runCommand,
  now = () => new Date(),
  log = console.log,
}) {
  // 1. Everything is checked for every app before the first compilation starts.
  const problems = [
    ...new Set(targets.flatMap(key => updaterProblems({ info: APPS[key], conf: readConf(root, APPS[key].app), env, platform }))),
  ]
  if (problems.length > 0) throw new Error(`Rien n'a été construit :\n- ${problems.join('\n- ')}`)

  const results = []
  for (const key of targets) {
    const info = APPS[key]
    let bumpCommands = []
    if (bump !== undefined) {
      const bumped = bumpVersion({ root, app: info.app, arg: bump })
      log(`${info.title} : ${bumped.current} -> ${bumped.next}`)
      bumpCommands = bumped.commands.slice(0, 2) // git add + git commit : la version bumpée est à garder
    }
    const conf = readConf(root, info.app)
    const version = conf.version

    if (!skipTests) run(process.execPath, ['run', '--filter', info.app, 'test'], { cwd: root, env })

    log(`\n=== ${info.title} ${version} : build signé ===`)
    run(process.execPath, ['tauri', 'build', '--config', JSON.stringify({ bundle: { createUpdaterArtifacts: true } })], {
      cwd: join(root, 'apps', info.app),
      // `tauri build` reads the key under the standard name, whichever app it is.
      env: { ...env, TAURI_SIGNING_PRIVATE_KEY: env[info.keyEnv], TAURI_SIGNING_PRIVATE_KEY_PASSWORD: env[info.passEnv] ?? '' },
    })

    const installer = findInstaller(join(root, 'target', 'release', 'bundle', 'nsis'), conf.productName, version)
    if (!existsSync(`${installer}.sig`)) throw new Error(`Signature introuvable : ${installer}.sig — la clé de signature a-t-elle été prise en compte ?`)

    const dir = join(out, info.app, version)
    mkdirSync(dir, { recursive: true })
    const exe = assetName(info.app, version)
    copyFileSync(installer, join(dir, exe))
    copyFileSync(`${installer}.sig`, join(dir, `${exe}.sig`))
    const tag = tagOf(info.app, version)
    const latest = buildLatestJson({
      version,
      notes,
      signature: readFileSync(`${installer}.sig`, 'utf8').trim(),
      url: `https://github.com/${REPO}/releases/download/${tag}/${exe}`,
      pubDate: now().toISOString(),
    })
    writeFileSync(join(dir, 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`)

    const rolling = rollingReleaseOf(info.app)
    const files = [exe, `${exe}.sig`, 'latest.json'].map(f => join(dir, f))
    results.push({
      app: info.app,
      version,
      tag,
      dir,
      files,
      bumpCommands,
      commands: [
        `gh release create ${tag} --title "${info.title} v${version}"${info.prerelease ? ' --prerelease' : ''} --notes "${notes || 'Voir les fichiers attachés pour installer cette version.'}" ${files.map(f => `"${f}"`).join(' ')}`,
        `# la toute première fois seulement : gh release create ${rolling} --prerelease --latest=false --title "Mises à jour de ${info.title}" --notes "Release technique : elle porte le latest.json que l'application interroge. Ne pas la supprimer."`,
        `gh release upload ${rolling} "${join(dir, 'latest.json')}" --clobber`,
      ],
    })
  }
  return results
}

if (import.meta.main) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  try {
    const options = parseArgs(process.argv.slice(2))
    const results = generateUpdates({ root, ...options })
    for (const r of results) {
      console.log(`\n${r.app} ${r.version} — prête dans ${r.dir}`)
      if (r.bumpCommands.length > 0) {
        console.log('La version a changé sur le disque : à enregistrer avant de publier.\n')
        for (const command of r.bumpCommands) console.log(command)
        console.log()
      }
      console.log('Pour la publier (rien n\'est publié tant que tu ne les lances pas) :\n')
      for (const command of r.commands) console.log(command)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    console.error('\nUsage : bun run update:mentale | update:maths | update:all [-- patch|minor|major|X.Y.Z] [--skip-tests] [--notes "…"] [--out dossier]')
    process.exit(1)
  }
}
