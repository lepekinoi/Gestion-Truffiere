// ============================================================
// utils/helpers.js
// Fonctions utilitaires générales
// ============================================================

/**
 * Génère un numéro de facture
 * @param {number} year - Année
 * @param {number} count - Numéro séquentiel
 * @param {string} prefix - Préfixe (par défaut 'FAC')
 * @returns {string} Numéro de facture (ex: FAC-2026-0001)
 */
const generateNumeroFacture = (year, count, prefix = 'FAC') => {
  const paddedCount = String(count).padStart(4, '0');
  return `${prefix}-${year}-${paddedCount}`;
};

/**
 * Génère un numéro de commande
 * @param {number} year - Année
 * @param {number} count - Numéro séquentiel
 * @param {string} prefix - Préfixe (par défaut 'CMD')
 * @returns {string} Numéro de commande (ex: CMD-2026-0001)
 */
const generateNumeroCommande = (year, count, prefix = 'CMD') => {
  const paddedCount = String(count).padStart(4, '0');
  return `${prefix}-${year}-${paddedCount}`;
};

/**
 * Formate une date selon le format spécifié
 * @param {Date|string} date - Date à formater
 * @param {string} format - Format de sortie ('short', 'long', 'iso', 'fr')
 * @param {string} locale - Locale (par défaut 'fr-FR')
 * @returns {string} Date formatée
 */
const formatDate = (date, format = 'short', locale = 'fr-FR') => {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  
  if (isNaN(d.getTime())) return '';
  
  switch (format) {
    case 'short':
      // 28/01/2026
      return d.toLocaleDateString(locale);
    
    case 'long':
      // 28 janvier 2026
      return d.toLocaleDateString(locale, { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    
    case 'iso':
      // 2026-01-28
      return d.toISOString().split('T')[0];
    
    case 'datetime':
      // 28/01/2026 21:30
      return d.toLocaleDateString(locale) + ' ' + 
             d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    
    case 'fr':
    default:
      // 28/01/2026
      return d.toLocaleDateString('fr-FR');
  }
};

/**
 * Formate un montant en devise
 * @param {number} amount - Montant
 * @param {string} currency - Devise (par défaut 'EUR')
 * @param {string} locale - Locale (par défaut 'fr-FR')
 * @returns {string} Montant formaté (ex: 150,00 €)
 */
const formatCurrency = (amount, currency = 'EUR', locale = 'fr-FR') => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0,00 €';
  }
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Calcule le montant de TVA
 * @param {number} montantHT - Montant hors taxes
 * @param {number} tauxTVA - Taux de TVA en pourcentage (ex: 20 pour 20%)
 * @returns {Object} { montantTVA, montantTTC }
 */
const calculateTVA = (montantHT, tauxTVA) => {
  if (!montantHT || !tauxTVA) {
    return { montantTVA: 0, montantTTC: montantHT || 0 };
  }
  
  const montantTVA = montantHT * (tauxTVA / 100);
  const montantTTC = montantHT + montantTVA;
  
  return {
    montantTVA: Math.round(montantTVA * 100) / 100,
    montantTTC: Math.round(montantTTC * 100) / 100
  };
};

/**
 * Convertit un texte en slug (URL-friendly)
 * @param {string} text - Texte à convertir
 * @returns {string} Slug (ex: 'parcelle-sud-ouest')
 */
const slugify = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Remplacer les caractères accentués
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remplacer les caractères spéciaux par des tirets
    .replace(/[^a-z0-9\s-]/g, '')
    // Remplacer les espaces par des tirets
    .replace(/\s+/g, '-')
    // Supprimer les tirets multiples
    .replace(/-+/g, '-')
    // Supprimer les tirets en début/fin
    .replace(/^-+|-+$/g, '');
};

/**
 * Calcule le prix par kilogramme
 * @param {number} prixTotal - Prix total
 * @param {number} grammes - Poids en grammes
 * @returns {number} Prix par kg
 */
const calculatePrixParKg = (prixTotal, grammes) => {
  if (!prixTotal || !grammes || grammes === 0) return 0;
  
  const kg = grammes / 1000;
  return Math.round((prixTotal / kg) * 100) / 100;
};

/**
 * Convertit des grammes en kilogrammes
 * @param {number} grammes - Poids en grammes
 * @param {number} decimals - Nombre de décimales (par défaut 3)
 * @returns {number} Poids en kg
 */
const grammesToKg = (grammes, decimals = 3) => {
  if (!grammes || grammes === 0) return 0;
  
  const kg = grammes / 1000;
  return Math.round(kg * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * Convertit des kilogrammes en grammes
 * @param {number} kg - Poids en kg
 * @returns {number} Poids en grammes
 */
const kgToGrammes = (kg) => {
  if (!kg || kg === 0) return 0;
  return Math.round(kg * 1000);
};

/**
 * Génère un identifiant unique (UUID v4 simplifié)
 * @returns {string} UUID
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Tronque un texte à une longueur maximale
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @param {string} suffix - Suffixe (par défaut '...')
 * @returns {string} Texte tronqué
 */
const truncate = (text, maxLength, suffix = '...') => {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Capitalise la première lettre d'une chaîne
 * @param {string} text - Texte
 * @returns {string} Texte capitalisé
 */
const capitalize = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Attend un certain temps (async sleep)
 * @param {number} ms - Millisecondes à attendre
 * @returns {Promise<void>}
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Vérifie si un objet est vide
 * @param {Object} obj - Objet à tester
 * @returns {boolean} True si vide
 */
const isEmpty = (obj) => {
  if (obj === null || obj === undefined) return true;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
};

module.exports = {
  // Numérotation
  generateNumeroFacture,
  generateNumeroCommande,
  generateUUID,
  
  // Formatage
  formatDate,
  formatCurrency,
  slugify,
  truncate,
  capitalize,
  
  // Calculs
  calculateTVA,
  calculatePrixParKg,
  grammesToKg,
  kgToGrammes,
  
  // Utilitaires
  sleep,
  isEmpty
};
