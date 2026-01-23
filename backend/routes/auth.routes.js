// ====================================================================
// routes/auth.routes.js - Routes d'authentification
// Code extrait de server.js - VERSION COMPLÈTE ET CORRIGÉE
// ====================================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware, roleMiddleware, adminOnly } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');
const authService = require('../services/auth.service');
const { logLoginAttempt } = require('../utils/helpers');
const tokenRotation = require('../utils/tokenRotation');
const { BCRYPT_ROUNDS } = require('../config/jwt');

// ==================== POST /login - Connexion ====================
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  try {
    if (!email || !password) {
      await logLoginAttempt(pool, email, clientIp, userAgent, false, 'MISSING_CREDENTIALS');
      return res.status(400).json({ error: 'Email et mot de passe requis', code: 'MISSING_CREDENTIALS' });
    }

    const userResult = await pool.query(
      `SELECT id, email, password_hash, nom, prenom, role, is_active, failed_login_attempts, locked_until FROM users WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      await logLoginAttempt(pool, email, clientIp, userAgent, false, 'USER_NOT_FOUND');
      return res.status(401).json({ error: 'Identifiants invalides', code: 'INVALID_CREDENTIALS' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      await logLoginAttempt(pool, email, clientIp, userAgent, false, 'ACCOUNT_DISABLED');
      return res.status(403).json({ error: 'Compte désactivé', code: 'ACCOUNT_DISABLED' });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await logLoginAttempt(pool, email, clientIp, userAgent, false, 'ACCOUNT_LOCKED');
      return res.status(403).json({
        error: 'Compte temporairement verrouillé',
        code: 'ACCOUNT_LOCKED',
        lockedUntil: user.locked_until
      });
    }

    const passwordValid = await authService.comparePassword(password, user.password_hash);

    if (!passwordValid) {
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      const maxAttempts = 5;

      if (newFailedAttempts >= maxAttempts) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await pool.query(
          `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
          [newFailedAttempts, lockUntil, user.id]
        );
        await logLoginAttempt(pool, email, clientIp, userAgent, false, 'MAX_ATTEMPTS_EXCEEDED');
        return res.status(403).json({
          error: 'Trop de tentatives échouées. Compte verrouillé pour 15 minutes',
          code: 'ACCOUNT_LOCKED',
          lockedUntil: lockUntil
        });
      }

      await pool.query(
        `UPDATE users SET failed_login_attempts = $1 WHERE id = $2`,
        [newFailedAttempts, user.id]
      );
      await logLoginAttempt(pool, email, clientIp, userAgent, false, 'INVALID_PASSWORD');
      return res.status(401).json({
        error: 'Identifiants invalides',
        code: 'INVALID_CREDENTIALS',
        attemptsRemaining: maxAttempts - newFailedAttempts
      });
    }

    const accessToken = authService.generateAccessToken(user);
    const refreshTokenData = await tokenRotation.createRotatedToken(
      pool,
      user.id,
      userAgent.substring(0, 255),
      clientIp,
      userAgent
    );

    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    await logLoginAttempt(pool, email, clientIp, userAgent, true, null);

    res.json({
      message: 'Connexion réussie',
      accessToken,
      refreshToken: refreshTokenData.token,
      expiresIn: require('../config/jwt').JWT_EXPIRES_IN,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion', code: 'LOGIN_ERROR' });
  }
});

// ==================== POST /refresh - Rafraîchir le token ====================
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  try {
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requis', code: 'MISSING_TOKEN' });
    }

    const rotationResult = await tokenRotation.rotateRefreshToken(
      pool,
      refreshToken,
      userAgent.substring(0, 255),
      clientIp,
      userAgent
    );

    const accessToken = authService.generateAccessToken(rotationResult.user);

    res.json({
      accessToken,
      refreshToken: rotationResult.token,
      expiresIn: require('../config/jwt').JWT_EXPIRES_IN
    });
  } catch (err) {
    console.error('Erreur refresh:', err);

    if (err.message === 'TOKEN_REUSE_DETECTED') {
      return res.status(401).json({
        error: 'Token réutilisé - Toutes les sessions ont été révoquées',
        code: 'SECURITY_BREACH',
        action: 'FORCE_LOGOUT'
      });
    }

    if (err.message === 'TOKEN_EXPIRED') {
      return res.status(401).json({ error: 'Token expiré', code: 'TOKEN_EXPIRED' });
    }

    if (err.message === 'INVALID_TOKEN') {
      return res.status(401).json({ error: 'Token invalide', code: 'INVALID_TOKEN' });
    }

    if (err.message === 'USER_INACTIVE') {
      return res.status(403).json({ error: 'Compte désactivé', code: 'ACCOUNT_DISABLED' });
    }

    if (err.message === 'MAX_ROTATION_EXCEEDED') {
      return res.status(401).json({
        error: 'Trop de rotations - Veuillez vous reconnecter',
        code: 'MAX_ROTATION_EXCEEDED'
      });
    }

    res.status(500).json({ error: 'Erreur lors du rafraîchissement', code: 'REFRESH_ERROR' });
  }
});

