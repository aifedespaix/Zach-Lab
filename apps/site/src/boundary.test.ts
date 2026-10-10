import { describe, expect, it } from 'vitest'

const sources = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const IMPORT = /(?:from|import|vi\.mock|require)\s*\(?\s*['"]([^'"]+)['"]/g

/**
 * L'interface d'administration est servie par PocketBase, dans un navigateur :
 * rien de ce qu'elle importe ne doit pouvoir toucher Tauri. `@suite/shared`
 * n'est donc accessible que par les sous-chemins qui n'y touchent pas —
 * `commands`, `settings`, `shell` et `update` persistent des réglages ou parlent
 * à l'updater, ils lui restent interdits.
 */
const ALLOWED_SHARED = new Set(['ui', 'theme', 'search'])

/**
 * Règles du site : `@app/` (le code pur de Mentale) n'est permis que sous
 * `app/bibliotheque/` ; aucune app ne s'importe par chemin ; la vitrine
 * (`site/`) n'importe rien de `app/`.
 */
function violations(source: string, path = './app/bibliotheque/x.ts'): string[] {
  const found: string[] = []
  for (const match of source.matchAll(IMPORT)) {
    const specifier = match[1]
    if (specifier.startsWith('@app/') && !path.startsWith('./app/bibliotheque/')) {
      found.push(`${specifier} (@app réservé à app/bibliotheque)`)
    }
    if (/zachart-mentale\/|zachart-maths\/|(^|[./])apps\//.test(specifier)) {
      found.push(`${specifier} (import d'une app par chemin)`)
    }
    if ((path.startsWith('./site/') || path === './pages/index.astro') && (specifier.startsWith('@/') || /(^|\/)app\//.test(specifier))) {
      found.push(`${specifier} (la vitrine n'importe rien de app/)`)
    }
    if (specifier.startsWith('@tauri-apps/')) found.push(`${specifier} (Tauri)`)
    const shared = specifier.match(/^@suite\/shared(?:\/([^/]+))?/)
    if (shared && !ALLOWED_SHARED.has(shared[1] ?? '')) {
      found.push(`${specifier} (sous-chemin de shared interdit à admin)`)
    }
  }
  return found
}

describe('détecteur de frontière d\'admin', () => {
  it('repère Tauri et les sous-chemins interdits', () => {
    expect(violations(`import { x } from '@tauri-apps/api/core'`)).toHaveLength(1)
    expect(violations(`import { x } from '@tauri-apps/plugin-fs'`)).toHaveLength(1)
    expect(violations(`import { x } from '@suite/shared/update'`)).toHaveLength(1)
    expect(violations(`import { x } from '@suite/shared/commands'`)).toHaveLength(1)
    expect(violations(`import { x } from '@suite/shared'`)).toHaveLength(1)
  })

  it("n'autorise @app que sous app/bibliotheque", () => {
    expect(violations(`import { x } from '@app/types/card'`, './app/bibliotheque/lib/a.ts')).toEqual([])
    expect(violations(`import { x } from '@app/types/card'`, './app/gestion/a.ts')).toHaveLength(1)
    expect(violations(`import x from '../../zachart-maths/src/a'`, './app/a.ts')).toHaveLength(1)
  })

  it("interdit à la vitrine d'importer app/", () => {
    expect(violations(`import x from '../app/ui/primitives'`, './site/a.ts')).toHaveLength(1)
    expect(violations(`import x from './b'`, './site/a.ts')).toEqual([])
  })

  it('la règle est active avec le format réel des clés du glob', () => {
    // Les clés d'import.meta.glob('./**/*') ressemblent à './app/gestion/x.ts'.
    expect(violations(`import { x } from '@app/types/card'`, './app/gestion/x.ts')).toHaveLength(1)
    expect(violations(`import { x } from '@app/types/card'`, './site/Hero.tsx')).toHaveLength(1)
    expect(violations(`import { x } from '@app/types/card'`, './app/bibliotheque/lib/x.ts')).toEqual([])
    expect(violations(`import { x } from '@/ui/primitives'`, './site/Hero.tsx')).toHaveLength(1)
    expect(violations(`import { x } from '../app/ui/primitives'`, './pages/index.astro')).toHaveLength(1)
  })

  it('laisse passer ui, theme, search et le reste', () => {
    expect(violations(`import { Button } from '@suite/shared/ui'`)).toEqual([])
    expect(violations(`import { x } from '@suite/shared/theme'`)).toEqual([])
    expect(violations(`import { x } from '@suite/shared/search'`)).toEqual([])
    expect(violations(`import PocketBase from 'pocketbase'`)).toEqual([])
  })
})

describe('frontière d\'admin', () => {
  const files = Object.entries(sources).filter(([path]) => !path.endsWith('boundary.test.ts'))

  it('scanne bien des fichiers', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  // Le glob ne scanne que .ts/.tsx : la règle « vitrine » ne s'applique donc
  // aux vrais fichiers que s'il y en a sous ./site/ ; les .astro de la vitrine
  // sont couverts par scripts/check-dist.mjs.
  it.each(files)('%s respecte la frontière', (path, source) => {
    expect(violations(source, path)).toEqual([])
  })
})
