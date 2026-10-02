#!/usr/bin/env bun
// Bumps the version of ONE app of the suite in every place that carries it:
//   apps/<app>/package.json
//   apps/<app>/src-tauri/tauri.conf.json   (the release workflow tags off this one)
//   apps/<app>/src-tauri/Cargo.toml        ([package] version)
//   Cargo.lock                             (the entry of the app's crate)
// so the four can never drift apart.
//
// Usage: bun run version:bump -- <app> <patch|minor|major|X.Y.Z>
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Tag prefix per app (`zachart-v1.2.3`); an app not listed here uses its own name (`base-v0.1.0`). */
export const TAG_PREFIX = { 'zachart-mentale': 'zachart' }

const SEMVER = /^\d+\.\d+\.\d+$/
const APP_NAME = /^[a-z][a-z0-9-]*$/

export function listApps(root) {
  const appsDir = join(root, 'apps')
  if (!existsSync(appsDir)) return []
  return readdirSync(appsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(appsDir, entry.name, 'src-tauri', 'tauri.conf.json')))
    .map(entry => entry.name)
    .sort()
}

export function nextVersion(current, arg) {
  if (SEMVER.test(arg)) return arg
  const [major, minor, patch] = current.split('.').map(Number)
  if (arg === 'patch') return `${major}.${minor}.${patch + 1}`
  if (arg === 'minor') return `${major}.${minor + 1}.0`
  if (arg === 'major') return `${major + 1}.0.0`
  throw new Error(`Version non reconnue : « ${arg} ». Attendu : patch, minor, major, ou X.Y.Z.`)
}

/** The same JSON, with `version` replaced — 2 spaces and a final newline, like the files it rewrites. */
function withJsonVersion(text, next) {
  const data = JSON.parse(text)
  data.version = next
  return `${JSON.stringify(data, null, 2)}\n`
}

/** Replaces `version` inside the `[package]` table only: a dependency's `version = "…"` must survive. */
function withCargoVersion(file, text, next) {
  const lines = text.split(/(?<=\n)/) // keeps each line's own \r\n
  const start = lines.findIndex(line => /^\[package\]\s*$/.test(line))
  if (start === -1) throw new Error(`${file} : table [package] introuvable.`)
  for (let i = start + 1; i < lines.length && !/^\[/.test(lines[i]); i++) {
    if (/^version\s*=\s*"[^"]*"/.test(lines[i])) {
      lines[i] = lines[i].replace(/^(version\s*=\s*")[^"]*(")/, `$1${next}$2`)
      return lines.join('')
    }
  }
  throw new Error(`${file} : version introuvable dans [package].`)
}

function crateNameOf(file, text) {
  const table = text.split(/\r?\n/)
  const start = table.findIndex(line => /^\[package\]\s*$/.test(line))
  for (let i = start + 1; start !== -1 && i < table.length && !/^\[/.test(table[i]); i++) {
    const match = table[i].match(/^name\s*=\s*"([^"]+)"/)
    if (match) return match[1]
  }
  throw new Error(`${file} : nom de la crate introuvable dans [package].`)
}

function withLockVersion(crate, text, next) {
  const escaped = crate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const entry = new RegExp(`(name = "${escaped}"\\r?\\nversion = ")[^"]*(")`)
  if (!entry.test(text)) throw new Error(`Cargo.lock : aucune entrée pour la crate « ${crate} ».`)
  return text.replace(entry, `$1${next}$2`)
}

/**
 * @param {{ root: string, app: string, arg: string }} options `root` is the repository root.
 */
export function bumpVersion({ root, app, arg }) {
  const apps = listApps(root)
  if (typeof app !== 'string' || !APP_NAME.test(app) || !apps.includes(app)) {
    throw new Error(`App inconnue : « ${app} ». Apps disponibles : ${apps.join(', ') || '(aucune)'}.`)
  }

  const dir = join(root, 'apps', app)
  const paths = {
    package: join(dir, 'package.json'),
    tauri: join(dir, 'src-tauri', 'tauri.conf.json'),
    cargo: join(dir, 'src-tauri', 'Cargo.toml'),
    lock: join(root, 'Cargo.lock'),
  }

  // tauri.conf.json is where the release tag comes from, so it defines « current ».
  const current = JSON.parse(readFileSync(paths.tauri, 'utf8')).version
  if (typeof current !== 'string' || !SEMVER.test(current)) {
    throw new Error(`apps/${app}/src-tauri/tauri.conf.json : version illisible (« ${current} »).`)
  }
  const next = nextVersion(current, arg)

  // Every new content is computed BEFORE anything is written: a Cargo.lock
  // without the crate must not leave the other three files bumped.
  const cargoText = readFileSync(paths.cargo, 'utf8')
  const crate = crateNameOf(`apps/${app}/src-tauri/Cargo.toml`, cargoText)
  const contents = {
    [paths.package]: withJsonVersion(readFileSync(paths.package, 'utf8'), next),
    [paths.tauri]: withJsonVersion(readFileSync(paths.tauri, 'utf8'), next),
    [paths.cargo]: withCargoVersion(`apps/${app}/src-tauri/Cargo.toml`, cargoText, next),
    [paths.lock]: withLockVersion(crate, readFileSync(paths.lock, 'utf8'), next),
  }
  for (const [path, text] of Object.entries(contents)) writeFileSync(path, text)

  const tag = `${TAG_PREFIX[app] ?? app}-v${next}`
  const files = [`apps/${app}/package.json`, `apps/${app}/src-tauri/tauri.conf.json`, `apps/${app}/src-tauri/Cargo.toml`, 'Cargo.lock']
  const commands = [
    `git add ${files.join(' ')}`,
    `git commit -m "chore(${TAG_PREFIX[app] ?? app}): bump version to ${next}"`,
    'git push origin main',
    `git tag ${tag}`,
    `git push origin ${tag}`,
  ]
  return { app, current, next, tag, files, commands }
}

if (import.meta.main) {
  const [app, arg] = process.argv.slice(2)
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  if (!app || !arg) {
    console.error('Usage: bun run version:bump -- <app> <patch|minor|major|X.Y.Z>')
    console.error(`Apps : ${listApps(root).join(', ')}`)
    process.exit(1)
  }
  try {
    const result = bumpVersion({ root, app, arg })
    console.log(`${result.app} : ${result.current} -> ${result.next}`)
    console.log('\nNext, copy-paste:\n')
    for (const command of result.commands) console.log(command)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
