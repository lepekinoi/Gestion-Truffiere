// ============================================================
// utils/index.js - Export centralisé de tous les utilitaires
// ============================================================

// Constantes
export {
  STATUT_COLORS_COMMANDES,
  STATUT_COLORS_VENTES,
  COLORS_PIE_CHART,
  TVA_RATE,
  CLIENT_TYPES,
  STATUTS_COMMANDE,
  STATUTS_VENTE,
  TYPES_CLIENT,
  PAGINATION_DEFAULTS,
  MESSAGES,
  TAB_LABELS,
  DEFAULT_FORM_VALUES,
  DEFAULT_SORT_CONFIG
} from './constants';

// Formatters
export {
  formatPrice,
  formatDate,
  formatDateTime,
  formatWeight,
  grammesToKg,
  formatPhone,
  truncateText,
  calculateTotal,
  calculateTTC,
  calculateTVA,
  formatClientName,
  formatAddress,
  formatPercentage,
  formatNumber
} from './formatters';

// Generators
export {
  generateNumeroCommande,
  generateNumeroFacture,
  generateCodeClient,
  generateReferenceTransaction,
  generateUniqueId,
  getTodayISO,
  getSeasonStartDate,
  getSeasonEndDate,
  getCurrentSeasonYear,
  getSeasonLabel
} from './generators';
