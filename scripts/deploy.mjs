#!/usr/bin/env bun
// Publishes one or several apps of the suite: bump the version, commit, push main,
// tag, push the tag(s). The pushed tag is what starts `.github/workflows/release.yml`
// (nothing builds on a plain push to main).
//
// Interactive:      bun run deploy
// Non-interactive:  bun run deploy <app|a,b|all> <patch|minor|major|X.Y.Z> [--yes] [--dry-run]
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { TAG_PREFIX, bumpVersion, listApps, nextVersion } from './bump-version.mjs'

const REPO_URL = 'https://github.com/aifedespaix/Zach-Lab'
const BRANCH = 'main'

const tagOf = (app, version) => `${TAG_PREFIX[app] ?? app}-v${version}`

export function currentVersion(root, app) {
  const file = join(root, 'apps', app, 'src-tauri', 'tauri.conf.json')
  const text = readFileSync(file, 'utf8')
  try {
    return JSON.parse(text).version
  } catch (error) {
    const conflict = /^(<{7}|={7}|>{7})/m.test(text) ? ' Il contient des marqueurs de conflit git (<<<<<<<) : résous le conflit.' : ''
    throw new Error(`${file} n'est pas un JSON valide (${error.message}).${conflict}`)
  }
}

/** `["zachart-maths", "minor", "--yes"]` -> `{ apps: ["zachart-maths"], bump: "minor", yes: true, dryRun: false }`. */
export function parseArgs(argv, knownApps) {
  const flags = argv.filter(a => a.startsWith('--'))
  const positional = argv.filter(a => !a.startsWith('--'))
  const unknown = flags.filter(f => !['--yes', '--dry-run'].includes(f))
  if (unknown.length) throw new Error(`Option inconnue : ${unknown.join(', ')}. Options : --yes, --dry-run.`)
  const [appArg, bump] = positional
  let apps = []
  if (appArg === 'all') apps = [...knownApps]
  else if (appArg) {
    apps = appArg.split(',')
    const bad = apps.filter(a => !knownApps.includes(a))
    if (bad.length) throw new Error(`App inconnue : « ${bad.join(', ')} ». Apps disponibles : ${knownApps.join(', ')}.`)
  }
  return { apps, bump, yes: flags.includes('--yes'), dryRun: flags.includes('--dry-run') }
}

/** What would be published, with nothing written. */
export function planDeploy(root, apps, bump) {
  return apps.map(app => {
    const current = currentVersion(root, app)
    const next = nextVersion(current, bump)
    return { app, current, next, tag: tagOf(app, next) }
  })
}

/**
 * Checks the repository is in a state where a release can go out, and returns
 * the problems (empty = ready). `git` runs a git command and returns its stdout.
 */
export function preflight(git, plan) {
  const problems = []
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  if (branch !== BRANCH) problems.push(`Tu es sur « ${branch} » : une release part de ${BRANCH}.`)
  if (git(['diff', '--cached', '--name-only']).trim()) {
    problems.push('Des fichiers sont déjà indexés (git add) : ils partiraient dans le commit de version. Commit-les ou `git restore --staged` d’abord.')
  }
  try {
    git(['fetch', 'origin', BRANCH, '--tags', '--quiet'])
    const behind = Number(git(['rev-list', '--count', `HEAD..origin/${BRANCH}`]).trim())
    if (behind > 0) problems.push(`Ta branche a ${behind} commit(s) de retard sur origin/${BRANCH} : fais un pull d’abord.`)
  } catch {
    problems.push('Impossible de joindre origin (git fetch a échoué).')
  }
  const tags = new Set(git(['tag', '--list']).split(/\r?\n/).filter(Boolean))
  for (const { tag } of plan) if (tags.has(tag)) problems.push(`Le tag ${tag} existe déjà.`)
  return problems
}

/** Bumps, commits (one commit per app), pushes main, then tags and pushes the tags. */
export function runDeploy({ root, plan, git, log = console.log }) {
  for (const { app, next } of plan) {
    const { files } = bumpVersion({ root, app, arg: next })
    git(['add', ...files])
    git(['commit', '-m', `chore(${TAG_PREFIX[app] ?? app}): bump version to ${next}`])
    log(`✔ ${app} ${next} : commit`)
  }
  git(['push', 'origin', BRANCH])
  log(`✔ push ${BRANCH}`)
  for (const { tag } of plan) git(['tag', tag])
  // One push per tag: GitHub starts no workflow at all when a single push carries
  // more than three tags.
  for (const { tag } of plan) git(['push', 'origin', tag])
  log(`✔ tag(s) poussé(s) : ${plan.map(p => p.tag).join(', ')}`)
}

async function interactive(rl, root, apps) {
  console.log('\nApps de la suite :\n')
  apps.forEach((app, i) => console.log(`  ${i + 1}. ${app.padEnd(18)} v${currentVersion(root, app)}`))
  const pick = (await rl.question('\nQuelle(s) app(s) publier ? (numéros séparés par des virgules, « all » pour toutes) '))
    .trim().toLowerCase()
  const chosen = pick === 'all'
    ? apps
    : pick.split(/[,\s]+/).filter(Boolean).map(n => apps[Number(n) - 1])
  if (!chosen.length || chosen.some(a => !a)) throw new Error('Sélection invalide.')

  console.log('\nType de version :\n')
  const kinds = ['patch', 'minor', 'major']
  kinds.forEach((kind, i) => {
    const preview = chosen.map(app => `${app} ${nextVersion(currentVersion(root, app), kind)}`).join(', ')
    console.log(`  ${i + 1}. ${kind.padEnd(6)} → ${preview}`)
  })
  console.log('  4. autre (X.Y.Z)')
  const answer = (await rl.question('\nChoix ? [1] ')).trim() || '1'
  let bump = kinds[Number(answer) - 1]
  if (answer === '4') bump = (await rl.question('Version exacte (X.Y.Z) : ')).trim()
  if (!bump) throw new Error('Choix invalide.')
  return { apps: chosen, bump }
}

function show(plan) {
  console.log('\nÀ publier :\n')
  for (const { app, current, next, tag } of plan) console.log(`  ${app.padEnd(18)} ${current} → ${next}   (tag ${tag})`)
}

if (import.meta.main) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const known = listApps(root)
    let { apps, bump, yes, dryRun } = parseArgs(process.argv.slice(2), known)
    if (!apps.length || !bump) {
      if (!process.stdin.isTTY) throw new Error('Usage : bun run deploy <app|a,b|all> <patch|minor|major|X.Y.Z> [--yes] [--dry-run]')
      ;({ apps, bump } = await interactive(rl, root, known))
    }
    const plan = planDeploy(root, apps, bump)
    show(plan)
    const problems = preflight(git, plan)
    if (problems.length) {
      console.error(`\n✖ Impossible de publier :\n${problems.map(p => `  - ${p}`).join('\n')}`)
      process.exit(1)
    }
    if (dryRun) {
      console.log('\n(--dry-run : rien n’a été écrit ni poussé.)')
    } else {
      if (!yes && (await rl.question('\nBumper, committer, pousser et tagger ? [o/N] ')).trim().toLowerCase() !== 'o') {
        console.log('Annulé.')
        process.exit(0)
      }
      runDeploy({ root, plan, git })
      console.log(`\nConstruction en cours : ${REPO_URL}/actions\nReleases            : ${REPO_URL}/releases`)
    }
  } catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  } finally {
    rl.close()
  }
}