// ==================== POST /logout - Déconnexion ====================
router.post('/logout', authMiddleware, async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (refreshToken) {
      const tokenHash = tokenRotation.hashToken(refreshToken);
      const tokenResult = await pool.query(
        'SELECT id FROM refresh_tokens WHERE token_hash = $1',
        [tokenHash]
      );

      if (tokenResult.rows.length > 0) {
        await tokenRotation.revokeTokenChain(pool, tokenResult.rows[0].id, 'user_logout');
      }
    }

    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    console.error('Erreur logout:', err);
    res.status(500).json({ error: 'Erreur lors de la déconnexion', code: 'LOGOUT_ERROR' });
  }
});

// ==================== POST /logout-all - Déconnexion de tous les appareils ====================
router.post('/logout-all', authMiddleware, async (req, res) => {
  try {
    const revokedCount = await tokenRotation.revokeAllUserTokens(pool, req.user.id, 'logout_all_devices');
    res.json({
      message: 'Déconnexion de tous les appareils',
      sessionsRevoked: revokedCount
    });
  } catch (err) {
    console.error('Erreur logout-all:', err);
    res.status(500).json({ error: 'Erreur', code: 'LOGOUT_ALL_ERROR' });
  }
});

// ==================== GET /me - Profil utilisateur ====================
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, nom, prenom, role, is_active, last_login, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur get me:', err);
    res.status(500).json({ error: 'Erreur', code: 'PROFILE_ERROR' });
  }
});

// ==================== POST /register - Créer un utilisateur (admin seulement) ====================
router.post('/register', authMiddleware, adminOnly, async (req, res) => {
  const { email, password, nom, prenom, role = 'user' } = req.body;

  try {
    // Validation des champs requis
    if (!email || !password || !nom) {
      return res.status(400).json({
        error: 'Email, mot de passe et nom requis',
        code: 'MISSING_FIELDS'
      });
    }

    // Vérification si l'email existe déjà
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Email déjà utilisé',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hashage du mot de passe
    const passwordHash = await authService.hashPassword(password);

    // Insertion du nouvel utilisateur
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, nom, prenom, role, is_active, email_verified) VALUES ($1, $2, $3, $4, $5, true, true) RETURNING id, email, nom, prenom, role, is_active, created_at',
      [email, passwordHash, nom, prenom || null, role]
    );

    res.status(201).json({
      message: 'Utilisateur créé',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Erreur register:', err);
    res.status(500).json({
      error: 'Erreur lors de la création',
      code: 'REGISTER_ERROR'
    });
  }
});

// ==================== GET /users - Liste des utilisateurs (admin) ====================
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, nom, prenom, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur list users:', err);
    res.status(500).json({ error: 'Erreur', code: 'LIST_USERS_ERROR' });
  }
});

// ==================== GET /users/:id - Détails utilisateur (admin) ====================
router.get('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, nom, prenom, role, is_active, email_verified, last_login, failed_login_attempts, locked_until, created_at, updated_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur get user:', err);
    res.status(500).json({ error: 'Erreur', code: 'GET_USER_ERROR' });
  }
});

// ==================== PUT /users/:id - Modifier utilisateur (admin) ====================
router.put('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { email, nom, prenom, role, is_active } = req.body;

  try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (email !== undefined) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email déjà utilisé', code: 'EMAIL_EXISTS' });
      }
      updates.push(`email = $${idx++}`);
      values.push(email);
    }

    if (nom !== undefined) {
      updates.push(`nom = $${idx++}`);
      values.push(nom);
    }

    if (prenom !== undefined) {
      updates.push(`prenom = $${idx++}`);
      values.push(prenom);
    }

    if (role !== undefined) {
      updates.push(`role = $${idx++}`);
      values.push(role);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(is_active);

      if (!is_active) {
        await pool.query(
          "UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'account_disabled' WHERE user_id = $1",
          [id]
                );
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à mettre à jour', code: 'NO_DATA' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, email, nom, prenom, role, is_active`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json({ message: 'Utilisateur mis à jour', user: result.rows[0] });
  } catch (err) {
    console.error('Erreur update user:', err);
    res.status(500).json({ error: 'Erreur', code: 'UPDATE_USER_ERROR' });
  }
});

