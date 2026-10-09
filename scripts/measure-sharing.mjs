#!/usr/bin/env bun
// Mesure la part du code d'une app qui vient de `packages/shared`.
//
// Méthode (voir chantier/lots/L00-socle-et-filet.md) : partir de `<app>/src/main.tsx`, suivre
// les imports (relatifs, alias `@/` de l'app, entrées publiques `@suite/shared/*`), additionner
// les lignes non vides des fichiers .ts/.tsx atteints (tests exclus) et les répartir selon que
// le fichier vit dans `packages/shared` ou dans l'app. C'est une borne haute de ce que l'app
// « exécute » : un fichier atteint est compté en entier.
//
// Usage : bun scripts/measure-sharing.mjs [apps/base]
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHARED = join(ROOT, 'packages/shared')
const IMPORT = /(?:from|import|export\s+\*\s+from)\s*\(?\s*['"]([^'"]+)['"]/g
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx']
const isTest = file => /\.(test|spec)\.[tj]sx?$/.test(file) || /\/(test|testing)\//.test(file)

function resolveFile(base) {
  if (existsSync(base) && statSync(base).isFile()) return base
  for (const extension of EXTENSIONS) if (existsSync(base + extension)) return base + extension
  return null
}

function sharedEntries() {
  const { exports } = JSON.parse(readFileSync(join(SHARED, 'package.json'), 'utf8'))
  return new Map(Object.entries(exports).map(([key, target]) => [`@suite/shared/${key.slice(2)}`, join(SHARED, target)]))
}

/** Le fichier visé par `specifier` depuis `from`, ou `null` (paquet npm, CSS, fichier absent). */
export function resolveImport(specifier, from, appSrc, entries = sharedEntries()) {
  if (entries.has(specifier)) return entries.get(specifier)
  if (specifier.startsWith('@/')) return resolveFile(join(appSrc, specifier.slice(2)))
  if (specifier.startsWith('.')) return resolveFile(resolve(dirname(from), specifier))
  return null
}

export function measure(app) {
  const appRoot = resolve(ROOT, app)
  const appSrc = join(appRoot, 'src')
  const entries = sharedEntries()
  const seen = new Set()
  const queue = [join(appSrc, 'main.tsx')]
  const totals = { shared: 0, app: 0 }
  const files = { shared: 0, app: 0 }
  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file) || !/\.tsx?$/.test(file) || isTest(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    const side = file.startsWith(SHARED + '/') ? 'shared' : 'app'
    totals[side] += source.split('\n').filter(line => line.trim() !== '').length
    files[side] += 1
    for (const [, specifier] of source.matchAll(IMPORT)) {
      const target = resolveImport(specifier, file, appSrc, entries)
      if (target) queue.push(target)
    }
  }
  const all = totals.shared + totals.app
  return { app, totals, files, percent: all === 0 ? 0 : (totals.shared / all) * 100 }
}

if (import.meta.main) {
  const app = process.argv[2] ?? 'apps/base'
  const result = measure(app)
  console.log(`Mutualisation de ${app} (lignes non vides, tests exclus)`)
  console.log(`  shared : ${String(result.totals.shared).padStart(7)} lignes, ${result.files.shared} fichiers`)
  console.log(`  app    : ${String(result.totals.app).padStart(7)} lignes, ${result.files.app} fichiers`)
  console.log(`  part de shared : ${result.percent.toFixed(1)} %`)
}
