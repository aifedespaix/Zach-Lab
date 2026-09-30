# @suite/shared

Le code React que toutes les apps de la suite réutilisent. Il est consommé en
TypeScript brut (pas d'étape de build) : Vite le compile avec l'app, le rechargement
à chaud fonctionne dedans.

| Sous-chemin | Contenu |
|---|---|
| `@suite/shared/ui` | primitives shadcn/Radix (`Button`, `Dialog`, `Tooltip`…) |
| `@suite/shared/theme` + `theme.css` | jetons de couleur, polices, mode clair/sombre/système, transition circulaire |
| `@suite/shared/shell` | `AppShell`, `ResizablePanel`, `usePanelResize`, `BootScreen` |
| `@suite/shared/commands` | catalogue de commandes, registre, raccourcis, palette, `useGlobalShortcuts` |
| `@suite/shared/settings` | `SettingsDialog` (onglets, aperçu en direct, annuler/enregistrer), panneau des raccourcis |
| `@suite/shared/update` | `useAppUpdater`, `UpdateReadyBanner` |
| `@suite/shared/search` | recherche plein texte Orama en français |

## La règle

**Rien ici n'importe une app** — ni `@/…`, ni `@app`, ni un chemin relatif qui sort
de `packages/shared/src`. `src/boundary.test.ts` la fait respecter. Une app apporte
ce qui est à elle par des props, des slots, des options, ou en l'enregistrant :

- ses commandes : `defineCommandCatalog({ categories, commands })` (voir `apps/base/src/commands.ts`) ;
- ses panneaux de paramètres et les stores qu'ils modifient : `SettingsDialog panels sources` ;
- son contexte « suspendu » (un quiz) et sa surface de travail : `useGlobalShortcuts({ isSuspended, canvasSelector })` ;
- son classement des commandes, si le défaut ne lui convient pas : `CommandPalette rank`.

Dans le package, les imports sont **relatifs** ; on n'importe jamais un fichier
interne d'un sous-chemin depuis une app.

## Brancher le package dans une app

```css
/* src/index.css */
@import "tailwindcss";
@import "@suite/shared/theme.css";
/* Tailwind 4 ne scanne pas un package hors de l'app : sans cette ligne, les
   composants partagés s'affichent sans leurs classes. */
@source "../../../packages/shared/src";
```

Et dans le `Cargo.toml` de l'app, les plugins Tauri dont sa capability utilise les
permissions doivent être déclarés **directement** (voir `apps/base/src-tauri/Cargo.toml`).

## Ajouter un composant partagé

`components.json` écrit encore dans l'app. Génère le composant là-bas, puis :

```bash
git mv apps/<app>/src/components/ui/x.tsx packages/shared/src/ui/x.tsx
bun scripts/move-module.mjs apps/<app> components/ui/x @suite/shared/ui
```

Ajoute-le au barrel du sous-chemin (`src/ui/index.ts`), remplace `@/lib/utils` par
`../lib/utils`, et déplace son test avec lui.

## La recherche

```ts
import { createSearchIndex, loadSearchIndex } from '@suite/shared/search'

const index = createSearchIndex(['title', 'body'])
index.add({ id: 'a', title: 'Les fractions', body: '…' })
index.search('fractoins', { boost: { title: 3 } }) // [{ id: 'a', score }]

// Un index précompilé (les cours d'une app, livrés avec elle) :
const shipped = loadSearchIndex(['title', 'body'], index.serialize())
```

Accents, pluriels et conjugaisons (radical français), fautes de frappe (dosées
selon la longueur du mot). Une requête sans mot ne renvoie rien. Un index
sérialisé illisible, d'une autre version ou bâti sur d'autres champs donne un
index vide utilisable, jamais une exception au démarrage.
