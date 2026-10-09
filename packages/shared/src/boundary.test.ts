import { describe, expect, it } from 'vitest'

const sources = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const IMPORT = /(?:from|import|vi\.mock|require)\s*\(?\s*['"]([^'"]+)['"]/g

function specifiers(source: string): string[] {
  return [...source.matchAll(IMPORT)].map(match => match[1])
}

/**
 * Ce qui, dans un fichier de `packages/shared/src`, ne doit JAMAIS apparaître :
 * un import qui atteint une app. `shared` est consommé par les apps, jamais
 * l'inverse — sinon la coquille de `base` embarquerait du Zachar't Mentale.
 */
function violations(path: string, source: string): string[] {
  // « ./a/b.ts » : 1 niveau de dossier sous src, donc au plus un `..` permis.
  const depth = path.split('/').length - 2
  const found: string[] = []
  for (const specifier of specifiers(source)) {
    if (/^@\//.test(specifier)) found.push(`${specifier} (alias de l'app)`)
    if (/^@app(\/|$)/.test(specifier)) found.push(`${specifier} (alias @app)`)
    if (/(^|\/)apps\//.test(specifier)) found.push(`${specifier} (chemin vers apps/)`)
    if (specifier.startsWith('.')) {
      const up = specifier.split('/').filter(part => part === '..').length
      if (up > depth) found.push(`${specifier} (sort de packages/shared/src)`)
    }
  }
  return found
}

describe('détecteur de frontière', () => {
  it('repère un alias d\'app, @app, un chemin apps/ et une sortie du package', () => {
    expect(violations('./ui/a.ts', `import x from '@/lib/utils'`)).toHaveLength(1)
    expect(violations('./ui/a.ts', `import x from '@app/types/card'`)).toHaveLength(1)
    expect(violations('./ui/a.ts', `import x from '../../../apps/base/src/x'`)).not.toHaveLength(0)
    expect(violations('./ui/a.ts', `import x from '../../outside'`)).toHaveLength(1)
    expect(violations('./a.ts', `import x from '../outside'`)).toHaveLength(1)
    expect(violations('./ui/a.ts', `vi.mock('@/state/store')`)).toHaveLength(1)
    expect(violations('./ui/a.ts', `const m = await import('@/lazy')`)).toHaveLength(1)
  })

  it('laisse passer les imports internes et les paquets', () => {
    expect(violations('./ui/a.ts', `import { cn } from '../lib/utils'`)).toEqual([])
    expect(violations('./ui/a.ts', `import { b } from './b'`)).toEqual([])
    expect(violations('./ui/a.ts', `import React from 'react'`)).toEqual([])
  })
})

describe('frontière de @suite/shared', () => {
  const files = Object.entries(sources).filter(([path]) => !path.endsWith('boundary.test.ts'))

  it('scanne bien des fichiers', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s n\'importe rien d\'une app', (path, source) => {
    expect(violations(path, source)).toEqual([])
  })
})

describe('@suite/shared/testing', () => {
  it('n\'est importé par aucun fichier de production', () => {
    const importers = Object.entries(sources)
      .filter(([path]) => !path.startsWith('./testing/') && !/\.test\.tsx?$/.test(path) && !path.startsWith('./test/'))
      .filter(([, source]) => specifiers(source).some(s => /(^|\/)testing(\/|$)/.test(s)))
      .map(([path]) => path)
    expect(importers).toEqual([])
  })
})

describe('persistance (L2)', () => {
  const STORAGE_ACCESS = /\b(?:local|session)Storage\b\s*(?:\.|\[|\?\.)/

  it('repère un accès direct au stockage du navigateur', () => {
    expect(STORAGE_ACCESS.test(`localStorage.getItem('k')`)).toBe(true)
    expect(STORAGE_ACCESS.test(`window.localStorage['k']`)).toBe(true)
    expect(STORAGE_ACCESS.test('// la clé `localStorage` du repli')).toBe(false)
  })

  it('aucun `localStorage` hors de shared/storage (tests exceptés)', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.startsWith('./storage/') && !/\.test\.tsx?$/.test(path) && !path.startsWith('./testing/'))
      .filter(([, source]) => STORAGE_ACCESS.test(source))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })
})
