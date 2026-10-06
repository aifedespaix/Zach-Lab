import { describe, expect, it } from 'vitest'
import { loadSearchEntries, searchEntries } from './librarySearch'
import { createMemoryFs } from './memoryFs'
import { newExercise, SHEET_VERSION, type Exercise } from './types'

const sheet = (titre: string, exercices: Partial<Exercise>[]) =>
  JSON.stringify({ version: SHEET_VERSION, id: titre, titre, exercices: exercices.map(e => ({ ...newExercise(), ...e })) })

async function entries() {
  const fs = createMemoryFs({
    'Fractions/Somme.json': sheet('Somme', [
      { id: 'a', numero: '1a', enonce: 'Calcule la somme de deux fractions', reponse: '7/12' },
      { id: 'b', numero: '2', enonce: 'Simplifie', blocs: [{ id: 'x', type: 'texte', contenu: 'On utilise le théorème de Thalès' }] },
    ]),
    'Géométrie/Thalès.json': sheet('Thalès', [{ id: 'c', enonce: 'Trace la figure', notes: 'revoir la réciproque' }]),
  })
  return loadSearchEntries(fs)
}

describe('recherche avancée', () => {
  it('indexe une entrée par fiche et par exercice', async () => {
    expect((await entries()).map(e => e.kind)).toEqual(['fiche', 'exercice', 'exercice', 'fiche', 'exercice'])
  })

  it('trouve un mot dans le travail, avec un extrait, sans tenir compte des accents', async () => {
    const found = searchEntries(await entries(), 'theoreme')
    const hit = found.find(r => r.entry.exerciseId === 'b')
    expect(hit?.where).toBe('Travail')
    expect(hit?.snippet).toContain('théorème')
  })

  it('trouve les notes, les réponses et les fiches par leur titre', async () => {
    const all = await entries()
    expect(searchEntries(all, 'réciproque').map(r => r.entry.exerciseId)).toContain('c')
    expect(searchEntries(all, 'Thalès').some(r => r.entry.kind === 'fiche')).toBe(true)
  })

  it('restreint aux fiches, aux exercices ou à un chapitre', async () => {
    const all = await entries()
    expect(searchEntries(all, 'Thalès', 'fiche').every(r => r.entry.kind === 'fiche')).toBe(true)
    expect(searchEntries(all, 'Thalès', 'exercice').every(r => r.entry.kind === 'exercice')).toBe(true)
    expect(searchEntries(all, 'fractions', 'tout', 'Géométrie')).toEqual([])
  })

  it('ne répond rien à une requête vide', async () => {
    expect(searchEntries(await entries(), '  ')).toEqual([])
  })
})
