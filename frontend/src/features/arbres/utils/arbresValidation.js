/**
 * Valide les données d'un arbre
 * @param {Object} arbre - L'objet arbre à valider
 * @returns {Object} { isValid, errors }
 */
export const validateArbre = (arbre) => {
  const errors = {};

  // Vérification du nom
  if (!arbre.nom || arbre.nom.trim() === '') {
    errors.nom = 'Le nom de l\'arbre est obligatoire';
  } else if (arbre.nom.length < 2) {
    errors.nom = 'Le nom doit contenir au moins 2 caractères';
  } else if (arbre.nom.length > 100) {
    errors.nom = 'Le nom ne peut pas dépasser 100 caractères';
  }

  // Vérification du type
  if (!arbre.type) {
    errors.type = 'Le type est obligatoire';
  }

  // Vérification de l'âge
  if (arbre.age !== undefined && arbre.age !== null) {
    if (isNaN(arbre.age) || arbre.age < 0) {
      errors.age = 'L\'\u00e2ge doit être un nombre positif';
    } else if (arbre.age > 500) {
      errors.age = 'L\'\u00e2ge ne peut pas dépasser 500 ans';
    }
  }

  // Vérification de la localisation
  if (arbre.localisation && arbre.localisation.length > 200) {
    errors.localisation = 'La localisation ne peut pas dépasser 200 caractères';
  }

  // Vérification des notes
  if (arbre.notes && arbre.notes.length > 1000) {
    errors.notes = 'Les notes ne peuvent pas dépasser 1000 caractères';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Vérifie si les champs requis sont complets
 */
export const isArbreComplete = (arbre) => {
  return arbre.nom && arbre.type;
};

/**
 * Valide une localisation GPS
 */
export const validateGPS = (latitude, longitude) => {
  if (latitude === undefined || longitude === undefined) {
    return { isValid: false, error: 'Latitude et longitude sont obligatoires' };
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lon)) {
    return { isValid: false, error: 'Les coordonnées doivent être numériques' };
  }

  if (lat < -90 || lat > 90) {
    return { isValid: false, error: 'La latitude doit être entre -90 et 90' };
  }

  if (lon < -180 || lon > 180) {
    return { isValid: false, error: 'La longitude doit être entre -180 et 180' };
  }

  return { isValid: true };
};
