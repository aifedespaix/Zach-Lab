import { useEffect, useState } from 'react'
import { Button } from '@/ui/primitives'

/**
 * Action destructrice en deux temps : le premier clic arme le bouton 4 s, le second
 * exécute. Remplace `confirm()`, qui bloque le fil, est ignoré par certains
 * navigateurs mobiles et ne se teste pas.
 */
export function TwoStepButton({ label, confirmLabel = 'Confirmer', onConfirm, disabled, title }: {
  label: string; confirmLabel?: string; onConfirm: () => void; disabled?: boolean; title?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    // Sans ce délai, un clic oublié armerait la suppression pour un clic accidentel bien plus tard.
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])
  return (
    <Button tone="danger" disabled={disabled} title={title}
      onClick={() => { if (armed) { setArmed(false); onConfirm() } else setArmed(true) }}>
      {armed ? confirmLabel : label}
    </Button>
  )
}
