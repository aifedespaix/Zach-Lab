// Run with: bun test scripts/new-app.test.mjs
//
// The fixture is a COPY of the real apps/base: if base drifts from what the
// script knows how to rename, these tests fail here rather than in the first
// app someone generates.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './new-app.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')

let root

function read(...parts) {
  return readFileSync(join(root, ...parts), 'utf8')
}

function listAll(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? listAll(join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
  )
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'new-app-'))
  cpSync(join(REPO, 'apps', 'base'), join(root, 'apps', 'base'), {
    recursive: true,
    filter: source => !/[\\/](node_modules|dist|target|gen)([\\/]|$)/.test(source),
  })
  // The other apps only matter for the port they already use.
  mkdirSync(join(root, 'apps', 'zachart-mentale'), { recursive: true })
  writeFileSync(join(root, 'apps', 'zachart-mentale', 'vite.config.ts'), 'export default { server: { port: 1420 } }\n')
  cpSync(join(REPO, 'Cargo.toml'), join(root, 'Cargo.toml'))
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('createApp — ce qui est renommé', () => {
  it('copie base dans apps/<nom> et renomme tout ce qui identifie l\'app', () => {
    createApp({ root, name: 'maths-college' })

    expect(JSON.parse(read('apps', 'maths-college', 'package.json')).name).toBe('maths-college')
    expect(read('apps', 'maths-college', 'index.html')).toContain('<title>Maths College</title>')

    const conf = JSON.parse(read('apps', 'maths-college', 'src-tauri', 'tauri.conf.json'))
    expect(conf.productName).toBe('Maths College')
    expect(conf.identifier).toBe('com.clape.maths-college')
    expect(conf.app.windows[0].title).toBe('Maths College')
    expect(conf.version).toBe('0.1.0')
    // Aucun updater tant qu'une clé n'existe : la copie ne doit pas hériter d'un endpoint.
    expect(conf.bundle.createUpdaterArtifacts).toBe(false)

    const cargo = read('apps', 'maths-college', 'src-tauri', 'Cargo.toml')
    expect(cargo).toContain('name = "maths-college"')
    expect(cargo).toContain('name = "maths_college_lib"')
    expect(read('apps', 'maths-college', 'src-tauri', 'src', 'main.rs')).toContain('maths_college_lib::run()')
    expect(read('apps', 'maths-college', 'src-tauri', 'build.rs')).toContain('maths-college-icon.ico')

    const app = read('apps', 'maths-college', 'src', 'App.tsx')
    expect(app).toContain("'maths-college:left-width'")
    expect(app).toContain("'maths-college:right-width'")
  })

  it('ne laisse rien de « base » là où il identifie l\'app', () => {
    createApp({ root, name: 'maths' })
    const identifying = [
      ['package.json'],
      ['src-tauri', 'Cargo.toml'],
      ['src-tauri', 'tauri.conf.json'],
      ['src-tauri', 'src', 'main.rs'],
      ['src-tauri', 'build.rs'],
    ].map(parts => read('apps', 'maths', ...parts))
    for (const text of identifying) {
      expect(text).not.toContain('base_lib')
      expect(text).not.toContain('com.clape.base')
      expect(text).not.toContain('"name": "base"')
      expect(text).not.toContain('name = "base"')
    }
  })

  it('met à jour les ports Vite et HMR', () => {
    createApp({ root, name: 'maths', port: 1460 })
    const vite = read('apps', 'maths', 'vite.config.ts')
    expect(vite).toContain('port: 1460,')
    expect(vite).toContain('port: 1461,')
    expect(read('apps', 'maths', 'src-tauri', 'tauri.conf.json')).toContain('http://localhost:1460')
  })

  it('déclare la crate dans le workspace Cargo, une seule fois, sans toucher aux autres membres', () => {
    createApp({ root, name: 'maths' })
    const cargo = read('Cargo.toml')
    const members = cargo.match(/members = \[(.*)\]/)[1]
    expect(members).toContain('"apps/maths/src-tauri"')
    expect(members).toContain('"crates/suite-tauri"')
    expect(members).toContain('"apps/base/src-tauri"')
    expect(cargo.match(/apps\/maths\/src-tauri/g)).toHaveLength(1)
  })

  it('ne copie ni node_modules, ni dist, ni target, ni gen', () => {
    for (const dir of [['node_modules', 'x'], ['dist', 'x'], ['src-tauri', 'target', 'x'], ['src-tauri', 'gen', 'x']]) {
      mkdirSync(join(root, 'apps', 'base', ...dir.slice(0, -1)), { recursive: true })
      writeFileSync(join(root, 'apps', 'base', ...dir), 'junk')
    }
    createApp({ root, name: 'maths' })
    const files = listAll(join(root, 'apps', 'maths'))
    expect(files.some(file => /(^|\/)(node_modules|dist|target|gen)\//.test(file))).toBe(false)
    expect(files).toContain('src/App.tsx')
  })

  it('laisse apps/base intact', () => {
    const before = listAll(join(root, 'apps', 'base')).map(file => [file, read('apps', 'base', file)])
    createApp({ root, name: 'maths' })
    const after = listAll(join(root, 'apps', 'base')).map(file => [file, read('apps', 'base', file)])
    expect(after).toEqual(before)
  })
})

describe('createApp — le port', () => {
  it('prend par défaut le premier port libre au-dessus de ceux des apps existantes', () => {
    createApp({ root, name: 'maths' })
    expect(read('apps', 'maths', 'vite.config.ts')).toContain('port: 1450,')
    createApp({ root, name: 'physique' })
    expect(read('apps', 'physique', 'vite.config.ts')).toContain('port: 1460,')
  })

  it.each([0, 80, 1023, 65535, 70000, 1450.5, -1, Number.NaN])('refuse le port %p', port => {
    expect(() => createApp({ root, name: 'maths', port })).toThrow(/port/i)
    expect(existsSync(join(root, 'apps', 'maths'))).toBe(false)
  })

  it('refuse un port déjà pris par une autre app (Vite est en strictPort : le second échouerait au lancement)', () => {
    expect(() => createApp({ root, name: 'maths', port: 1440 })).toThrow(/1440/)
    expect(() => createApp({ root, name: 'maths', port: 1420 })).toThrow(/1420/)
  })

  it('refuse aussi le port HMR d\'une autre app', () => {
    expect(() => createApp({ root, name: 'maths', port: 1441 })).toThrow(/1441/)
  })
})

describe('createApp — refus, et rien n\'est écrit', () => {
  it.each(['', 'A', 'a', 'Maths', '../x', 'x/y', 'x y', '-a', 'a_b', 'a.b', 'x'.repeat(40), '1abc'])(
    'refuse le nom %j',
    name => {
      const cargoBefore = read('Cargo.toml')
      expect(() => createApp({ root, name })).toThrow(/nom/i)
      expect(read('Cargo.toml')).toBe(cargoBefore)
      expect(readdirSync(join(root, 'apps')).sort()).toEqual(['base', 'zachart-mentale'])
    },
  )

  it('refuse un nom déjà pris, sans rien modifier', () => {
    const cargoBefore = read('Cargo.toml')
    expect(() => createApp({ root, name: 'zachart-mentale' })).toThrow(/existe déjà/)
    expect(() => createApp({ root, name: 'base' })).toThrow(/existe déjà/)
    expect(read('Cargo.toml')).toBe(cargoBefore)
  })

  it('échoue clairement quand base a dérivé du gabarit, et ne laisse rien derrière lui', () => {
    const main = join(root, 'apps', 'base', 'src-tauri', 'src', 'main.rs')
    writeFileSync(main, readFileSync(main, 'utf8').replace('base_lib::run()', 'autre::run()'))
    const cargoBefore = read('Cargo.toml')
    expect(() => createApp({ root, name: 'maths' })).toThrow(/main\.rs/)
    expect(read('Cargo.toml')).toBe(cargoBefore)
    expect(readdirSync(join(root, 'apps')).sort()).toEqual(['base', 'zachart-mentale'])
  })

  it('échoue si le workspace Cargo n\'a pas la liste attendue, sans rien laisser', () => {
    writeFileSync(join(root, 'Cargo.toml'), '[workspace]\nresolver = "2"\n')
    expect(() => createApp({ root, name: 'maths' })).toThrow(/Cargo\.toml/)
    expect(readdirSync(join(root, 'apps')).sort()).toEqual(['base', 'zachart-mentale'])
  })
})
