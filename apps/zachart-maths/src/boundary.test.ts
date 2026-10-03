import { describe, expect, it } from 'vitest'

const sources = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const IMPORT = /(?:from|import|vi\.mock|require)\s*\(?\s*['"]([^'"]+)['"]/g
const PUBLIC_ENTRIES = new Set(['ui', 'theme', 'update', 'shell', 'commands', 'settings', 'search', 'math', 'tree'])

/**
 * Ce qui ne doit pas se glisser dans cette app : du code d'une autre app (un module copié ou
 * importé de Zachar't Mentale ferait dériver les deux), ou un import qui entre dans `@suite/shared`
 * ailleurs que par ses points d'entrée publics.
 */
function violations(source: string): string[] {
  const found: string[] = []
  for (const [, specifier] of source.matchAll(IMPORT)) {
    if (/(^|\/)apps\/|zachart-mentale/.test(specifier)) found.push(`${specifier} (une autre app)`)
    const shared = /^@suite\/shared\/([^/]+)(\/.*)?$/.exec(specifier)
    if (shared !== null && (!PUBLIC_ENTRIES.has(shared[1].replace(/\.css$/, '')) || shared[2] !== undefined)) {
      found.push(`${specifier} (pas un point d'entrée public de shared)`)
    }
    if (/^\.\.\/\.\.\/\.\.\//.test(specifier) && /packages\/shared/.test(specifier)) found.push(`${specifier} (chemin direct dans shared)`)
  }
  return found
}

describe('détecteur de frontière', () => {
  it('repère une autre app, un sous-chemin de shared et un chemin direct', () => {
    expect(violations(`import x from '../../zachart-mentale/src/x'`)).toHaveLength(1)
    expect(violations(`import x from '@suite/shared/ui/button'`)).toHaveLength(1)
    expect(violations(`import x from '@suite/shared/interne'`)).toHaveLength(1)
    expect(violations(`vi.mock('../../../apps/zachart-mentale/x')`).length).toBeGreaterThan(0)
  })
  it('laisse passer les points d\'entrée publics et les paquets', () => {
    expect(violations(`import { Button } from '@suite/shared/ui'`)).toEqual([])
    expect(violations(`import '@suite/shared/theme.css'`)).toEqual([])
    expect(violations(`import { renderMathToHtml } from '@suite/shared/math'`)).toEqual([])
    expect(violations(`import { beginTreeDrag } from '@suite/shared/tree'`)).toEqual([])
    expect(violations(`import x from '@suite/shared/tree/treeDrag'`)).toHaveLength(1)
    expect(violations(`import katex from 'katex'`)).toEqual([])
  })
})

describe('frontière de zachart-maths', () => {
  // `test/setup.ts` charge les shims jsdom partagés par chemin : c'est son rôle, comme dans `base`.
  const files = Object.entries(sources).filter(([path]) => !path.endsWith('boundary.test.ts') && path !== './test/setup.ts')

  it('scanne bien des fichiers', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it.each(files)('%s', (_path, source) => {
    expect(violations(source)).toEqual([])
  })
})
