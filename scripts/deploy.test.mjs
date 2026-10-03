// Run with: bun test scripts/deploy.test.mjs
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs, planDeploy, preflight, runDeploy } from './deploy.mjs'

let root

function writeApp(app, version) {
  const dir = join(root, 'apps', app)
  mkdirSync(join(dir, 'src-tauri'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ name: app, version }, null, 2)}\n`)
  writeFileSync(join(dir, 'src-tauri', 'tauri.conf.json'), `${JSON.stringify({ version }, null, 2)}\n`)
  writeFileSync(join(dir, 'src-tauri', 'Cargo.toml'), `[package]\nname = "${app}"\nversion = "${version}"\n`)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'deploy-'))
  writeApp('zachart-mentale', '1.2.3')
  writeApp('zachart-maths', '0.4.0')
  writeFileSync(
    join(root, 'Cargo.lock'),
    '[[package]]\nname = "zachart-mentale"\nversion = "1.2.3"\n\n[[package]]\nname = "zachart-maths"\nversion = "0.4.0"\n',
  )
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const apps = ['zachart-maths', 'zachart-mentale']

describe('parseArgs', () => {
  it('reads app, bump and flags', () => {
    expect(parseArgs(['zachart-maths', 'minor', '--yes'], apps)).toEqual({ apps: ['zachart-maths'], bump: 'minor', yes: true, dryRun: false })
  })
  it('expands « all » and comma lists', () => {
    expect(parseArgs(['all', 'patch'], apps).apps).toEqual(apps)
    expect(parseArgs(['zachart-maths,zachart-mentale', 'patch'], apps).apps).toEqual(apps)
  })
  it('rejects unknown apps and flags', () => {
    expect(() => parseArgs(['nope', 'patch'], apps)).toThrow('App inconnue')
    expect(() => parseArgs(['--force'], apps)).toThrow('Option inconnue')
  })
})

describe('planDeploy', () => {
  it('computes versions and tags with the right prefix, writing nothing', () => {
    expect(planDeploy(root, apps, 'minor')).toEqual([
      { app: 'zachart-maths', current: '0.4.0', next: '0.5.0', tag: 'zachart-maths-v0.5.0' },
      { app: 'zachart-mentale', current: '1.2.3', next: '1.3.0', tag: 'zachart-v1.3.0' },
    ])
    expect(readFileSync(join(root, 'apps/zachart-maths/package.json'), 'utf8')).toContain('0.4.0')
  })
})

describe('preflight', () => {
  const fake = (over = {}) => args => {
    const key = args.slice(0, 2).join(' ')
    const table = {
      'rev-parse --abbrev-ref': 'main\n', 'diff --cached': '', fetch: '', 'rev-list --count': '0\n', 'tag --list': '',
      ...over,
    }
    return table[key] ?? table[args[0]] ?? ''
  }
  const plan = [{ app: 'zachart-maths', current: '0.4.0', next: '0.4.1', tag: 'zachart-maths-v0.4.1' }]
  it('passes on a clean main', () => expect(preflight(fake(), plan)).toEqual([]))
  it('refuses another branch, staged files, a lag and an existing tag', () => {
    const problems = preflight(
      fake({ 'rev-parse --abbrev-ref': 'feat\n', 'diff --cached': 'a.ts\n', 'rev-list --count': '2\n', 'tag --list': 'zachart-maths-v0.4.1\n' }),
      plan,
    )
    expect(problems).toHaveLength(4)
  })
})

describe('runDeploy', () => {
  it('bumps, commits per app, pushes main then the tags', () => {
    const calls = []
    runDeploy({ root, plan: planDeploy(root, apps, 'patch'), git: a => { calls.push(a.join(' ')); return '' }, log: () => {} })
    expect(JSON.parse(readFileSync(join(root, 'apps/zachart-maths/src-tauri/tauri.conf.json'), 'utf8')).version).toBe('0.4.1')
    expect(calls.filter(c => c.startsWith('commit'))).toHaveLength(2)
    expect(calls.slice(-2)).toEqual(['push origin zachart-maths-v0.4.1', 'push origin zachart-v1.2.4'])
    expect(calls.indexOf('push origin main')).toBeLessThan(calls.indexOf('tag zachart-v1.2.4'))
  })
})
