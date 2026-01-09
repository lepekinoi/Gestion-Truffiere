// ============================================================
// utils/tokens.js
// Utilitaires pour la génération et validation des tokens
// ============================================================

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGEZ_MOI_EN_PRODUCTION_minimum_64_caracteres_de_securite';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const REFRESH_TOKEN_BYTES = 64;

/**
 * Génère un token d'accès JWT
 * @param {Object} user - Données utilisateur
 * @returns {string} Token JWT
 */
const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    nom: user.nom,
    type: 'access'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'truffiere-api',
    audience: 'truffiere-app'
  });
};

/**
 * Génère un refresh token aléatoire
 * @returns {Object} { token, hash, expiresAt }
 */
const generateRefreshToken = () => {
  // Générer un token aléatoire
  const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  
  // Hasher le token pour stockage en BDD
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  // Calculer la date d'expiration
  const expiresAt = new Date();
  const daysMatch = REFRESH_TOKEN_EXPIRES_IN.match(/(\d+)d/);
  if (daysMatch) {
    expiresAt.setDate(expiresAt.getDate() + parseInt(daysMatch[1]));
  } else {
    expiresAt.setDate(expiresAt.getDate() + 7); // Par défaut 7 jours
  }

  return {
    token,      // À envoyer au client
    hash,       // À stocker en BDD
    expiresAt   // Date d'expiration
  };
};

/**
 * Hash un refresh token pour comparaison
 * @param {string} token - Token brut
 * @returns {string} Hash du token
 */
const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Vérifie un token d'accès
 * @param {string} token - Token JWT
 * @returns {Object|null} Payload décodé ou null si invalide
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'truffiere-api',
      audience: 'truffiere-app'
    });
  } catch (err) {
    return null;
  }
};

/**
 * Décode un token sans vérifier la signature (pour debug)
 * @param {string} token - Token JWT
 * @returns {Object|null} Payload décodé
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (err) {
    return null;
  }
};

/**
 * Génère un token de réinitialisation de mot de passe
 * @returns {Object} { token, hash, expiresAt }
 */
const generatePasswordResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  // Expire dans 1 heure
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  return {
    token,
    hash,
    expiresAt
  };
};

/**
 * Génère un token de vérification d'email
 * @returns {Object} { token, hash, expiresAt }
 */
const generateEmailVerificationToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  // Expire dans 24 heures
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  return {
    token,
    hash,
    expiresAt
  };
};

/**
 * Extrait le token du header Authorization
 * @param {string} authHeader - Header Authorization
 * @returns {string|null} Token ou null
 */
const extractBearerToken = (authHeader) => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

/**
 * Calcule le temps restant avant expiration d'un token
 * @param {string} token - Token JWT
 * @returns {number} Secondes restantes (-1 si expiré ou invalide)
 */
const getTokenTimeRemaining = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return -1;
    
    const now = Math.floor(Date.now() / 1000);
    const remaining = decoded.exp - now;
    
    return remaining > 0 ? remaining : -1;
  } catch (err) {
    return -1;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
  decodeToken,
  generatePasswordResetToken,
  generateEmailVerificationToken,
  extractBearerToken,
  getTokenTimeRemaining,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN
};
