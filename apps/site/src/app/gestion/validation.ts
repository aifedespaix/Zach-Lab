// Mêmes règles que l'inscription : le serveur les revérifie, ici on évite l'aller-retour.
const USERNAME = /^[a-zA-Z0-9_.-]{1,64}$/

export function usernameError(username: string): string | null {
  return USERNAME.test(username) ? null : 'Identifiant : 1 à 64 caractères parmi lettres, chiffres, « _ », « . » et « - ».'
}

export function passwordError(password: string): string | null {
  return password.length >= 10 ? null : 'Le mot de passe doit faire au moins 10 caractères.'
}
