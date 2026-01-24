/**
 * Formate le nom d'un arbre pour l'affichage
 */
export const formatArbreName = (arbre) => {
  return arbre?.nom || `Arbre ${arbre?.id || 'Inconnu'}`;
};

/**
 * Formate le type d'un arbre en texte lisible
 */
export const formatArbreType = (type) => {
  const typeMap = {
    TRUFFIER: 'Truffier',
    CHÊONE: 'Chêne',
    NOISETIER: 'Noisetier',
    PIN: 'Pin',
  };
  return typeMap[type] || type;
};

/**
 * Formate le statut d'un arbre en texte lisible
 */
export const formatArbreStatus = (status) => {
  const statusMap = {
    ACTIVE: 'Actif',
    INACTIVE: 'Inactif',
    DEAD: 'Mort',
  };
  return statusMap[status] || status;
};

/**
 * Formate l'âge d'un arbre avec unité
 */
export const formatArbreAge = (age) => {
  if (!age && age !== 0) return 'Inconnu';
  return `${age} an${age > 1 ? 's' : ''}`;
};

/**
 * Formate une liste d'arbres pour l'affichage
 */
export const formatArbresForDisplay = (arbres) => {
  return arbres?.map(arbre => ({
    ...arbre,
    displayName: formatArbreName(arbre),
    displayType: formatArbreType(arbre.type),
    displayStatus: formatArbreStatus(arbre.status),
    displayAge: formatArbreAge(arbre.age),
  })) || [];
};

/**
 * Formate les coordonnées GPS
 */
export const formatGPS = (latitude, longitude) => {
  if (!latitude || !longitude) return 'Non disponible';
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
};

/**
 * Formate une date
 */
export const formatDate = (date) => {
  if (!date) return 'Non disponible';
  try {
    return new Date(date).toLocaleDateString('fr-FR');
  } catch {
    return 'Date invalide';
  }
};
