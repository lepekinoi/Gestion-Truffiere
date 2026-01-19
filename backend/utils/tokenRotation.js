// ============================================================
// tokenRotation.js - Gestion de la rotation des refresh tokens
// Implémente la rotation automatique pour prévenir les attaques
// ============================================================

const crypto = require('crypto');

/**
 * Configuration de la rotation des tokens
 */
const ROTATION_CONFIG = {
  MAX_ROTATION_COUNT: 10, // Nombre maximum de rotations avant révocation forcée
  ROTATION_WINDOW_SECONDS: 30, // Fenêtre de tolérance pour les connexions simultanées
  TOKEN_REUSE_DETECTION: true, // Détecter la réutilisation de tokens
  AUTO_REVOKE_ON_REUSE: true, // Révoquer automatiquement en cas de réutilisation
};

/**
 * Génère un nouveau refresh token cryptographiquement sécurisé
 * @returns {Object} - { token, hash }
 */
function generateRefreshToken() {
  const token = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Hash un refresh token existant
 * @param {string} token - Token à hasher
 * @returns {string} - Hash SHA256 du token
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Crée un nouveau refresh token avec rotation
 * @param {Object} pool - Pool de connexion PostgreSQL
 * @param {number} userId - ID de l'utilisateur
 * @param {string} deviceInfo - Informations sur l'appareil
 * @param {string} ipAddress - Adresse IP du client
 * @param {string} userAgent - User agent du navigateur
 * @param {number|null} parentTokenId - ID du token parent (pour la chaîne de rotation)
 * @returns {Promise<Object>} - Token créé
 */
async function createRotatedToken(pool, userId, deviceInfo, ipAddress, userAgent, parentTokenId = null) {
  const { token, hash } = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7));

  // Calculer le nombre de rotations
  let rotationCount = 0;
  if (parentTokenId) {
    const parentResult = await pool.query(
      'SELECT rotation_count FROM refresh_tokens WHERE id = $1',
      [parentTokenId]
    );
    if (parentResult.rows.length > 0) {
      rotationCount = parentResult.rows[0].rotation_count + 1;
    }
  }

  // Vérifier la limite de rotation
  if (rotationCount > ROTATION_CONFIG.MAX_ROTATION_COUNT) {
    throw new Error('MAX_ROTATION_EXCEEDED');
  }

  // Insérer le nouveau token
  const result = await pool.query(
    `INSERT INTO refresh_tokens 
     (user_id, token_hash, parent_token_id, rotation_count, device_info, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, expires_at, rotation_count`,
    [userId, hash, parentTokenId, rotationCount, deviceInfo, ipAddress, userAgent, expiresAt]
  );

  return {
    token,
    tokenId: result.rows[0].id,
    expiresAt: result.rows[0].expires_at,
    rotationCount: result.rows[0].rotation_count,
  };
}

/**
 * Valide et effectue la rotation d'un refresh token
 * @param {Object} pool - Pool de connexion PostgreSQL
 * @param {string} token - Token à valider et faire tourner
 * @param {string} deviceInfo - Informations sur l'appareil
 * @param {string} ipAddress - Adresse IP du client
 * @param {string} userAgent - User agent du navigateur
 * @returns {Promise<Object>} - Nouveau token ou erreur
 */
