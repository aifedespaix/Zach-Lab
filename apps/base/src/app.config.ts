import { defineApp } from '@suite/shared/app'
// The command catalogue registers itself on import: the frame needs it before it mounts.
import './commands'

/**
 * What differs between this app and another, besides the work area: its id (the prefix of its
 * storage keys), its name, its mark, and what it adds to the standard settings. Rename `id` and
 * `name`, draw your own mark (four dots, up to three strokes, on a 128 × 128 grid).
 */
export const app = defineApp({
  id: 'base',
  name: 'Base',
  mark: {
    points: [
      [36, 36],
      [92, 36],
      [36, 92],
      [92, 92],
    ],
    colors: ['#EF4444', '#F97316', '#3B82F6', '#EAB308'],
    segments: [
      [[36, 36], [92, 36]],
      [[92, 36], [36, 92]],
      [[36, 92], [92, 92]],
    ],
  },
})
