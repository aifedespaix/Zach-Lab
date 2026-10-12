/**
 * Attribut posé sur la zone qu'une app veut imprimer. Sans elle, la page entière part à l'impression.
 * La feuille A4 et la mise en page d'impression sont dans `theme.css` (`@page`, `@media print`).
 */
export const PRINT_AREA_ATTRIBUTE = 'data-print-area'

/**
 * Ouvre la boîte d'impression du système, sur la zone marquée `data-print-area` (ou toute la page). Dans
 * la webview Tauri, « Microsoft Print to PDF » donne le PDF. Sans effet si la boîte n'est pas disponible.
 */
export function printPage(): void {
  try {
    window.print()
  } catch {
    // Pas de boîte d'impression dans cet environnement (page de test, navigateur sans impression).
  }
}
