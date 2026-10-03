import { createContext } from 'react'
import type { SymbolEntry } from './toolbarCatalog'

/** Insère un signe dans le dernier champ où l'élève a écrit : c'est `insertSymbol` du workspace, offert au clic droit. */
export const SymbolInsertContext = createContext<((symbol: SymbolEntry) => void) | null>(null)
