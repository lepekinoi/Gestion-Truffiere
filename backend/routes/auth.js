// ============================================================
// routes/auth.js
// Routes d'authentification pour l'API Truffière
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Middleware
const { authMiddleware, adminOnly } = require('../middleware/auth');
const {
  loginValidation,
  registerValidation,
  updateUserValidation,
  changePasswordValidation,
  refreshTokenValidation,
  forgotPasswordValidation,
  resetPasswordValidation
} = require('../middleware/validation');

// Utils centralisés
const {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generatePasswordResetToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  logLoginAttempt,
  logSecurityEvent,
  logAuditTrail,
  emptyToNull
} = require('../utils');

// Config
const { bcryptConfig, authLimiter, registerLimiter, passwordResetLimiter } = require('../config/security');

/**
 * Factory pour créer les routes avec accès au pool de connexion
 * @param {Pool} pool - Pool de connexion PostgreSQL
 */
const createAuthRoutes = (pool) => {

  // ==================== LOGIN ====================
  /**
   * POST /api/auth/login
   * Authentification d'un utilisateur
   */
  router.post('/login', authLimiter, loginValidation, async (req, res) => {
    const { email, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';

    try {
      // 1. Vérifier si le compte est verrouillé
      const lockCheck = await pool.query(
        'SELECT * FROM check_account_lock($1)',
        [email]
      );

      if (lockCheck.rows[0]?.is_locked) {
        await logLoginAttempt(pool, email, clientIp, userAgent, false, 'account_locked');
        await logSecurityEvent(pool, null, 'account_locked', {
          email,
          ip: clientIp,
          lockedUntil: lockCheck.rows[0].locked_until
        });
        return res.status(423).json({
          error: 'Compte temporairement verrouillé',
          code: 'ACCOUNT_LOCKED',
          lockedUntil: lockCheck.rows[0].locked_until
        });
      }

      // 2. Rechercher l'utilisateur
      const userResult = await pool.query(
        'SELECT id, email, password_hash, nom, prenom, role, is_active FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        await logLoginAttempt(pool, email, clientIp, userAgent, false, 'invalid_email');
        await pool.query('SELECT increment_login_failures($1)', [email]);
        return res.status(401).json({
          error: 'Email ou mot de passe incorrect',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const user = userResult.rows[0];

      // 3. Vérifier si le compte est actif
      if (!user.is_active) {
        await logLoginAttempt(pool, email, clientIp, userAgent, false, 'account_inactive');
        await logSecurityEvent(pool, user.id, 'login_attempt_inactive_account', {
          email,
          ip: clientIp
        });
        return res.status(403).json({
          error: 'Compte désactivé',
          code: 'ACCOUNT_DISABLED'
        });
      }

      // 4. Vérifier le mot de passe
      const passwordValid = await bcrypt.compare(password, user.password_hash);

      if (!passwordValid) {
        await logLoginAttempt(pool, email, clientIp, userAgent, false, 'invalid_password');
        await pool.query('SELECT increment_login_failures($1)', [email]);
        return res.status(401).json({
          error: 'Email ou mot de passe incorrect',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // 5. Générer les tokens
      const accessToken = generateAccessToken(user);
      const { token: refreshToken, hash: refreshTokenHash, expiresAt } = generateRefreshToken();

      // 6. Sauvegarder le refresh token
      await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, refreshTokenHash, userAgent.substring(0, 255), clientIp, expiresAt]
      );

      // 7. Réinitialiser les échecs et mettre à jour last_login
      await pool.query('SELECT reset_login_failures($1)', [user.id]);

      // 8. Logger la connexion réussie
      await logLoginAttempt(pool, email, clientIp, userAgent, true, null);

      // ✅ 9. AUDIT TRAIL - Login success
      await logAuditTrail(pool, user.id, 'login', 'auth', user.id, null, {
        email: user.email,
        ip: clientIp,
        userAgent: userAgent.substring(0, 100)
      });

      // 10. Retourner la réponse
      res.json({
        message: 'Connexion réussie',
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
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
      res.status(500).json({
        error: 'Erreur lors de la connexion',
        code: 'LOGIN_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== REFRESH TOKEN ====================
  /**
   * POST /api/auth/refresh
   * Rafraîchir le token d'accès avec rotation automatique
   */
  router.post('/refresh', refreshTokenValidation, async (req, res) => {
    const { refreshToken } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || 'Unknown';

    try {
      // Utiliser la rotation automatique des tokens (sécurité++)
      const result = await rotateRefreshToken(
        pool,
        refreshToken,
        userAgent.substring(0, 255),
        clientIp,
        userAgent.substring(0, 255)
      );

      // Générer un nouveau access token
      const accessToken = generateAccessToken(result.user);

      // ✅ AUDIT TRAIL - Token refresh (optionnel car peut être verbeux)
      // await logAuditTrail(pool, result.user.id, 'token_refresh', 'auth', result.user.id, null, { ip: clientIp });

      res.json({
        accessToken,
        refreshToken: result.token, // Nouveau refresh token
        expiresIn: process.env.JWT_EXPIRES_IN || '15m'
      });

    } catch (err) {
      console.error('Erreur refresh:', err);
      
      // Gestion des erreurs spécifiques
      if (err.message === 'TOKEN_REUSE_DETECTED') {
        return res.status(401).json({
          error: 'Réutilisation de token détectée - Toutes les sessions ont été révoquées',
          code: 'TOKEN_REUSE_DETECTED'
        });
      }
      
      if (err.message === 'INVALID_TOKEN' || err.message === 'TOKEN_EXPIRED') {
        return res.status(401).json({
          error: 'Token de rafraîchissement invalide ou expiré',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }
      
      if (err.message === 'USER_INACTIVE') {
        return res.status(403).json({
          error: 'Compte désactivé',
          code: 'ACCOUNT_DISABLED'
        });
      }

      res.status(500).json({
        error: 'Erreur lors du rafraîchissement',
        code: 'REFRESH_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== LOGOUT ====================
  /**
   * POST /api/auth/logout
   * Déconnexion (révoque le refresh token)
   */
  router.post('/logout', authMiddleware, async (req, res) => {
    const { refreshToken } = req.body;

    try {
      if (refreshToken) {
        const tokenHash = hashRefreshToken(refreshToken);
        await pool.query(
          `UPDATE refresh_tokens 
           SET revoked = true, revoked_at = NOW(), revoked_reason = 'logout'
           WHERE token_hash = $1 AND user_id = $2`,
          [tokenHash, req.user.id]
        );
      }

      // ✅ AUDIT TRAIL - Logout
      await logAuditTrail(pool, req.user.id, 'logout', 'auth', req.user.id, null, {
        email: req.user.email
      });

      res.json({ 
        message: 'Déconnexion réussie',
        code: 'LOGOUT_SUCCESS'
      });

    } catch (err) {
      console.error('Erreur logout:', err);
      res.status(500).json({
        error: 'Erreur lors de la déconnexion',
        code: 'LOGOUT_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== LOGOUT ALL ====================
  /**
   * POST /api/auth/logout-all
   * Déconnexion de tous les appareils
   */
  router.post('/logout-all', authMiddleware, async (req, res) => {
    try {
      const count = await revokeAllUserTokens(pool, req.user.id, 'logout_all');

      // ✅ AUDIT TRAIL - Logout all devices
      await logAuditTrail(pool, req.user.id, 'logout_all', 'auth', req.user.id, null, {
        email: req.user.email,
        sessionsRevoked: count
      });

      res.json({
        message: 'Déconnexion de tous les appareils réussie',
        code: 'LOGOUT_ALL_SUCCESS',
        sessionsRevoked: count
      });

    } catch (err) {
      console.error('Erreur logout-all:', err);
      res.status(500).json({
        error: 'Erreur lors de la déconnexion',
        code: 'LOGOUT_ALL_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== GET CURRENT USER ====================
  /**
   * GET /api/auth/me
   * Récupérer les informations de l'utilisateur connecté
   */
  router.get('/me', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, email, nom, prenom, role, is_active, last_login, created_at
         FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json(result.rows[0]);

    } catch (err) {
      console.error('Erreur get me:', err);
      res.status(500).json({
        error: 'Erreur lors de la récupération du profil',
        code: 'PROFILE_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== REGISTER (Admin only) ====================
  /**
   * POST /api/auth/register
   * Créer un nouvel utilisateur (admin seulement)
   */
  router.post('/register', authMiddleware, adminOnly, registerLimiter, registerValidation, async (req, res) => {
    const { email, password, nom, prenom, role = 'user' } = req.body;

    try {
      // Vérifier si l'email existe déjà
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: 'Cet email est déjà utilisé',
          code: 'EMAIL_EXISTS'
        });
      }

      // Hasher le mot de passe
      const passwordHash = await bcrypt.hash(password, bcryptConfig.saltRounds);

      // Créer l'utilisateur (utiliser emptyToNull pour prenom)
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, nom, prenom, role, is_active, email_verified)
         VALUES ($1, $2, $3, $4, $5, true, true)
         RETURNING id, email, nom, prenom, role, is_active, created_at`,
        [email, passwordHash, nom, emptyToNull(prenom), role]
      );

      const newUser = result.rows[0];

      // ✅ Audit trail
      await logAuditTrail(pool, req.user.id, 'create', 'user', newUser.id, null, newUser);

      res.status(201).json({
        message: 'Utilisateur créé avec succès',
        code: 'USER_CREATED',
        user: newUser
      });

    } catch (err) {
      console.error('Erreur register:', err);
      res.status(500).json({
        error: 'Erreur lors de la création de l\'utilisateur',
        code: 'REGISTER_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== LIST USERS (Admin only) ====================
  /**
   * GET /api/auth/users
   * Liste des utilisateurs (admin seulement)
   */
  router.get('/users', authMiddleware, adminOnly, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, email, nom, prenom, role, is_active, last_login, created_at
         FROM users
         ORDER BY created_at DESC`
      );

      res.json(result.rows);

    } catch (err) {
      console.error('Erreur list users:', err);
      res.status(500).json({
        error: 'Erreur lors de la récupération des utilisateurs',
        code: 'LIST_USERS_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== GET USER BY ID (Admin only) ====================
  /**
   * GET /api/auth/users/:id
   * Récupérer un utilisateur par son ID (admin seulement)
   */
  router.get('/users/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, email, nom, prenom, role, is_active, email_verified, 
                last_login, failed_login_attempts, locked_until, created_at, updated_at
         FROM users WHERE id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json(result.rows[0]);

    } catch (err) {
      console.error('Erreur get user:', err);
      res.status(500).json({
        error: 'Erreur lors de la récupération de l\'utilisateur',
        code: 'GET_USER_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== UPDATE USER (Admin only) ====================
  /**
   * PUT /api/auth/users/:id
   * Mettre à jour un utilisateur (admin seulement)
   */
  router.put('/users/:id', authMiddleware, adminOnly, updateUserValidation, async (req, res) => {
    const { id } = req.params;
    const { email, nom, prenom, role, is_active } = req.body;

    try {
      // Récupérer les anciennes valeurs pour l'audit
      const oldDataResult = await pool.query(
        'SELECT id, email, nom, prenom, role, is_active FROM users WHERE id = $1',
        [id]
      );

      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
      }

      const oldData = oldDataResult.rows[0];

      // Construire la requête dynamiquement
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (email !== undefined) {
        // Vérifier que l'email n'est pas déjà pris par un autre utilisateur
        const emailCheck = await pool.query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, id]
        );
        if (emailCheck.rows.length > 0) {
          return res.status(409).json({
            error: 'Cet email est déjà utilisé',
            code: 'EMAIL_EXISTS'
          });
        }
        updates.push(`email = $${paramIndex++}`);
        values.push(email);
      }

      if (nom !== undefined) {
        updates.push(`nom = $${paramIndex++}`);
        values.push(nom);
      }

      if (prenom !== undefined) {
        updates.push(`prenom = $${paramIndex++}`);
        values.push(emptyToNull(prenom));
      }

      if (role !== undefined) {
        updates.push(`role = $${paramIndex++}`);
        values.push(role);
      }

      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
        
        // Si désactivation, révoquer tous les tokens
        if (!is_active) {
          await revokeAllUserTokens(pool, id, 'account_disabled');
          await logSecurityEvent(pool, parseInt(id), 'account_disabled', {
            disabledBy: req.user.id,
            reason: 'admin_action'
          });
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'Aucune donnée à mettre à jour',
          code: 'NO_DATA'
        });
      }

      values.push(id);
      const result = await pool.query(
        `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING id, email, nom, prenom, role, is_active, updated_at`,
        values
      );

      const newData = result.rows[0];

      // ✅ Audit trail
      await logAuditTrail(pool, req.user.id, 'update', 'user', parseInt(id), oldData, newData);

      res.json({
        message: 'Utilisateur mis à jour',
        code: 'USER_UPDATED',
        user: newData
      });

    } catch (err) {
      console.error('Erreur update user:', err);
      res.status(500).json({
        error: 'Erreur lors de la mise à jour',
        code: 'UPDATE_USER_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== DELETE USER (Admin only) ====================
  /**
   * DELETE /api/auth/users/:id
   * Supprimer un utilisateur (admin seulement)
   */
  router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;

    try {
      // Empêcher l'auto-suppression
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({
          error: 'Vous ne pouvez pas supprimer votre propre compte',
          code: 'CANNOT_DELETE_SELF'
        });
      }

      // Récupérer les données pour l'audit
      const userData = await pool.query(
        'SELECT id, email, nom, prenom, role FROM users WHERE id = $1',
        [id]
      );

      if (userData.rows.length === 0) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
      }

      const deletedUser = userData.rows[0];

      const result = await pool.query(
        'DELETE FROM users WHERE id = $1 RETURNING id, email',
        [id]
      );

      // ✅ Audit trail
      await logAuditTrail(pool, req.user.id, 'delete', 'user', parseInt(id), deletedUser, null);

      res.json({
        message: 'Utilisateur supprimé',
        code: 'USER_DELETED',
        user: result.rows[0]
      });

    } catch (err) {
      console.error('Erreur delete user:', err);
      res.status(500).json({
        error: 'Erreur lors de la suppression',
        code: 'DELETE_USER_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== CHANGE PASSWORD ====================
  /**
   * POST /api/auth/change-password
   * Changer son mot de passe
   */
  router.post('/change-password', authMiddleware, changePasswordValidation, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
      // Récupérer le hash actuel
      const userResult = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
      }

      // Vérifier le mot de passe actuel
      const passwordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

      if (!passwordValid) {
        return res.status(401).json({
          error: 'Mot de passe actuel incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Hasher le nouveau mot de passe
      const newPasswordHash = await bcrypt.hash(newPassword, bcryptConfig.saltRounds);

      // Mettre à jour
      await pool.query(
        `UPDATE users SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [newPasswordHash, req.user.id]
      );

      // Révoquer tous les autres refresh tokens
      await revokeAllUserTokens(pool, req.user.id, 'password_changed');

      // Security event
      await logSecurityEvent(pool, req.user.id, 'password_changed', {
        changedBy: 'self'
      });

      // ✅ AUDIT TRAIL - Change password (user)
      await logAuditTrail(pool, req.user.id, 'change_password', 'user', req.user.id, null, {
        email: req.user.email,
        changedBy: 'self'
      });

      res.json({ 
        message: 'Mot de passe modifié avec succès',
        code: 'PASSWORD_CHANGED'
      });

    } catch (err) {
      console.error('Erreur change password:', err);
      res.status(500).json({
        error: 'Erreur lors du changement de mot de passe',
        code: 'CHANGE_PASSWORD_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== RESET PASSWORD BY ADMIN ====================
  /**
   * POST /api/auth/users/:id/reset-password
   * Réinitialiser le mot de passe d'un utilisateur (admin)
   */
  router.post('/users/:id/reset-password', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    try {
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({
          error: 'Le mot de passe doit contenir au moins 8 caractères',
          code: 'INVALID_PASSWORD'
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, bcryptConfig.saltRounds);

      const result = await pool.query(
        `UPDATE users SET password_hash = $1, password_changed_at = NOW(), 
         failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
         WHERE id = $2 RETURNING id, email`,
        [passwordHash, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
      }

      // Révoquer tous les refresh tokens
      await revokeAllUserTokens(pool, id, 'admin_reset');

      // Security event
      await logSecurityEvent(pool, parseInt(id), 'password_reset_by_admin', {
        resetBy: req.user.id,
        resetByEmail: req.user.email
      });

      // ✅ AUDIT TRAIL - Reset password by admin
      await logAuditTrail(pool, req.user.id, 'reset_password', 'user', parseInt(id), null, {
        targetEmail: result.rows[0].email,
        resetBy: req.user.email
      });

      res.json({
        message: 'Mot de passe réinitialisé',
        code: 'PASSWORD_RESET',
        user: result.rows[0]
      });

    } catch (err) {
      console.error('Erreur reset password:', err);
      res.status(500).json({
        error: 'Erreur lors de la réinitialisation',
        code: 'RESET_PASSWORD_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== UNLOCK USER (Admin only) ====================
  /**
   * POST /api/auth/users/:id/unlock
   * Déverrouiller un compte utilisateur (admin)
   */
  router.post('/users/:id/unlock', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING id, email`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
      }

      // Security event
      await logSecurityEvent(pool, parseInt(id), 'account_unlocked', {
        unlockedBy: req.user.id,
        unlockedByEmail: req.user.email
      });

      // ✅ AUDIT TRAIL - Unlock account
      await logAuditTrail(pool, req.user.id, 'unlock_account', 'user', parseInt(id), null, {
        targetEmail: result.rows[0].email,
        unlockedBy: req.user.email
      });

      res.json({
        message: 'Compte déverrouillé',
        code: 'ACCOUNT_UNLOCKED',
        user: result.rows[0]
      });

    } catch (err) {
      console.error('Erreur unlock:', err);
      res.status(500).json({
        error: 'Erreur lors du déverrouillage',
        code: 'UNLOCK_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== GET ACTIVE SESSIONS ====================
  /**
   * GET /api/auth/sessions
   * Récupérer les sessions actives de l'utilisateur
   */
  router.get('/sessions', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, device_info, ip_address, created_at, expires_at
         FROM refresh_tokens
         WHERE user_id = $1 AND revoked = false AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      res.json(result.rows);

    } catch (err) {
      console.error('Erreur get sessions:', err);
      res.status(500).json({
        error: 'Erreur lors de la récupération des sessions',
        code: 'GET_SESSIONS_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ==================== REVOKE SESSION ====================
  /**
   * DELETE /api/auth/sessions/:id
   * Révoquer une session spécifique
   */
  router.delete('/sessions/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        `UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'user_revoked'
         WHERE id = $1 AND user_id = $2 RETURNING id, device_info`,
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Session non trouvée',
          code: 'SESSION_NOT_FOUND'
        });
      }

      // ✅ AUDIT TRAIL - Revoke session
      await logAuditTrail(pool, req.user.id, 'revoke_session', 'auth', parseInt(id), null, {
        email: req.user.email,
        sessionId: id,
        deviceInfo: result.rows[0].device_info
      });

      res.json({ 
        message: 'Session révoquée',
        code: 'SESSION_REVOKED'
      });

    } catch (err) {
      console.error('Erreur revoke session:', err);
      res.status(500).json({
        error: 'Erreur lors de la révocation',
        code: 'REVOKE_SESSION_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  return router;
};

module.exports = createAuthRoutes;
