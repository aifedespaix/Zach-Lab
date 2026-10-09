import type { CSSProperties } from 'react'

/** A position on the mark's 128 × 128 grid. */
export type MarkPoint = readonly [x: number, y: number]

/** What makes one app's mark different from another's: its shape and its colours. */
export interface MarkConfig {
  /** The four dots, in the order they are drawn. */
  points: readonly [MarkPoint, MarkPoint, MarkPoint, MarkPoint]
  /** One colour per dot. */
  colors: readonly [string, string, string, string]
  /** The strokes joining the dots (up to three), in the order they are drawn; each a polyline of grid points. */
  segments: readonly (readonly MarkPoint[])[]
  /**
   * Where dots 2, 3 and 4 slide in from. Defaults to the dot drawn just before:
   * give it when the pen passes elsewhere (the valley of an « M »).
   */
  origins?: readonly [MarkPoint, MarkPoint, MarkPoint]
}

export interface AnimatedMarkProps {
  mark: MarkConfig
  /**
   * `draw-fade`: drawn once, held, faded out, restarted — reads as « loading ».
   * `draw-pulse`: drawn once, then breathes gently, no restart — reads as « waiting »
   * (an empty screen).
   */
  mode: 'draw-fade' | 'draw-pulse'
  size?: number
}

const RADIUS = 20

/**
 * An app's mark — four dots joined by up to three strokes — animated as if drawn by hand: each
 * stroke is written in turn and each dot slides in from where the pen was.
 *
 * The motion lives in `theme.css` (`.animated-mark*`); only the shape and the colours come from
 * the app, so every app of the suite breathes the same way. `prefers-reduced-motion` shows the
 * finished mark, still.
 */
export function AnimatedMark({ mark, mode, size = 96 }: AnimatedMarkProps) {
  const { points, colors, segments, origins } = mark
  return (
    <svg className={`animated-mark animated-mark--${mode}`} viewBox="0 0 128 128" width={size} height={size} aria-hidden="true">
      {/* `pathLength` brings every stroke to 80: one `stroke-dasharray` draws them all. */}
      {segments.slice(0, 3).map((segment, index) => (
        <polyline
          key={index}
          className={`animated-mark-seg animated-mark-seg--${index + 1}`}
          pathLength="80"
          points={segment.map(([x, y]) => `${x},${y}`).join(' ')}
        />
      ))}
      {points.map(([x, y], index) => {
        const from = index === 0 ? undefined : (origins?.[index - 1] ?? points[index - 1])
        const style =
          from === undefined ? undefined : ({ '--from-x': from[0] - x, '--from-y': from[1] - y } as CSSProperties)
        return (
          <circle
            key={index}
            className={`animated-mark-dot animated-mark-dot--${index + 1}`}
            cx={x}
            cy={y}
            r={RADIUS}
            fill={colors[index]}
            style={style}
          />
        )
      })}
    </svg>
  )
}
