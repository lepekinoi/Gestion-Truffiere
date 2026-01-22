// ====================================================================
// routes/auth.routes.js - Routes d'authentification
// Code extrait de server.js - VERSION COMPLÈTE ET CORRIGÉE
// ====================================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware, requireRole, requireWriteAccess } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');
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
      `SELECT id, email, password_hash, nom, prenom, role, is_active, failed_login_attempts, locked_until 
       FROM users WHERE email = $1`,
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

module.exports = router;
