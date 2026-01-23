// ====================================================================
// services/auth.service.js - Service d'authentification
// ====================================================================

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { BCRYPT_ROUNDS, JWT_SECRET, JWT_EXPIRES_IN, signOptions, verifyOptions } = require('../config/jwt');

/**
 * Hash un mot de passe avec bcrypt
 * @param {string} password - Le mot de passe en clair
 * @returns {Promise<string>} - Le hash du mot de passe
 */
async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS || 12);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    console.error('Erreur lors du hashage du mot de passe:', error);
    throw new Error('Erreur lors du hashage du mot de passe');
  }
}

/**
 * Compare un mot de passe en clair avec son hash
 * @param {string} password - Le mot de passe en clair
 * @param {string} hash - Le hash stocké en base
 * @returns {Promise<boolean>} - true si le mot de passe correspond
 */
async function comparePassword(password, hash) {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('Erreur lors de la comparaison du mot de passe:', error);
    throw new Error('Erreur lors de la comparaison du mot de passe');
  }
}

/**
 * Génère un access token JWT pour un utilisateur
 * @param {Object} user - L'objet utilisateur contenant id, email, role, etc.
 * @returns {string} - Le token JWT signé
 */
function generateAccessToken(user) {
  try {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom
    };

    const token = jwt.sign(payload, JWT_SECRET, signOptions);
    return token;
  } catch (error) {
    console.error('Erreur lors de la génération du token:', error);
    throw new Error('Erreur lors de la génération du token');
  }
}

/**
 * Vérifie et décode un access token JWT
 * @param {string} token - Le token JWT à vérifier
 * @returns {Object} - Le payload décodé
 * @throws {Error} - Si le token est invalide ou expiré
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, verifyOptions);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('INVALID_TOKEN');
    }
    throw new Error('TOKEN_VERIFICATION_FAILED');
  }
}

/**
 * Génère un refresh token aléatoire (utilisé avec tokenRotation)
 * @returns {string} - Un token aléatoire de 64 caractères hexadécimaux
 */
function generateRefreshToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(64).toString('hex');
}

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken
};
