// ============================================================
// auth.routes.js - Routes d'authentification avec rotation des refresh tokens
// Extrait de server.js pour améliorer la maintenabilité
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const tokenRotation = require('../utils/tokenRotation');

const createAuthRoutes = (pool) => {
  const router = express.Router();

  // Configuration JWT
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('❌ JWT_SECRET manquant !');
  }

  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
  const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

  // Rate limiting pour l'authentification
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Trop de tentatives de connexion', code: 'AUTH_RATE_LIMIT' },
    skipSuccessfulRequests: true
  });

  // Générer un token d'accès JWT
  const generateAccessToken = (user) => {
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role, nom: user.nom },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  };

  // Middleware d'authentification
  const authMiddleware = (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Token requis', code: 'NO_TOKEN' });
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Format de token invalide', code: 'INVALID_FORMAT' });
      }

      const decoded = jwt.verify(parts[1], JWT_SECRET);
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        nom: decoded.nom
      };
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expiré', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Token invalide', code: 'INVALID_TOKEN' });
    }
  };

  // Middleware de vérification des rôles
  const requireRole = (...roles) => (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié', code: 'NOT_AUTHENTICATED' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès non autorisé', code: 'FORBIDDEN' });
    }
    next();
  };

  // Logger une tentative de connexion
  const logLoginAttempt = async (email, ip, userAgent, success, reason) => {
    try {
      await pool.query(
        'INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason) VALUES ($1, $2, $3, $4, $5)',
        [email, ip, userAgent?.substring(0, 500), success, reason]
      );
    } catch (err) {
      console.error('Erreur log login:', err);
    }
  };

  // ============================================================
  // ROUTES D'AUTHENTIFICATION
  // ============================================================

  // POST /api/auth/login - Connexion
  router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';

    try {
      if (!email || !password) {
        await logLoginAttempt(email, clientIp, userAgent, false, 'MISSING_CREDENTIALS');
        return res.status(400).json({ error: 'Email et mot de passe requis', code: 'MISSING_CREDENTIALS' });
      }

      const userResult = await pool.query(
        `SELECT id, email, password_hash, nom, prenom, role, is_active,
         failed_login_attempts, locked_until
         FROM users WHERE email = $1`,
        [email]
      );

      if (userResult.rows.length === 0) {
        await logLoginAttempt(email, clientIp, userAgent, false, 'USER_NOT_FOUND');
        return res.status(401).json({ error: 'Identifiants invalides', code: 'INVALID_CREDENTIALS' });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        await logLoginAttempt(email, clientIp, userAgent, false, 'ACCOUNT_DISABLED');
        return res.status(403).json({ error: 'Compte désactivé', code: 'ACCOUNT_DISABLED' });
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        await logLoginAttempt(email, clientIp, userAgent, false, 'ACCOUNT_LOCKED');
        return res.status(403).json({
          error: 'Compte temporairement verrouillé',
          code: 'ACCOUNT_LOCKED',
          lockedUntil: user.locked_until
        });
      }

      const passwordValid = await bcrypt.compare(password, user.password_hash);

      if (!passwordValid) {
        const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
        const maxAttempts = 5;

        if (newFailedAttempts >= maxAttempts) {
          const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
          await pool.query(
            `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
            [newFailedAttempts, lockUntil, user.id]
          );
          await logLoginAttempt(email, clientIp, userAgent, false, 'MAX_ATTEMPTS_EXCEEDED');
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

        await logLoginAttempt(email, clientIp, userAgent, false, 'INVALID_PASSWORD');
        return res.status(401).json({
          error: 'Identifiants invalides',
          code: 'INVALID_CREDENTIALS',
          attemptsRemaining: maxAttempts - newFailedAttempts
        });
      }

      const accessToken = generateAccessToken(user);

      // ROTATION: création du 1er refresh token
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

      await logLoginAttempt(email, clientIp, userAgent, true, null);

      res.json({
        message: 'Connexion réussie',
        accessToken,
        refreshToken: refreshTokenData.token,
        expiresIn: JWT_EXPIRES_IN,
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

  // POST /api/auth/refresh - Rafraîchir le token
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

      const accessToken = generateAccessToken(rotationResult.user);

      res.json({
        accessToken,
        refreshToken: rotationResult.token,
        expiresIn: JWT_EXPIRES_IN
      });
    } catch (err) {
      if (err.message === 'TOKEN_REUSE_DETECTED') {
        return res.status(401).json({
          error: 'Token réutilisé - Toutes les sessions ont été révoquées',
          code: 'SECURITY_BREACH',
          action: 'FORCE_LOGOUT'
        });
      }
      if (err.message === 'TOKEN_EXPIRED') return res.status(401).json({ error: 'Token expiré', code: 'TOKEN_EXPIRED' });
      if (err.message === 'INVALID_TOKEN') return res.status(401).json({ error: 'Token invalide', code: 'INVALID_TOKEN' });
      if (err.message === 'USER_INACTIVE') return res.status(403).json({ error: 'Compte désactivé', code: 'ACCOUNT_DISABLED' });
      if (err.message === 'MAX_ROTATION_EXCEEDED') {
        return res.status(401).json({ error: 'Trop de rotations - Reconnexion requise', code: 'MAX_ROTATION_EXCEEDED' });
      }

      console.error('Erreur refresh:', err);
      res.status(500).json({ error: 'Erreur lors du rafraîchissement', code: 'REFRESH_ERROR' });
    }
  });

  // POST /api/auth/logout - Déconnexion
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

  // POST /api/auth/logout-all - Déconnexion de tous les appareils
  router.post('/logout-all', authMiddleware, async (req, res) => {
    try {
      const revokedCount = await tokenRotation.revokeAllUserTokens(pool, req.user.id, 'logout_all_devices');
      res.json({ message: 'Déconnexion de tous les appareils', sessionsRevoked: revokedCount });
    } catch (err) {
      console.error('Erreur logout-all:', err);
      res.status(500).json({ error: 'Erreur', code: 'LOGOUT_ALL_ERROR' });
    }
  });

  // GET /api/auth/me - Profil utilisateur
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

  // POST /api/auth/register - Créer un utilisateur (admin seulement)
  router.post('/register', authMiddleware, requireRole('admin'), async (req, res) => {
    const { email, password, nom, prenom, role = 'user' } = req.body;

    try {
      if (!email || !password || !nom) {
        return res.status(400).json({ error: 'Email, mot de passe et nom requis', code: 'MISSING_FIELDS' });
      }

      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email déjà utilisé', code: 'EMAIL_EXISTS' });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, nom, prenom, role, is_active, email_verified) VALUES ($1, $2, $3, $4, $5, true, true) RETURNING id, email, nom, prenom, role, is_active, created_at',
        [email, passwordHash, nom, prenom || null, role]
      );

      res.status(201).json({ message: 'Utilisateur créé', user: result.rows[0] });
    } catch (err) {
      console.error('Erreur register:', err);
      res.status(500).json({ error: 'Erreur lors de la création', code: 'REGISTER_ERROR' });
    }
  });

  // GET /api/auth/users - Liste des utilisateurs (admin)
  router.get('/users', authMiddleware, requireRole('admin'), async (req, res) => {
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

  // GET /api/auth/sessions - Voir ses sessions actives
  router.get('/sessions', authMiddleware, async (req, res) => {
    try {
      const sessions = await tokenRotation.getActiveSessions(pool, req.user.id);
      res.json(sessions);
    } catch (err) {
      console.error('Erreur get sessions:', err);
      res.status(500).json({ error: 'Erreur', code: 'GET_SESSIONS_ERROR' });
    }
  });

  // GET /api/auth/token-stats - Statistiques des tokens (admin)
  router.get('/token-stats', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
      const stats = await tokenRotation.getTokenStats(pool, req.query.userId || req.user.id);
      res.json(stats);
    } catch (err) {
      console.error('Erreur token stats:', err);
      res.status(500).json({ error: 'Erreur', code: 'TOKEN_STATS_ERROR' });
    }
  });

  // POST /api/auth/cleanup-tokens - Nettoyer les tokens expirés (admin)
  router.post('/cleanup-tokens', authMiddleware, requireRole('admin'), async (req, res) => {
    try {
      const daysOld = parseInt(req.body.daysOld) || 30;
      const deletedCount = await tokenRotation.cleanupExpiredTokens(pool, daysOld);
      res.json({ message: 'Nettoyage effectué', deletedCount });
    } catch (err) {
      console.error('Erreur cleanup:', err);
      res.status(500).json({ error: 'Erreur', code: 'CLEANUP_ERROR' });
    }
  });

  return router;
};

module.exports = createAuthRoutes;