async function rotateRefreshToken(pool, token, deviceInfo, ipAddress, userAgent) {
  const tokenHash = hashToken(token);

  // Récupérer le token actuel
  const tokenResult = await pool.query(
    `SELECT rt.*, u.id as user_id, u.email, u.nom, u.role, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );

  if (tokenResult.rows.length === 0) {
    throw new Error('INVALID_TOKEN');
  }

  const currentToken = tokenResult.rows[0];

  // **DÉTECTION DE RÉUTILISATION (Sécurité Critique)**
  if (currentToken.revoked && ROTATION_CONFIG.TOKEN_REUSE_DETECTION) {
    console.error('[⚠️ ALERTE SÉCURITÉ] Réutilisation de token détectée:', {
      userId: currentToken.user_id,
      email: currentToken.email,
      tokenId: currentToken.id,
      revokedAt: currentToken.revoked_at,
      revokedReason: currentToken.revoked_reason,
      attemptFrom: ipAddress,
    });

    if (ROTATION_CONFIG.AUTO_REVOKE_ON_REUSE) {
      // Révoquer TOUTE la chaîne de tokens (famille complète)
      await pool.query(
        'SELECT revoke_token_chain($1, $2)',
        [currentToken.parent_token_id || currentToken.id, 'token_reuse_detected']
      );

      // Révoquer toutes les sessions de l'utilisateur
      await pool.query(
        `UPDATE refresh_tokens 
         SET revoked = TRUE, revoked_at = NOW(), revoked_reason = 'security_breach_all_sessions'
         WHERE user_id = $1 AND revoked = FALSE`,
        [currentToken.user_id]
      );
    }

    throw new Error('TOKEN_REUSE_DETECTED');
  }

  // Vérifier l'expiration
  if (new Date(currentToken.expires_at) < new Date()) {
    throw new Error('TOKEN_EXPIRED');
  }

  // Vérifier que l'utilisateur est actif
  if (!currentToken.is_active) {
    throw new Error('USER_INACTIVE');
  }

  // **VÉRIFICATION DE LA FENÊTRE DE ROTATION**
  // Permet une tolérance pour les requêtes simultanées (ex: 2 onglets)
  const lastUsed = currentToken.last_used_at;
  if (lastUsed) {
    const timeSinceLastUse = (new Date() - new Date(lastUsed)) / 1000;
    if (timeSinceLastUse < ROTATION_CONFIG.ROTATION_WINDOW_SECONDS) {
      // Token utilisé récemment, permettre une réutilisation temporaire
      console.warn('[⚠️] Token réutilisé dans la fenêtre de tolérance:', {
        userId: currentToken.user_id,
        timeSinceLastUse: timeSinceLastUse.toFixed(2) + 's',
      });
      // Ne pas révoquer, mais logger pour surveillance
    }
  }

  // **ROTATION: Créer un nouveau token**
  const newToken = await createRotatedToken(
    pool,
    currentToken.user_id,
    deviceInfo,
    ipAddress,
    userAgent,
    currentToken.id
  );

  // **RÉVOQUER L'ANCIEN TOKEN**
  await pool.query(
    `UPDATE refresh_tokens 
     SET revoked = TRUE, 
         revoked_at = NOW(), 
         revoked_reason = 'rotated',
         last_used_at = NOW()
     WHERE id = $1`,
    [currentToken.id]
  );

  console.log('[✓] Token remplacé avec succès:', {
    userId: currentToken.user_id,
    email: currentToken.email,
    oldTokenId: currentToken.id,
    newTokenId: newToken.tokenId,
    rotationCount: newToken.rotationCount,
  });

  return {
    token: newToken.token,
    expiresAt: newToken.expiresAt,
    user: {
      id: currentToken.user_id,
      email: currentToken.email,
      nom: currentToken.nom,
      role: currentToken.role,
    },
  };
}

/**
 * Révoque un token et toute sa famille (chaîne de rotation)
 * @param {Object} pool - Pool de connexion PostgreSQL
 * @param {number} tokenId - ID du token à révoquer
 * @param {string} reason - Raison de la révocation
 * @returns {Promise<number>} - Nombre de tokens révoqués
 */
async function revokeTokenChain(pool, tokenId, reason = 'manual_revocation') {
  const result = await pool.query(
    'SELECT revoke_token_chain($1, $2) as count',
    [tokenId, reason]
  );
  return result.rows[0].count;
}

/**
 * Révoque tous les tokens d'un utilisateur
 * @param {Object} pool - Pool de connexion PostgreSQL
 * @param {number} userId - ID de l'utilisateur
 * @param {string} reason - Raison de la révocation
 * @returns {Promise<number>} - Nombre de tokens révoqués
 */
async function revokeAllUserTokens(pool, userId, reason = 'logout_all') {
  const result = await pool.query(
    `UPDATE refresh_tokens 
     SET revoked = TRUE, revoked_at = NOW(), revoked_reason = $2
     WHERE user_id = $1 AND revoked = FALSE
     RETURNING id`,
    [userId, reason]
  );
  return result.rows.length;
}

/**
 * Nettoie les tokens expirés et révoqués
 * @param {Object} pool - Pool de connexion PostgreSQL
 * @param {number} daysOld - Nombre de jours avant suppression
 * @returns {Promise<number>} - Nombre de tokens supprimés
 */
async function cleanupExpiredTokens(pool, daysOld = 30) {
  const result = await pool.query(
    'SELECT cleanup_expired_refresh_tokens($1) as count',
    [daysOld]
  );
  return result.rows[0].count;
}

/**
 * Obtient les statistiques de tokens pour un utilisateur
 * @param {Object} pool - Pool de connexion PostgreSQL
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<Object>} - Statistiques
 */
async function getTokenStats(pool, userId) {
  const result = await pool.query(
    `SELECT 
       COUNT(*) FILTER (WHERE revoked = FALSE AND expires_at > NOW()) as active_tokens,
       COUNT(*) FILTER (WHERE revoked = TRUE) as revoked_tokens,
       COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_tokens,
       MAX(rotation_count) as max_rotation_count,
       MAX(created_at) as last_token_created
     FROM refresh_tokens
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

/**
 * Liste les sessions actives d'un utilisateur
 * @param {Object} pool - Pool de connexion PostgreSQL
 * @param {number} userId - ID de l'utilisateur
 * @returns {Promise<Array>} - Liste des sessions actives
 */
async function getActiveSessions(pool, userId) {
  const result = await pool.query(
    `SELECT 
       id,
       device_info,
       ip_address,
       rotation_count,
       created_at,
       last_used_at,
       expires_at
     FROM refresh_tokens
     WHERE user_id = $1 
       AND revoked = FALSE 
       AND expires_at > NOW()
     ORDER BY last_used_at DESC NULLS LAST, created_at DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = {
  ROTATION_CONFIG,
  generateRefreshToken,
  hashToken,
  createRotatedToken,
  rotateRefreshToken,
  revokeTokenChain,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  getTokenStats,
  getActiveSessions,
};
