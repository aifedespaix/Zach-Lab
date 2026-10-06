import { all, create } from 'mathjs/number'

/**
 * Le moteur de la calculatrice : mathjs (version « nombres » seulement, la plus légère), pas un
 * évaluateur maison. Les fonctions qui modifient le moteur ou évaluent du texte sont neutralisées,
 * comme le recommande mathjs pour une entrée saisie par l'utilisateur.
 */
const math = create(all)
const evaluate = math.evaluate.bind(math)
math.import(
  {
    import: forbidden('import'),
    createUnit: forbidden('createUnit'),
    reviver: forbidden('reviver'),
    evaluate: forbidden('evaluate'),
    parse: forbidden('parse'),
    simplify: forbidden('simplify'),
    derivative: forbidden('derivative'),
    resolve: forbidden('resolve'),
  },
  { override: true },
)

function forbidden(name: string) {
  return () => {
    throw new Error(`${name} est désactivé`)
  }
}

/** « Rép » (ou « ans ») : le dernier résultat. Les \b de JS ne connaissent pas « é », d'où les lookarounds. */
const ANS = /(?<!\p{L})(?:ans|rép)(?!\p{L})/giu

export type CalcResult = { ok: true; value: number; text: string } | { ok: false; error: string }

/** « 12,5 × 3 » → « 12.5 * 3 » : ce que l'élève tape (ou lit sur le clavier) devient du mathjs. */
export function normalize(expression: string): string {
  return expression
    .replace(/[×·]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/,/g, '.')
    .replace(/√\s*(\d+(?:\.\d+)?|[a-z]+)/gi, 'sqrt($1)')
    .replace(/√/g, 'sqrt')
    .replace(/π/g, 'pi')
    // « 50 % » veut dire 50/100 pour un élève, pas un reste de division.
    .replace(/(\d+(?:\.\d+)?|\))\s*%/g, '($1/100)')
}

/** 12 chiffres significatifs : 0,1 + 0,2 = 0,3, pas 0,30000000000000004. Virgule décimale, pas d'exposant inutile. */
export function formatNumber(value: number): string {
  if (Object.is(value, -0)) return '0'
  const rounded = Number(value.toPrecision(12))
  const text = Math.abs(rounded) !== 0 && (Math.abs(rounded) >= 1e15 || Math.abs(rounded) < 1e-9)
    ? rounded.toExponential().replace('e+', '×10^').replace('e-', '×10^-')
    : String(rounded)
  return text.replace('.', ',')
}

/** Calcule une expression ; `ans` est la valeur du bouton « Rép ». Ne lève jamais. */
export function calculate(expression: string, ans = 0): CalcResult {
  const source = expression.trim()
  if (source === '') return { ok: false, error: '' }
  try {
    const value = evaluate(normalize(source).replace(ANS, '(ans)'), { ans })
    if (typeof value !== 'number') return { ok: false, error: 'Calcul impossible' }
    if (Number.isNaN(value) || !Number.isFinite(value)) return { ok: false, error: 'Calcul impossible' }
    return { ok: true, value, text: formatNumber(value) }
  } catch {
    return { ok: false, error: 'Calcul incomplet' }
  }
}
