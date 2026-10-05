import { summarizeSheet } from './correction'
import { useOpenExercise } from './useOpenExercise'

/** Ce que dit la bande de l'arborescence rangée : la fiche ouverte, puis où en est sa correction. */
export function TreeRailLabel() {
  const sheet = useOpenExercise(s => s.sheet)
  if (sheet === null) return <>Arborescence</>

  const { corriges, aRevoir, aCorriger } = summarizeSheet(sheet)
  const counts = [
    corriges > 0 && `${corriges} corrigé${corriges > 1 ? 's' : ''}`,
    aRevoir > 0 && `${aRevoir} à revoir`,
    aCorriger > 0 && `${aCorriger} à corriger`,
  ].filter(Boolean)

  return (
    <>
      <strong style={{ fontWeight: 600 }}>{sheet.titre}</strong>
      {counts.length > 0 && <span style={{ opacity: 0.7 }}> · {counts.join(' · ')}</span>}
    </>
  )
}
