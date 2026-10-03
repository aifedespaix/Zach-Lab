# Suite éducative

Des logiciels éducatifs de bureau (Tauri + React + TypeScript) qui partagent une
même base : mise à jour automatique, coquille d'interface, charte graphique,
palette de commandes, raccourcis clavier, recherche plein texte.

| | |
|---|---|
| `apps/zachart-mentale` | **Zachar’t Mentale** — cartes mentales pour élèves, avec synchronisation et administration web |
| `apps/base` | Coquille vide qui fonctionne : le point de départ de chaque nouveau logiciel |
| `packages/shared` | `@suite/shared` — le code React commun ([README](packages/shared/README.md)) |
| `crates/suite-tauri` | le socle Rust commun (plugins, ouverture de fichiers, taille de fenêtre) |

## Démarrer

```bash
bun install
bun run --filter zachart-mentale tauri dev   # ou : --filter base
bun run test                                  # toutes les suites
```

Il faut [Bun](https://bun.sh), [Rust](https://rustup.rs) et les prérequis
[Tauri](https://tauri.app/start/prerequisites/) de la plateforme.

## Créer un nouveau logiciel

```bash
bun run new-app maths          # copie apps/base dans apps/maths, renomme tout
bun install
bun run --filter maths tauri dev
```

## Télécharger

Dernière version de chaque logiciel (Windows), le lien ne change jamais :

| Logiciel | Installeur |
|---|---|
| Zachar’t Mentale | [Zachart-Mentale-setup.exe](https://github.com/aifedespaix/Zachar-t-Mentale/releases/download/updater-zachart/Zachart-Mentale-setup.exe) |
| Zach'Math | [Zachart-Maths-setup.exe](https://github.com/aifedespaix/Zachar-t-Mentale/releases/download/updater-zachart-maths/Zachart-Maths-setup.exe) |
| Base (gabarit) | [Base-setup.exe](https://github.com/aifedespaix/Zachar-t-Mentale/releases/download/updater-base/Base-setup.exe) |

## Publier

Une version, un tag et une release **par app** : voir [docs/RELEASE.md](docs/RELEASE.md).

## Éditeur conseillé

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
