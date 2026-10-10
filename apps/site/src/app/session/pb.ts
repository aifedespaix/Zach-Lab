import PocketBase from 'pocketbase'

/**
 * Le client PocketBase du site. L'URL est celle de la page : le site est servi
 * par le serveur qu'il appelle (même origine, aucun CORS). La session vit dans
 * le `localStorage` du SDK (clé `pocketbase_auth`), partagée par toutes les
 * pages du site.
 *
 * La bibliothèque ré-exporte ce client (`bibliotheque/lib/pb.ts`) : une seule
 * instance, donc pas de désynchronisation du jeton.
 */
export const pb = new PocketBase(window.location.origin)
