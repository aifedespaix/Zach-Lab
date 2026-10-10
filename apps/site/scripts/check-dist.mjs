// Garde du build : le site doit contenir chaque route, et la vitrine ne doit
// embarquer AUCUN script — c'est la promesse faite à la personne qui la dessine.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const routes = ['login', 'inscription', 'gestion', 'dashboard', 'eleves', 'compte', 'bibliotheque']

const problems = []
for (const route of routes) {
  if (!existsSync(join(dist, route, 'index.html'))) problems.push(`route absente : /${route}/`)
}
const landing = join(dist, 'index.html')
if (!existsSync(landing)) problems.push('vitrine absente : /')
else if (/<script/i.test(readFileSync(landing, 'utf8'))) {
  problems.push('la vitrine contient un <script> : elle doit rester sans JavaScript')
}

if (problems.length > 0) {
  console.error(problems.map(line => `✗ ${line}`).join('\n'))
  process.exit(1)
}
console.log(`✓ ${routes.length} routes + vitrine sans script`)