// ==================== DELETE /users/:id - Supprimer utilisateur (admin) ====================
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        error: 'Impossible de supprimer votre propre compte',
        code: 'CANNOT_DELETE_SELF'
      });
    }

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json({ message: 'Utilisateur supprimé', user: result.rows[0] });
  } catch (err) {
    console.error('Erreur delete user:', err);
    res.status(500).json({ error: 'Erreur', code: 'DELETE_USER_ERROR' });
  }
});

// ==================== POST /change-password - Changer son mot de passe ====================
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mots de passe requis', code: 'MISSING_FIELDS' });
    }

    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    const passwordValid = await authService.comparePassword(
      currentPassword,
      userResult.rows[0].password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Mot de passe actuel incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    const newPasswordHash = await authService.hashPassword(newPassword);

    await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    await pool.query(
      "UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'password_changed' WHERE user_id = $1",
      [req.user.id]
    );

    res.json({ message: 'Mot de passe modifié' });
  } catch (err) {
    console.error('Erreur change password:', err);
    res.status(500).json({ error: 'Erreur', code: 'CHANGE_PASSWORD_ERROR' });
  }
});

// ==================== POST /users/:id/reset-password - Reset mot de passe (admin) ====================
router.post('/users/:id/reset-password', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: 'Mot de passe invalide (min 8 caractères)',
        code: 'INVALID_PASSWORD'
      });
    }

    const passwordHash = await authService.hashPassword(newPassword);

    const result = await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $2 RETURNING id, email',
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    await pool.query(
      "UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'admin_reset' WHERE user_id = $1",
      [id]
    );

    res.json({ message: 'Mot de passe réinitialisé', user: result.rows[0] });
  } catch (err) {
    console.error('Erreur reset password:', err);
    res.status(500).json({ error: 'Erreur', code: 'RESET_PASSWORD_ERROR' });
  }
});

// ==================== POST /users/:id/unlock - Déverrouiller compte (admin) ====================
router.post('/users/:id/unlock', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1 RETURNING id, email',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json({ message: 'Compte déverrouillé', user: result.rows[0] });
  } catch (err) {
    console.error('Erreur unlock:', err);
    res.status(500).json({ error: 'Erreur', code: 'UNLOCK_ERROR' });
  }
});

// ==================== GET /sessions - Voir ses sessions actives ====================
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const sessions = await tokenRotation.getActiveSessions(pool, req.user.id);
    res.json(sessions);
  } catch (err) {
    console.error('Erreur get sessions:', err);
    res.status(500).json({ error: 'Erreur', code: 'GET_SESSIONS_ERROR' });
  }
});

// ==================== DELETE /sessions/:id - Révoquer une session ====================
router.delete('/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'user_revoked' WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session non trouvée', code: 'SESSION_NOT_FOUND' });
    }

    res.json({ message: 'Session révoquée' });
  } catch (err) {
    console.error('Erreur revoke session:', err);
    res.status(500).json({ error: 'Erreur', code: 'REVOKE_SESSION_ERROR' });
  }
});

// ==================== GET /token-stats - Statistiques des tokens (admin) ====================
router.get('/token-stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const stats = await tokenRotation.getTokenStats(pool, req.query.userId || req.user.id);
    res.json(stats);
  } catch (err) {
    console.error('Erreur token stats:', err);
    res.status(500).json({ error: 'Erreur', code: 'TOKEN_STATS_ERROR' });
  }
});

// ==================== POST /cleanup-tokens - Nettoyer les tokens expirés (admin) ====================
router.post('/cleanup-tokens', authMiddleware, adminOnly, async (req, res) => {
  try {
    const daysOld = parseInt(req.body.daysOld) || 30;
    const deletedCount = await tokenRotation.cleanupExpiredTokens(pool, daysOld);
    res.json({ message: 'Nettoyage effectué', deletedCount });
  } catch (err) {
    console.error('Erreur cleanup:', err);
    res.status(500).json({ error: 'Erreur', code: 'CLEANUP_ERROR' });
  }
});

module.exports = router;
