// ============================================================
// utils/index.js
// Point d'entrée centralisé pour tous les utilitaires
// ============================================================

/**
 * Export centralisé de tous les utilitaires de l'application
 * 
 * Usage:
 *   const { emptyToNull, formatCurrency, logLoginAttempt } = require('./utils');
 * 
 * Ou pour tout importer:
 *   const utils = require('./utils');
 *   const slug = utils.slugify('Parcelle Sud');
 */

// ============================================================
// TOKENS & AUTHENTIFICATION
// ============================================================
const {
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  hashRefreshToken,
  hashToken,
  verifyAccessToken,
  decodeToken,
  extractBearerToken,
  getTokenTimeRemaining,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN
} = require('./tokens');

// ============================================================
// ROTATION DE TOKENS
// ============================================================
const {
  ROTATION_CONFIG,
  createRotatedToken,
  rotateRefreshToken,
  revokeTokenChain,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  getTokenStats,
  getActiveSessions
} = require('./tokenRotation');

// ============================================================
// VALIDATION
// ============================================================
const {
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
} = require('./validation');

// ============================================================
// LOGGING & AUDIT
// ============================================================
const {
  logLoginAttempt,
  logSecurityEvent,
  logAuditTrail,
  formatLogMessage,
  logError,
  logInfo,
  logWarn,
  logDebug,
  logAPIRequest,
  determineSeverity
} = require('./logging');

// ============================================================
// HELPERS & FORMATAGE
// ============================================================
const {
  generateNumeroFacture,
  generateNumeroCommande,
  generateUUID,
  formatDate,
  formatCurrency,
  slugify,
  truncate,
  capitalize,
  calculateTVA,
  calculatePrixParKg,
  grammesToKg,
  kgToGrammes,
  sleep,
  isEmpty
} = require('./helpers');

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // === TOKENS ===
  generateAccessToken,
  generateRefreshToken,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  hashRefreshToken,
  hashToken,
  verifyAccessToken,
  decodeToken,
  extractBearerToken,
  getTokenTimeRemaining,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  
  // === ROTATION DE TOKENS ===
  ROTATION_CONFIG,
  createRotatedToken,
  rotateRefreshToken,
  revokeTokenChain,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  getTokenStats,
  getActiveSessions,
  
  // === VALIDATION ===
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
  normalizePhone,
  
  // === LOGGING ===
  logLoginAttempt,
  logSecurityEvent,
  logAuditTrail,
  formatLogMessage,
  logError,
  logInfo,
  logWarn,
  logDebug,
  logAPIRequest,
  determineSeverity,
  
  // === HELPERS ===
  generateNumeroFacture,
  generateNumeroCommande,
  generateUUID,
  formatDate,
  formatCurrency,
  slugify,
  truncate,
  capitalize,
  calculateTVA,
  calculatePrixParKg,
  grammesToKg,
  kgToGrammes,
  sleep,
  isEmpty
};
