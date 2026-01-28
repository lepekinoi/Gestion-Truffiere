// ============================================================
// utils/validation.js
// Fonctions de validation et nettoyage des données
// ============================================================

/**
 * Convertit les valeurs vides en null (pour PostgreSQL)
 * @param {*} value - Valeur à convertir
 * @returns {*|null} Valeur ou null si vide
 */
const emptyToNull = (value) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  
  // Pour les strings, trim puis vérifier si vide
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  
  return value;
};

/**
 * Nettoie une entrée utilisateur (supprime scripts, caractères dangereux)
 * @param {string} input - Entrée à nettoyer
 * @returns {string} Entrée nettoyée
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    // Supprimer les balises HTML
    .replace(/<[^>]*>/g, '')
    // Supprimer les scripts
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    // Supprimer les caractères NULL
    .replace(/\x00/g, '')
    // Limiter les espaces multiples
    .replace(/\s+/g, ' ');
};

/**
 * Valide un format email
 * @param {string} email - Email à valider
 * @returns {boolean} True si valide
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  
  // RFC 5322 simplified regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Valide un numéro de téléphone français
 * @param {string} phone - Téléphone à valider
 * @returns {boolean} True si valide
 */
const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  
  // Retirer tous les caractères non numériques
  const cleaned = phone.replace(/[^0-9+]/g, '');
  
  // Formats acceptés:
  // - 0123456789 (10 chiffres)
  // - +33123456789 (format international)
  // - 0033123456789 (format international alternatif)
  const patterns = [
    /^0[1-9]\d{8}$/,           // Format français standard
    /^\+33[1-9]\d{8}$/,        // Format international
    /^0033[1-9]\d{8}$/         // Format international alternatif
  ];
  
  return patterns.some(pattern => pattern.test(cleaned));
};

/**
 * Valide un numéro SIRET français (14 chiffres + algorithme de Luhn)
 * @param {string} siret - SIRET à valider
 * @returns {boolean} True si valide
 */
const validateSIRET = (siret) => {
  if (!siret || typeof siret !== 'string') return false;
  
  // Retirer les espaces
  const cleaned = siret.replace(/\s/g, '');
  
  // Vérifier le format (14 chiffres)
  if (!/^\d{14}$/.test(cleaned)) return false;
  
  // Algorithme de Luhn (vérification SIRET)
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(cleaned[i]);
    
    // Doubler chaque chiffre de rang pair (en commençant à 0)
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
  }
  
  return sum % 10 === 0;
};

/**
 * Valide un IBAN (International Bank Account Number)
 * @param {string} iban - IBAN à valider
 * @returns {boolean} True si valide
 */
const validateIBAN = (iban) => {
  if (!iban || typeof iban !== 'string') return false;
  
  // Retirer les espaces et mettre en majuscules
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  
  // Vérifier le format de base (2 lettres pays + 2 chiffres + alphanumérique)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return false;
  
  // Vérifier la longueur selon le pays
  const lengths = {
    FR: 27, // France
    DE: 22, // Allemagne
    ES: 24, // Espagne
    IT: 27, // Italie
    BE: 16, // Belgique
    CH: 21, // Suisse
    GB: 22  // Royaume-Uni
  };
  
  const country = cleaned.substring(0, 2);
  const expectedLength = lengths[country];
  
  if (expectedLength && cleaned.length !== expectedLength) return false;
  
  // Algorithme de validation mod-97 (norme ISO 13616)
  // Déplacer les 4 premiers caractères à la fin
  const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
  
  // Remplacer les lettres par des chiffres (A=10, B=11, ..., Z=35)
  const numeric = rearranged.replace(/[A-Z]/g, (char) => {
    return (char.charCodeAt(0) - 55).toString();
  });
  
  // Calcul mod 97 sur le grand nombre
  let remainder = numeric.match(/.{1,7}/g).reduce((acc, chunk) => {
    return parseInt(acc + chunk) % 97;
  }, '');
  
  return remainder === 1;
};

/**
 * Valide une date (format ISO 8601 ou Date object)
 * @param {string|Date} date - Date à valider
 * @returns {boolean} True si valide
 */
const validateDate = (date) => {
  if (!date) return false;
  
  // Si c'est déjà un objet Date
  if (date instanceof Date) {
    return !isNaN(date.getTime());
  }
  
  // Si c'est une string, essayer de parser
  if (typeof date === 'string') {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }
  
  return false;
};

/**
 * Vérifie si une chaîne est un JSON valide
 * @param {string} str - Chaîne à tester
 * @returns {boolean} True si JSON valide
 */
const isValidJSON = (str) => {
  if (typeof str !== 'string') return false;
  
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Valide un code postal français
 * @param {string} codePostal - Code postal à valider
 * @returns {boolean} True si valide
 */
const validateCodePostal = (codePostal) => {
  if (!codePostal || typeof codePostal !== 'string') return false;
  
  // Format: 5 chiffres
  return /^\d{5}$/.test(codePostal);
};

/**
 * Normalise un numéro de téléphone au format international
 * @param {string} phone - Téléphone à normaliser
 * @returns {string|null} Téléphone normalisé ou null si invalide
 */
const normalizePhone = (phone) => {
  if (!validatePhone(phone)) return null;
  
  const cleaned = phone.replace(/[^0-9+]/g, '');
  
  // Si commence par 0 (format français), remplacer par +33
  if (cleaned.startsWith('0')) {
    return '+33' + cleaned.substring(1);
  }
  
  // Si commence par 0033, remplacer par +33
  if (cleaned.startsWith('0033')) {
    return '+33' + cleaned.substring(4);
  }
  
  return cleaned;
};

/**
 * Valide une URL
 * @param {string} url - URL à valider
 * @returns {boolean} True si valide
 */
const validateURL = (url) => {
  if (!url || typeof url !== 'string') return false;
  
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

module.exports = {
  emptyToNull,
  sanitizeInput,
  validateEmail,
  validatePhone,
  validateSIRET,
  validateIBAN,
  validateDate,
  validateCodePostal,
  validateURL,
  isValidJSON,
  normalizePhone
};
