#!/usr/bin/env bun
// Réécrit les imports d'une app après qu'un module a été déplacé vers
// `packages/shared`.
//
// Usage : bun scripts/move-module.mjs <app> <ancien> <spécificateur>
//   <app>            dossier de l'app, ex. apps/zachart-mentale
//   <ancien>         chemin (depuis <app>/src, sans extension) du module qui a BOUGÉ
//   <spécificateur>  ce que l'app importera désormais, ex. @suite/shared/ui
//
// Le `git mv` est fait par l'appelant ; ce script ne touche qu'aux imports.
// Il reconnaît les chemins relatifs (`../ui/button`) ET l'alias `@/ui/button`,
// dans les `import`, `export … from`, `import()` et `vi.mock()`.
//
// Limite : un module à export PAR DÉFAUT ne devient pas un import nommé tout
// seul. Pour ceux-là, ajouter `export { default as Nom } from './chemin'` au
// barrel du package et corriger l'import de l'app à la main.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const [app, oldModule, specifier] = process.argv.slice(2)
if (!specifier) {
  console.error('Usage: bun scripts/move-module.mjs <app> <ancien> <spécificateur>')
  process.exit(1)
}

const srcRoot = resolve(app, 'src')
const target = resolve(srcRoot, oldModule)
const LITERAL = /(['"])((?:\.{1,2}\/|@\/)[^'"]+)\1/g

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx)$/.test(name)) yield full
  }
}

const strip = path => path.replace(/\.(tsx?|jsx?)$/, '')

let changed = 0
for (const file of walk(srcRoot)) {
  const source = readFileSync(file, 'utf8')
  const next = source.replace(LITERAL, (whole, quote, value) => {
    const absolute = value.startsWith('@/')
      ? resolve(srcRoot, value.slice(2))
      : resolve(dirname(file), value)
    return strip(absolute) === strip(target) ? `${quote}${specifier}${quote}` : whole
  })
  if (next !== source) {
    writeFileSync(file, next)
    changed += 1
  }
}
console.log(`${changed} fichier(s) réécrit(s) pour ${oldModule} -> ${specifier}`)
