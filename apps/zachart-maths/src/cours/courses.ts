/** Un cours : un fichier Markdown de `cours/contenu`, compilé avec l'app. */
export interface Course {
  /** Nom du fichier sans extension. */
  id: string
  titre: string
  /** Le chapitre auquel il se rattache, comparé au nom du chapitre de l'élève pour suggérer. */
  chapitre: string
  motsCles: string[]
  /** Le texte Markdown, sans l'en-tête. */
  corps: string
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

/**
 * Lit un fichier de cours : un en-tête `clé: valeur` entre deux lignes `---`, puis le Markdown.
 * Retourne `null` sans titre : un cours sans titre ne saurait ni se lister ni se chercher.
 */
export function parseCourse(id: string, raw: string): Course | null {
  const match = FRONT_MATTER.exec(raw.replace(/^﻿/, ''))
  if (match === null) return null
  const meta = new Map<string, string>()
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon > 0) meta.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim())
  }
  const titre = meta.get('titre')
  if (titre === undefined || titre === '') return null
  return {
    id,
    titre,
    chapitre: meta.get('chapitre') ?? '',
    motsCles: (meta.get('mots-cles') ?? '').split(',').map(k => k.trim()).filter(k => k !== ''),
    corps: match[2].trim(),
  }
}

/** Tous les cours d'un lot de fichiers (`chemin → texte`), par chapitre puis par titre. */
export function loadCourses(files: Readonly<Record<string, string>>): Course[] {
  const courses: Course[] = []
  for (const [path, raw] of Object.entries(files)) {
    const course = parseCourse(path.replace(/^.*[\\/]/, '').replace(/\.md$/, ''), raw)
    if (course !== null) courses.push(course)
  }
  return courses.sort((a, b) => a.chapitre.localeCompare(b.chapitre, 'fr') || a.titre.localeCompare(b.titre, 'fr'))
}

/** Les cours compilés avec le dépôt : ajouter un cours, c'est ajouter un fichier dans `contenu/`. */
export const COURSES: readonly Course[] = loadCourses(
  import.meta.glob<string>('./contenu/*.md', { query: '?raw', import: 'default', eager: true }),
)
