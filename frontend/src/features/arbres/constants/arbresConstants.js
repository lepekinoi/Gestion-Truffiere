/**
 * Statuts possibles pour un arbre
 */
export const ARBRE_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DEAD: 'DEAD',
};

/**
 * Types d'arbres supportés
 */
export const ARBRE_TYPES = {
  TRUFFLE: 'TRUFFIER',
  OAK: 'CHÊONE',
  HAZEL: 'NOISETIER',
  PINE: 'PIN',
};

/**
 * Âges pour les filtres
 */
export const ARBRE_AGE_RANGES = {
  YOUNG: { min: 0, max: 5, label: 'Jeune (0-5 ans)' },
  ADULT: { min: 5, max: 20, label: 'Adulte (5-20 ans)' },
  MATURE: { min: 20, max: 50, label: 'Müar (20-50 ans)' },
  OLD: { min: 50, max: 1000, label: 'Ancient (50+ ans)' },
};

/**
 * Messages d'erreur
 */
export const ARBRE_ERRORS = {
  NOT_FOUND: 'Arbre non trouvé',
  INVALID_DATA: 'Données invalides',
  CREATE_FAILED: 'Échec de la création de l\'arbre',
  UPDATE_FAILED: 'Échec de la modification de l\'arbre',
  DELETE_FAILED: 'Échec de la suppression de l\'arbre',
  FETCH_FAILED: 'Échec du chargement des arbres',
};

/**
 * Messages de succès
 */
export const ARBRE_SUCCESS = {
  CREATED: 'Arbre créé avec succès',
  UPDATED: 'Arbre modifié avec succès',
  DELETED: 'Arbre supprimé avec succès',
};

/**
 * Valeurs par défaut pour les formulaires
 */
export const ARBRE_DEFAULT_VALUES = {
  nom: '',
  type: ARBRE_TYPES.TRUFFLE,
  status: ARBRE_STATUS.ACTIVE,
  age: 0,
  localisation: '',
  notes: '',
};
