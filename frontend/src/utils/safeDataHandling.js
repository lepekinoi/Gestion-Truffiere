/**
 * Utilitaires pour la gestion sécurisée des données
 * Prévient les erreurs courantes : null, undefined, NaN, conversions invalides
 */

/**
 * Parse un nombre de manière sécurisée
 * @param {*} value - La valeur à convertir
 * @param {number} defaultValue - Valeur par défaut si conversion échoue
 * @returns {number} - Nombre converti ou valeur par défaut
 */
export const safeParseFloat = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Parse un entier de manière sécurisée
 * @param {*} value - La valeur à convertir
 * @param {number} defaultValue - Valeur par défaut si conversion échoue
 * @returns {number} - Entier converti ou valeur par défaut
 */
export const safeParseInt = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Formatte une date de manière sécurisée
 * @param {string|Date} dateString - La date à formatter
 * @param {string} locale - Locale à utiliser (défaut: 'fr-FR')
 * @param {object} options - Options de formatage
 * @returns {string} - Date formatée ou '-' si invalide
 */
export const safeFormatDate = (dateString, locale = 'fr-FR', options = {}) => {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    const defaultOptions = { year: 'numeric', month: 'long', day: 'numeric', ...options };
    return date.toLocaleDateString(locale, defaultOptions);
  } catch (error) {
    console.warn('Erreur formatage date:', error);
    return '-';
  }
};

/**
 * Formate une date courte de manière sécurisée
 * @param {string|Date} dateString - La date à formatter
 * @param {string} locale - Locale à utiliser (défaut: 'fr-FR')
 * @returns {string} - Date courte formatée ou '-'
 */
export const safeFormatDateShort = (dateString, locale = 'fr-FR') => {
  return safeFormatDate(dateString, locale, { day: 'numeric', month: 'short' });
};

/**
 * Safely gets a nested property from an object
 * @param {object} obj - L'objet à explorer
 * @param {string} path - Chemin pointé (ex: 'data.user.name')
 * @param {*} defaultValue - Valeur par défaut
 * @returns {*} - La valeur trouvée ou la valeur par défaut
 */
export const safeGet = (obj, path, defaultValue = null) => {
  if (!obj || !path) return defaultValue;
  
  try {
    const value = path.split('.').reduce((acc, part) => acc?.[part], obj);
    return value !== undefined ? value : defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

/**
 * Retourne un array sécurisé (jamais null ou undefined)
 * @param {*} value - La valeur à convertir
 * @returns {array} - Array ou array vide
 */
export const safeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

/**
 * Retourne un objet sécurisé (jamais null ou undefined)
 * @param {*} value - La valeur à convertir
 * @returns {object} - Object ou objet vide
 */
export const safeObject = (value) => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

/**
 * Vérifie si une valeur est un nombre valide
 * @param {*} value - La valeur à vérifier
 * @returns {boolean} - True si valide
 */
export const isValidNumber = (value) => {
  const parsed = parseFloat(value);
  return !isNaN(parsed) && isFinite(parsed);
};

/**
 * Divise deux nombres de manière sécurisée (protégé contre division par zéro)
 * @param {number} dividend - Dividende
 * @param {number} divisor - Diviseur
 * @param {number} defaultValue - Valeur si division par zéro
 * @returns {number} - Résultat
 */
export const safeDivide = (dividend, divisor, defaultValue = 0) => {
  const num = safeParseFloat(dividend);
  const denom = safeParseFloat(divisor);
  
  if (denom === 0) return defaultValue;
  return num / denom;
};

/**
 * Formate un poids en grammes/kg de manière sécurisée
 * @param {number} grammes - Poids en grammes
 * @param {number} decimals - Nombre de décimales
 * @returns {string} - Poids formaté avec unité
 */
export const formatWeight = (grammes, decimals = 2) => {
  const grams = safeParseFloat(grammes);
  
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(decimals)} kg`;
  }
  return `${grams.toFixed(0)} g`;
};

/**
 * Formate une devise de manière sécurisée
 * @param {number} amount - Montant
 * @param {string} currency - Code devise (défaut: 'EUR')
 * @param {string} locale - Locale (défaut: 'fr-FR')
 * @returns {string} - Montant formaté
 */
export const formatCurrency = (amount, currency = 'EUR', locale = 'fr-FR') => {
  const num = safeParseFloat(amount);
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(num);
  } catch (error) {
    return `${num.toFixed(2)} €`;
  }
};

/**
 * Récupère la première erreur d'un objet error
 * @param {Error|object|string} error - L'erreur
 * @returns {string} - Message d'erreur
 */
export const getErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.response?.statusText) return error.response.statusText;
  return 'Une erreur inconnue s\'est produite';
};
