export interface ComboboxOption<T extends string = string> {
  value: T
  label: string
  /** Grey secondary text; for a folder, its full path (searched too). */
  detail?: string
  /** Nesting level, used to indent the option while the filter is empty. */
  depth?: number
}

/** No accents, no case, no surrounding spaces: « geo » finds « Géométrie ». */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/**
 * The options whose label or detail (the full path of a folder) contains the
 * query as a substring — « 3e/géo » finds `Collège/3e/Géométrie`. An empty
 * query keeps everything, in order.
 */
export function filterOptions<T extends string>(options: ComboboxOption<T>[], query: string): ComboboxOption<T>[] {
  const needle = foldText(query)
  if (needle === '') return options
  return options.filter(
    option => foldText(option.label).includes(needle) || (option.detail !== undefined && foldText(option.detail).includes(needle)),
  )
}
