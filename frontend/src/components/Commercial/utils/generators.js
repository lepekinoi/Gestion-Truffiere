// ============================================================
// generators.js - Générateurs de numéros et identifiants
// ============================================================

/**
 * Génère un numéro de commande unique
 * Format: CMD-YYYY-XXX (ex: CMD-2026-001)
 * @param {Array} existingCommandes - Liste des commandes existantes
 * @returns {string} Numéro de commande
 */
export const generateNumeroCommande = (existingCommandes = []) => {
  const year = new Date().getFullYear();
  
  // Extraire tous les numéros existants pour l'année en cours
  const existingNumbers = existingCommandes
    .filter(c => c.numero_commande && c.numero_commande.startsWith(`CMD-${year}`))
    .map(c => {
      const match = c.numero_commande.match(/CMD-(\d{4})-(\d+)/);
      return match ? parseInt(match[2]) : 0;
    });
  
  // Trouver le prochain numéro disponible
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  
  // Formater avec padding (001, 002, etc.)
  return `CMD-${year}-${String(nextNumber).padStart(3, '0')}`;
};

/**
 * Génère un numéro de facture unique
 * Format: FACT-YYYY-XXX (ex: FACT-2026-001)
 * @param {Array} existingVentes - Liste des ventes existantes
 * @returns {string} Numéro de facture
 */
export const generateNumeroFacture = (existingVentes = []) => {
  const year = new Date().getFullYear();
  
  // Extraire tous les numéros existants pour l'année en cours
  const existingNumbers = existingVentes
    .filter(v => v.numero_facture && v.numero_facture.startsWith(`FACT-${year}`))
    .map(v => {
      const match = v.numero_facture.match(/FACT-(\d{4})-(\d+)/);
      return match ? parseInt(match[2]) : 0;
    });
  
  // Trouver le prochain numéro disponible
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  
  // Formater avec padding (001, 002, etc.)
  return `FACT-${year}-${String(nextNumber).padStart(3, '0')}`;
};

/**
 * Génère un code client unique
 * Format: CLT-XXXXX (ex: CLT-00001)
 * @param {Array} existingClients - Liste des clients existants
 * @returns {string} Code client
 */
export const generateCodeClient = (existingClients = []) => {
  // Extraire tous les codes existants
  const existingCodes = existingClients
    .filter(c => c.code_client && c.code_client.startsWith('CLT-'))
    .map(c => {
      const match = c.code_client.match(/CLT-(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
  
  // Trouver le prochain numéro disponible
  const nextNumber = existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;
  
  // Formater avec padding (00001, 00002, etc.)
  return `CLT-${String(nextNumber).padStart(5, '0')}`;
};

/**
 * Génère une référence de transaction unique
 * Format: TRX-YYYYMMDD-XXXXX (ex: TRX-20260128-00001)
 * @param {Array} existingTransactions - Liste des transactions existantes
 * @returns {string} Référence de transaction
 */
export const generateReferenceTransaction = (existingTransactions = []) => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  
  // Extraire tous les numéros existants pour aujourd'hui
  const existingNumbers = existingTransactions
    .filter(t => t.reference && t.reference.startsWith(`TRX-${dateStr}`))
    .map(t => {
      const match = t.reference.match(/TRX-\d{8}-(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
  
  // Trouver le prochain numéro disponible
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  
  // Formater avec padding (00001, 00002, etc.)
  return `TRX-${dateStr}-${String(nextNumber).padStart(5, '0')}`;
};

/**
 * Génère un identifiant unique alphanumérique
 * Format: 8 caractères aléatoires
 * @returns {string} Identifiant unique
 */
export const generateUniqueId = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

/**
 * Génère une date au format ISO pour les formulaires
 * @returns {string} Date du jour au format YYYY-MM-DD
 */
export const getTodayISO = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Génère une date de début de saison truffe (1er juin)
 * @param {number} year - Année (optionnel, par défaut année en cours)
 * @returns {Date} Date de début de saison
 */
export const getSeasonStartDate = (year = null) => {
  const currentYear = year || new Date().getFullYear();
  return new Date(currentYear, 5, 1); // Juin = mois 5 (0-indexé)
};

/**
 * Génère une date de fin de saison truffe (31 mai)
 * @param {number} year - Année (optionnel, par défaut année suivante)
 * @returns {Date} Date de fin de saison
 */
export const getSeasonEndDate = (year = null) => {
  const currentYear = year || new Date().getFullYear();
  return new Date(currentYear + 1, 4, 31); // Mai = mois 4, +1 an
};

/**
 * Détermine la saison truffe actuelle (année de début)
 * @returns {number} Année de début de la saison en cours
 */
export const getCurrentSeasonYear = () => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Si on est entre janvier et mai inclus, on est dans la saison de l'année précédente
  if (currentMonth < 5) {
    return currentYear - 1;
  }
  
  // Sinon (juin à décembre), on est dans la saison de l'année en cours
  return currentYear;
};

/**
 * Génère un label de saison truffe
 * @param {number} year - Année de début de saison (optionnel)
 * @returns {string} Label de saison (ex: "Saison 2025-2026")
 */
export const getSeasonLabel = (year = null) => {
  const seasonYear = year || getCurrentSeasonYear();
  return `Saison ${seasonYear}-${seasonYear + 1}`;
};
