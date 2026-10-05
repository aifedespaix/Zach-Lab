/** Version du format d'un fichier ; à incrémenter si le format casse. */
export const SHEET_VERSION = 2

/**
 * Un exercice d'une fiche.
 *
 * Les blocs de travail sont de simples valeurs JSON ici : leur forme précise est celle de
 * `blocks.ts`. Les champs qu'on ne connaît pas (écrits par une version plus récente) sont
 * conservés tels quels à la lecture, pour ne rien perdre en passant d'une version à l'autre.
 */
export interface Exercise {
  id: string
  /** Texte libre (« 3.b ») ; vide, l'exercice s'affiche par sa position dans la fiche. */
  numero: string
  /** La question posée, en toutes lettres. */
  enonce: string
  page: string
  blocs: unknown[]
  /**
   * La seconde zone de travail, à droite. Présent (même vide) : l'exercice est scindé en deux
   * zones indépendantes ; absent : une seule zone. Les fiches écrites avant ce champ n'en ont pas.
   */
  blocsB?: unknown[]
  reponse: string
  /** Marqué corrigé par l'élève ; absent (jamais écrit à `false`) tant qu'il ne l'a pas fait. */
  corrige?: boolean
  /** Les notes libres prises à côté de l'exercice (sidebar droite). */
  notes: string
}

/** Un fichier : une fiche (une feuille de manuel) et ses exercices. */
export interface Sheet {
  version: number
  id: string
  titre: string
  /** Jamais vide : une fiche a toujours au moins un exercice. */
  exercices: Exercise[]
}

export function newExercise(): Exercise {
  return { id: crypto.randomUUID(), numero: '', enonce: '', page: '', blocs: [], reponse: '', notes: '' }
}

export function newSheet(titre: string): Sheet {
  return { version: SHEET_VERSION, id: crypto.randomUUID(), titre, exercices: [newExercise()] }
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')

/** Chaque bloc a un identifiant : sans lui, on ne pourrait ni le déplacer ni l'envoyer dans l'autre zone. */
const withIds = (blocs: unknown[]): unknown[] =>
  blocs.map(b => {
    if (typeof b !== 'object' || b === null || Array.isArray(b)) return b
    const id = (b as { id?: unknown }).id
    return typeof id === 'string' && id !== '' ? b : { ...b, id: crypto.randomUUID() }
  })

function normalizeExercise(raw: unknown, seen: Set<string>): Exercise | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  let id = typeof r.id === 'string' && r.id !== '' ? r.id : crypto.randomUUID()
  if (seen.has(id)) id = crypto.randomUUID()
  seen.add(id)
  // `...r` d'abord : les champs inconnus passent, les champs connus sont ensuite normalisés.
  const exercise: Exercise = {
    ...r,
    id,
    numero: text(r.numero),
    enonce: text(r.enonce),
    page: text(r.page),
    blocs: Array.isArray(r.blocs) ? withIds(r.blocs) : [],
    reponse: text(r.reponse),
    notes: text(r.notes),
  }
  // `...r` a laissé passer un `blocsB` qui n'est peut-être pas un tableau : seul un tableau compte.
  if (Array.isArray(r.blocsB)) exercise.blocsB = withIds(r.blocsB)
  else delete exercise.blocsB
  if (r.corrige === true) exercise.corrige = true
  else delete exercise.corrige
  return exercise
}

/**
 * Relit un fichier ; `null` si ce n'est pas une fiche exploitable.
 *
 * Un fichier v1 (un exercice à plat, `question` pour le numéro) est lu comme une fiche à un
 * exercice. Rien n'est écrit ici : le fichier ne passe en v2 qu'à la première modification.
 */
export function validateSheet(raw: unknown): Sheet | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.titre !== 'string' || typeof r.id !== 'string') return null
  if (typeof r.version !== 'number' || r.version > SHEET_VERSION) return null

  if (r.version < 2) {
    const exercice: Exercise = {
      id: crypto.randomUUID(),
      numero: text(r.question),
      enonce: text(r.enonce),
      page: text(r.page),
      blocs: Array.isArray(r.blocs) ? r.blocs : [],
      reponse: text(r.reponse),
      notes: text(r.notes),
    }
    return { version: SHEET_VERSION, id: r.id, titre: r.titre, exercices: [exercice] }
  }

  const seen = new Set<string>()
  const exercices = (Array.isArray(r.exercices) ? r.exercices : []).flatMap(item => {
    const exercise = normalizeExercise(item, seen)
    return exercise === null ? [] : [exercise]
  })
  return { version: SHEET_VERSION, id: r.id, titre: r.titre, exercices: exercices.length > 0 ? exercices : [newExercise()] }
}

/** Un nœud de l'arborescence affichée : un chapitre (dossier) et ses fichiers. */
export interface ExerciseEntry {
  /** Chemin relatif à la racine, ex. `Fractions/exo-1.json`. */
  path: string
  titre: string
  /** Nombre d'exercices de la fiche (0 pour un fichier illisible). */
  exercices: number
  /** Exercices commencés et pas encore marqués corrigés (0 pour un fichier illisible). */
  aCorriger: number
  /** `true` quand le fichier est illisible : il reste visible, mais ne s'ouvre pas. */
  corrompu: boolean
}

export interface ChapterNode {
  /** Nom du dossier, aussi son identifiant. */
  name: string
  exercises: ExerciseEntry[]
}
