/** Version du format d'un fichier d'exercice ; à incrémenter si le format casse. */
export const EXERCISE_VERSION = 1

/**
 * Un exercice, tel qu'il est écrit dans son fichier `.json`.
 *
 * Les blocs de travail et la réponse sont de simples valeurs JSON ici : leur
 * forme précise est celle des lots suivants, et `validateExercise` conserve ce
 * qu'il ne connaît pas pour ne rien perdre en passant d'une version à l'autre.
 */
export interface Exercise {
  version: number
  id: string
  titre: string
  question: string
  page: string
  blocs: unknown[]
  reponse: string
}

export function newExercise(titre: string): Exercise {
  return { version: EXERCISE_VERSION, id: crypto.randomUUID(), titre, question: '', page: '', blocs: [], reponse: '' }
}

/** Relit un fichier d'exercice ; `null` si ce n'est pas un exercice exploitable. */
export function validateExercise(raw: unknown): Exercise | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.titre !== 'string' || typeof r.id !== 'string') return null
  if (typeof r.version !== 'number' || r.version > EXERCISE_VERSION) return null
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  return {
    version: r.version,
    id: r.id,
    titre: r.titre,
    question: text(r.question),
    page: text(r.page),
    blocs: Array.isArray(r.blocs) ? r.blocs : [],
    reponse: text(r.reponse),
  }
}

/** Un nœud de l'arborescence affichée : un chapitre (dossier) et ses exercices. */
export interface ExerciseEntry {
  /** Chemin relatif à la racine, ex. `Fractions/exo-1.json`. */
  path: string
  titre: string
  /** `true` quand le fichier est illisible : il reste visible, mais ne s'ouvre pas. */
  corrompu: boolean
}

export interface ChapterNode {
  /** Nom du dossier, aussi son identifiant. */
  name: string
  exercises: ExerciseEntry[]
}
