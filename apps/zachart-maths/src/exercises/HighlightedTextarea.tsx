import { createContext, useContext, type ComponentProps, type ReactNode } from 'react'
import { findQuantities } from './quantities'
import { toneOf } from './toolbarCatalog'
import { useUnitColors } from './useUnitColors'

/**
 * La teinte de chaque unité de l'exercice ouvert (voir `assignHues`), fournie par l'espace de
 * travail. Vide hors d'un exercice : rien n'est coloré.
 */
export const UnitHuesContext = createContext<ReadonlyMap<string, number>>(new Map())

/** Le texte découpé : les grandeurs dans un `<mark>`, le reste tel quel. */
function marked(text: string, hues: ReadonlyMap<string, number>): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const quantity of findQuantities(text)) {
    const hue = hues.get(quantity.unit)
    if (hue === undefined) continue
    if (quantity.start > cursor) nodes.push(text.slice(cursor, quantity.start))
    nodes.push(
      // Aucune métrique ajoutée (ni padding, ni bordure, ni marge) : le texte du miroir doit
      // rester exactement sous celui du champ. `color` explicite : la feuille de style du
      // navigateur donne du noir à `mark`, qui doublerait le texte du champ.
      <mark
        key={quantity.start}
        data-unit={quantity.unit}
        style={{ background: toneOf(hue), color: 'transparent', borderRadius: 3 }}
      >
        {text.slice(quantity.start, quantity.end)}
      </mark>,
    )
    cursor = quantity.end
  }
  nodes.push(text.slice(cursor))
  // Un saut de ligne final n'a pas de hauteur dans un bloc : sans ce caractère de largeur nulle,
  // le miroir serait plus court d'une ligne que le champ.
  if (text.endsWith('\n')) nodes.push('​')
  return nodes
}

/**
 * Un `<textarea>` dont les grandeurs (`16 km`, `3 km/h`) sont colorées PENDANT la saisie.
 *
 * Un `<textarea>` ne colore pas une partie de son texte. Le texte est donc reproduit derrière lui,
 * dans un calque aux métriques identiques (même `className`, même `white-space`), où seuls les
 * fonds des `<mark>` se voient ; le champ, transparent, est posé par-dessus. Les champs de l'app
 * s'agrandissent déjà à leur contenu (`rows`), donc il n'y a pas de défilement à synchroniser.
 *
 * L'arbre ne dépend que du réglage, jamais de la présence de teintes : si la forme changeait au
 * moment où la première unité est tapée, React remonterait le champ et le curseur sauterait.
 */
export function HighlightedTextarea({ className, style, ref, ...props }: ComponentProps<'textarea'>) {
  const enabled = useUnitColors(state => state.enabled)
  const hues = useContext(UnitHuesContext)
  if (!enabled) return <textarea ref={ref} className={className} style={style} {...props} />
  const text = typeof props.value === 'string' ? props.value : ''
  return (
    <div style={{ position: 'relative', width: '100%', minWidth: 0, background: 'var(--background)', borderRadius: 4 }}>
      <div
        aria-hidden
        data-unit-mirror
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          background: 'transparent',
          borderColor: 'transparent',
          color: 'transparent',
        }}
      >
        {marked(text, hues)}
      </div>
      <textarea
        ref={ref}
        className={className}
        style={{ ...style, position: 'relative', display: 'block', background: 'transparent' }}
        {...props}
      />
    </div>
  )
}
