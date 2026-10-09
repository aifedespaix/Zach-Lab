#!/usr/bin/env bun
// Creates a new app of the suite from `apps/base`.
//
// Usage: bun run new-app <nom> [--port <n>]
//   <nom>     lowercase letters, digits and hyphens, e.g. `maths` or `maths-college`
//   --port    the Vite dev-server port; the next `--port + 1` is its HMR port.
//             Defaults to the first free multiple of ten above the ports in use.
//
// It copies `apps/base` and renames what identifies the app (package, Tauri
// product and identifier, Rust crate, ports, storage keys), then declares the
// crate in the Cargo workspace. It does not publish anything: the copy has no
// updater key, so it produces no update artifacts until one is configured.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,30}$/
const SKIPPED = /[\\/](node_modules|dist|target|gen)([\\/]|$)/

const titleCase = name =>
  name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

/**
 * Replaces `from` by `to` in `text`, and refuses to go on if `from` is not
 * there: a silent no-op would hand out an app still named « base ».
 */
function replaceExact(file, text, from, to) {
  if (!text.includes(from)) {
    throw new Error(`${file} : « ${from} » est introuvable — apps/base a dérivé de ce que new-app sait renommer.`)
  }
  return text.split(from).join(to)
}

/** Every Vite port already claimed (server AND HMR) by an app under `apps/`. */
function portsInUse(root) {
  const used = new Set()
  const appsDir = join(root, 'apps')
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    const config = join(appsDir, entry.name, 'vite.config.ts')
    if (!entry.isDirectory() || !existsSync(config)) continue
    for (const match of readFileSync(config, 'utf8').matchAll(/\bport:\s*(\d+)/g)) used.add(Number(match[1]))
  }
  return used
}

function chooseFreePort(used) {
  const highest = Math.max(1420, ...used)
  return Math.floor(highest / 10) * 10 + 10
}

/**
 * @param {{ root: string, name: string, port?: number }} options
 *   `root` is the repository root.
 */
export function createApp({ root, name, port }) {
  if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
    throw new Error(
      `Nom invalide : « ${name} ». Des minuscules, des chiffres et des tirets, entre 2 et 31 caractères, en commençant par une lettre.`,
    )
  }

  const appsDir = join(root, 'apps')
  const target = join(appsDir, name)
  if (existsSync(target)) throw new Error(`apps/${name} existe déjà.`)

  const used = portsInUse(root)
  const vitePort = port ?? chooseFreePort(used)
  if (!Number.isInteger(vitePort) || vitePort < 1024 || vitePort > 65534) {
    throw new Error(`Port invalide : ${vitePort}. Un entier entre 1024 et 65534 (le suivant sert au HMR).`)
  }
  for (const taken of [vitePort, vitePort + 1]) {
    if (used.has(taken)) {
      throw new Error(`Le port ${taken} est déjà pris par une autre app (Vite est en strictPort : la seconde ne démarrerait pas).`)
    }
  }

  const snake = name.replace(/-/g, '_')
  const product = titleCase(name)

  // The workspace list is checked BEFORE anything is copied, so a Cargo.toml the
  // script cannot read leaves nothing behind.
  const cargoPath = join(root, 'Cargo.toml')
  const cargo = readFileSync(cargoPath, 'utf8')
  const membersPattern = /(members\s*=\s*\[)([^\]]*)(\])/
  if (!membersPattern.test(cargo)) {
    throw new Error('Cargo.toml : la liste `members` du workspace est introuvable.')
  }
  const nextCargo = cargo.replace(
    membersPattern,
    (_whole, open, list, close) => `${open}${list.trimEnd()}, "apps/${name}/src-tauri"${close}`,
  )

  // Built in a scratch folder next to the target, then renamed into place: a
  // failure halfway must not leave a half-renamed app in `apps/`.
  const scratch = join(appsDir, `.new-app-${name}.tmp`)
  rmSync(scratch, { recursive: true, force: true })
  try {
    cpSync(join(appsDir, 'base'), scratch, { recursive: true, filter: source => !SKIPPED.test(source) })

    const edit = (relative, transform) => {
      const file = join(scratch, ...relative.split('/'))
      writeFileSync(file, transform(readFileSync(file, 'utf8'), relative))
    }

    edit('package.json', (text, file) => replaceExact(file, text, '"name": "base"', `"name": "${name}"`))
    edit('index.html', (text, file) => replaceExact(file, text, '<title>Base</title>', `<title>${product}</title>`))
    edit('vite.config.ts', (text, file) => {
      let next = replaceExact(file, text, 'port: 1441,', `port: ${vitePort + 1},`)
      next = replaceExact(file, next, 'port: 1440,', `port: ${vitePort},`)
      return next
    })
    edit('src/app.config.ts', (text, file) => {
      let next = replaceExact(file, text, "id: 'base',", `id: '${name}',`)
      next = replaceExact(file, next, "name: 'Base',", `name: '${product}',`)
      return next
    })
    edit('src-tauri/Cargo.toml', (text, file) => {
      let next = replaceExact(file, text, 'name = "base_lib"', `name = "${snake}_lib"`)
      next = replaceExact(file, next, 'name = "base"', `name = "${name}"`)
      return next
    })
    edit('src-tauri/src/main.rs', (text, file) => replaceExact(file, text, 'base_lib::run()', `${snake}_lib::run()`))
    edit('src-tauri/build.rs', (text, file) => replaceExact(file, text, '"base-icon.ico"', `"${name}-icon.ico"`))
    edit('src-tauri/tauri.conf.json', (text, file) => {
      const conf = JSON.parse(text)
      if (conf.productName !== 'Base' || conf.identifier !== 'com.clape.base') {
        throw new Error(`${file} : productName / identifier ne sont plus ceux de base — apps/base a dérivé.`)
      }
      conf.productName = product
      conf.identifier = `com.clape.${name}`
      conf.version = '0.1.0'
      conf.app.windows[0].title = product
      conf.build.devUrl = `http://localhost:${vitePort}`
      return `${JSON.stringify(conf, null, 2)}\n`
    })

    renameSync(scratch, target)
  } catch (error) {
    rmSync(scratch, { recursive: true, force: true })
    throw error
  }

  try {
    writeFileSync(cargoPath, nextCargo)
  } catch (error) {
    rmSync(target, { recursive: true, force: true })
    throw error
  }

  return { name, product, port: vitePort, path: target }
}

/** `[nom, --port n]`, dans n'importe quel ordre : le nom est le seul argument qui n'est ni le drapeau ni sa valeur. */
export function parseArgs(args) {
  const portFlag = args.indexOf('--port')
  const port = portFlag === -1 ? undefined : Number(args[portFlag + 1])
  const name = args.find((arg, index) => !arg.startsWith('--') && (portFlag === -1 || index !== portFlag + 1))
  return { name, port }
}

// `import.meta.main` is Bun's « this file was run, not imported ».
if (import.meta.main) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const { name, port } = parseArgs(process.argv.slice(2))

  if (name === undefined) {
    console.error('Usage: bun run new-app <nom> [--port <n>]')
    process.exit(1)
  }

  try {
    const created = createApp({ root, name, port })
    console.log(`apps/${created.name} créée (${created.product}, port ${created.port}).`)
    console.log('\nEnsuite :')
    console.log('  bun install')
    console.log(`  bun run --filter ${created.name} test`)
    console.log(`  cd apps/${created.name} && bun tauri dev`)
    console.log('\nÀ faire avant de publier : remplacer les icônes (bun tauri icon <image>) et configurer la clé de mise à jour.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
