// Options d'exposition autour de l'arbre
export const EXPOSITIONS = [
  { value: 'Nord', label: '⬆️ Nord', short: 'N' },
  { value: 'Nord-Est', label: '↗️ Nord-Est', short: 'NE' },
  { value: 'Est', label: '➡️ Est', short: 'E' },
  { value: 'Sud-Est', label: '↘️ Sud-Est', short: 'SE' },
  { value: 'Sud', label: '⬇️ Sud', short: 'S' },
  { value: 'Sud-Ouest', label: '↙️ Sud-Ouest', short: 'SO' },
  { value: 'Ouest', label: '⬅️ Ouest', short: 'O' },
  { value: 'Nord-Ouest', label: '↖️ Nord-Ouest', short: 'NO' }
];

// Options de pagination
export const PAGINATION_OPTIONS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 'all', label: 'Tous' }
];

// Configuration des qualités
export const QUALITES_VENDABLES = ['Extra', 'Première catégorie', 'Deuxième catégorie'];
export const QUALITES_NON_VENDABLES = ['Pourrie'];
