import { useRef } from 'react'
import type { CalcBlock } from './blocks'
import { BOX, LEFT_TONE, SOLVED_TONE } from './eqTones'

/**
 * Le bloc Calcul : `expression = résultat`, deux cases colorées. Entrée passe de l'expression au
 * résultat, puis demande le bloc suivant (`onDone`).
 */
export function CalcEditor({ block, onChange, onDone }: {
  block: CalcBlock
  onChange: (patch: Partial<CalcBlock>) => void
  onDone: () => void
}) {
  const result = useRef<HTMLInputElement>(null)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        aria-label="Calcul"
        value={block.expression}
        onChange={e => onChange({ expression: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); result.current?.focus() } }}
        className="flex-1 font-mono text-sm"
        style={{ ...BOX, ...LEFT_TONE, minWidth: 0 }}
      />
      <span aria-hidden>=</span>
      <input
        ref={result}
        aria-label="Résultat du calcul"
        value={block.resultat}
        onChange={e => onChange({ resultat: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onDone() } }}
        className="font-mono text-sm"
        style={{ ...BOX, ...SOLVED_TONE, width: 130 }}
      />
    </div>
  )
}
