import { describe, expect, it } from 'vitest'
import { createMemoryFs } from './memoryFs'

describe('createMemoryFs', () => {
  it('lit ce qu\'il a écrit et crée les dossiers parents', async () => {
    const fs = createMemoryFs()
    await fs.writeText('a/b/c.txt', 'x')
    expect(await fs.readText('a/b/c.txt')).toBe('x')
    expect(await fs.readDir('a')).toEqual([{ name: 'b', isDirectory: true }])
    expect(await fs.exists('a/b')).toBe(true)
  })

  it('échoue sur un fichier ou un dossier absent', async () => {
    const fs = createMemoryFs()
    await expect(fs.readText('nope')).rejects.toThrow()
    await expect(fs.readDir('nope')).rejects.toThrow()
  })

  it('renomme un dossier avec son contenu', async () => {
    const fs = createMemoryFs({ 'a/x.txt': '1', 'a/s/y.txt': '2' })
    await fs.rename('a', 'b')
    expect(await fs.readText('b/s/y.txt')).toBe('2')
    expect(await fs.exists('a')).toBe(false)
  })

  it('supprime un dossier avec son contenu', async () => {
    const fs = createMemoryFs({ 'a/x.txt': '1', 'k.txt': '2' })
    await fs.remove('a')
    expect([...fs.files.keys()]).toEqual(['k.txt'])
  })
})
