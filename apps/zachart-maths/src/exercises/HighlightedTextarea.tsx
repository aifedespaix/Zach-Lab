import { createContext, useContext, useRef, type ComponentProps, type ReactNode, type UIEvent } from 'react'
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
  if (text.endsWith('\n')) nodes.push('\u200b')
  return nodes
}

/**
 * Un `<textarea>` dont les grandeurs (`16 km`, `3 km/h`) sont colorées PENDANT la saisie.
 *
 * Un `<textarea>` ne colore pas une partie de son texte. Le texte est donc reproduit derrière lui,
 * dans un calque aux métriques identiques (même `className`, même `white-space`), où seuls les
 * fonds des `<mark>` se voient ; le champ, transparent, est posé par-dessus. Le champ grandit avec
 * son texte grâce à `field-sizing: content` (supporté par la webview de l'app), donc il ne défile
 * pas ; en repli, si la propriété manque, `onScroll` recopie le défilement sur le calque.
 *
 * Composant contrôlé uniquement (`value` chaîne ; `defaultValue` n'est pas supporté) ; `style`
 * s'applique au seul `<textarea>`.
 *
 * L'arbre ne dépend que du réglage, jamais de la présence de teintes : si la forme changeait au
 * moment où la première unité est tapée, React remonterait le champ et le curseur sauterait.
 */
export function HighlightedTextarea({ className, style, ref, onScroll, ...props }: ComponentProps<'textarea'>) {
  const mirror = useRef<HTMLDivElement>(null)
  const enabled = useUnitColors(state => state.enabled)
  const hues = useContext(UnitHuesContext)
  if (!enabled) return <textarea ref={ref} className={className} style={style} onScroll={onScroll} {...props} />
  const text = typeof props.value === 'string' ? props.value : ''
  return (
    <div style={{ position: 'relative', width: '100%', minWidth: 0, background: 'var(--background)', borderRadius: 4 }}>
      <div
        ref={mirror}
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
        style={{
          // `field-sizing: content` annule `rows` : on repose le minimum (padding `py-1` = 0.5rem, bordure 2px).
          // Avant `...style`, pour qu'un appelant puisse le surcharger.
          minHeight: `calc(${props.rows ?? 2}lh + 0.5rem + 2px)`,
          ...style,
          position: 'relative',
          display: 'block',
          background: 'transparent',
          // `fieldSizing` manque encore à `CSSProperties` : cast minimal.
          ...({ fieldSizing: 'content' } as object),
          overflowY: 'auto',
          resize: 'none',
        }}
        onScroll={(event: UIEvent<HTMLTextAreaElement>) => {
          if (mirror.current) {
            mirror.current.scrollTop = event.currentTarget.scrollTop
            mirror.current.scrollLeft = event.currentTarget.scrollLeft
          }
          onScroll?.(event)
        }}
        {...props}
      />
    </div>
  )
}
