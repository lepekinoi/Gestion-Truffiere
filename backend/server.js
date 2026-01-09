// ============================================================
// server.js - API Truffière avec Authentification JWT
// Version 2.0.0 - Système d'authentification complet
// ============================================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

// ============================================================
// CONFIGURATION
// ============================================================

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGEZ_MOI_EN_PRODUCTION_minimum_64_caracteres_de_securite';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 7;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// Configuration base de données
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'truffiere',
  user: process.env.DB_USER || 'unstuffed1004',
  password: process.env.DB_PASSWORD || 'WeR87fFC8SN5IJUGz4w6Tl87t1Fm2840GepKl82Xe666J0D7hD',
});

// Test de connexion à la base de données
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur de connexion à la base de données:', err.stack);
  } else {
    console.log('✅ Connecté à la base de données PostgreSQL');
    release();
  }
});

// ============================================================
// MIDDLEWARES GLOBAUX
// ============================================================

// Sécurité HTTP headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuré
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://m-a-truffes.sytes.net',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Parser JSON et cookies
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Logging
app.use(morgan('dev'));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Trop de requêtes', code: 'RATE_LIMIT' }
});
app.use(globalLimiter);

// Rate limiting pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion', code: 'AUTH_RATE_LIMIT' },
  skipSuccessfulRequests: true
});

// ============================================================
// FONCTIONS UTILITAIRES AUTH
// ============================================================

// Générer un token d'accès JWT
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, nom: user.nom },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Générer un refresh token
const generateRefreshToken = () => {
  const token = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
  return { token, hash, expiresAt };
};

// Hash un refresh token
const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
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
// MIDDLEWARE D'AUTHENTIFICATION
// ============================================================

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

// Middleware pour vérifier les permissions d'écriture
const requireWriteAccess = (req, res, next) => {
  if (req.user && req.user.role === 'readonly') {
    return res.status(403).json({ error: 'Accès en lecture seule', code: 'READONLY' });
  }
  next();
};

// ============================================================
// ROUTES PUBLIQUES (sans authentification)
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API Truffière fonctionnelle',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// ROUTES D'AUTHENTIFICATION
// ============================================================

// POST /api/auth/login - Connexion
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis', code: 'MISSING_FIELDS' });
    }

    // Vérifier le verrouillage du compte
    const lockCheck = await pool.query(
      'SELECT locked_until, failed_login_attempts FROM users WHERE email = $1',
      [email]
    );

    if (lockCheck.rows.length > 0 && lockCheck.rows[0].locked_until) {
      if (new Date(lockCheck.rows[0].locked_until) > new Date()) {
        await logLoginAttempt(email, clientIp, userAgent, false, 'account_locked');
        return res.status(423).json({
          error: 'Compte temporairement verrouillé',
          code: 'ACCOUNT_LOCKED',
          lockedUntil: lockCheck.rows[0].locked_until
        });
      }
    }

    // Rechercher l'utilisateur
    const userResult = await pool.query(
      'SELECT id, email, password_hash, nom, prenom, role, is_active FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      await logLoginAttempt(email, clientIp, userAgent, false, 'invalid_email');
      return res.status(401).json({ error: 'Email ou mot de passe incorrect', code: 'INVALID_CREDENTIALS' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      await logLoginAttempt(email, clientIp, userAgent, false, 'account_inactive');
      return res.status(403).json({ error: 'Compte désactivé', code: 'ACCOUNT_DISABLED' });
    }

    // Vérifier le mot de passe
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      await logLoginAttempt(email, clientIp, userAgent, false, 'invalid_password');
      
      // Incrémenter les échecs
      const failures = (lockCheck.rows[0]?.failed_login_attempts || 0) + 1;
      if (failures >= 5) {
        await pool.query(
          "UPDATE users SET failed_login_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE email = $2",
          [failures, email]
        );
      } else {
        await pool.query(
          'UPDATE users SET failed_login_attempts = $1 WHERE email = $2',
          [failures, email]
        );
      }
      
      return res.status(401).json({ error: 'Email ou mot de passe incorrect', code: 'INVALID_CREDENTIALS' });
    }

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, hash: refreshTokenHash, expiresAt } = generateRefreshToken();

    // Sauvegarder le refresh token
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [user.id, refreshTokenHash, userAgent.substring(0, 255), clientIp, expiresAt]
    );

    // Réinitialiser les échecs
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
      [user.id]
    );

    await logLoginAttempt(email, clientIp, userAgent, true, null);

    res.json({
      message: 'Connexion réussie',
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRES_IN,
      user: { id: user.id, email: user.email, nom: user.nom, prenom: user.prenom, role: user.role }
    });

  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion', code: 'LOGIN_ERROR' });
  }
});

// POST /api/auth/refresh - Rafraîchir le token
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requis', code: 'MISSING_TOKEN' });
    }

    const tokenHash = hashRefreshToken(refreshToken);

    const tokenResult = await pool.query(
      `SELECT rt.*, u.id as user_id, u.email, u.nom, u.prenom, u.role, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1 AND rt.revoked = false AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Token invalide ou expiré', code: 'INVALID_REFRESH_TOKEN' });
    }

    const tokenData = tokenResult.rows[0];

    if (!tokenData.is_active) {
      await pool.query(
        "UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'account_disabled' WHERE id = $1",
        [tokenData.id]
      );
      return res.status(403).json({ error: 'Compte désactivé', code: 'ACCOUNT_DISABLED' });
    }

    const accessToken = generateAccessToken({
      id: tokenData.user_id,
      email: tokenData.email,
      nom: tokenData.nom,
      role: tokenData.role
    });

    res.json({ accessToken, expiresIn: JWT_EXPIRES_IN });

  } catch (err) {
    console.error('Erreur refresh:', err);
    res.status(500).json({ error: 'Erreur lors du rafraîchissement', code: 'REFRESH_ERROR' });
  }
});

// POST /api/auth/logout - Déconnexion
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await pool.query(
        "UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'logout' WHERE token_hash = $1 AND user_id = $2",
        [tokenHash, req.user.id]
      );
    }
    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    console.error('Erreur logout:', err);
    res.status(500).json({ error: 'Erreur lors de la déconnexion', code: 'LOGOUT_ERROR' });
  }
});

// POST /api/auth/logout-all - Déconnexion de tous les appareils
app.post('/api/auth/logout-all', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE refresh_tokens SET revoked = true, revoked_at = NOW(), revoked_reason = 'logout_all' WHERE user_id = $1 AND revoked = false RETURNING id",
      [req.user.id]
    );
    res.json({ message: 'Déconnexion de tous les appareils', sessionsRevoked: result.rows.length });
  } catch (err) {
    console.error('Erreur logout-all:', err);
    res.status(500).json({ error: 'Erreur', code: 'LOGOUT_ALL_ERROR' });
  }
});

// GET /api/auth/me - Profil utilisateur
app.get('/api/auth/me', authMiddleware, async (req, res) => {
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
app.post('/api/auth/register', authMiddleware, requireRole('admin'), async (req, res) => {
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
app.get('/api/auth/users', authMiddleware, requireRole('admin'), async (req, res) => {
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

// GET /api/auth/users/:id - Détails utilisateur (admin)
app.get('/api/auth/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
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

// PUT /api/auth/users/:id - Modifier utilisateur (admin)
app.put('/api/auth/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { email, nom, prenom, role, is_active } = req.body;

  try {
    const updates = [];
    const values = [];
    let idx = 1;

    if (email !== undefined) {
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Email déjà utilisé', code: 'EMAIL_EXISTS' });
      }
      updates.push(`email = $${idx++}`);
      values.push(email);
    }
    if (nom !== undefined) { updates.push(`nom = $${idx++}`); values.push(nom); }
    if (prenom !== undefined) { updates.push(`prenom = $${idx++}`); values.push(prenom); }
    if (role !== undefined) { updates.push(`role = $${idx++}`); values.push(role); }
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

// DELETE /api/auth/users/:id - Supprimer utilisateur (admin)
app.delete('/api/auth/users/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Impossible de supprimer votre propre compte', code: 'CANNOT_DELETE_SELF' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json({ message: 'Utilisateur supprimé', user: result.rows[0] });
  } catch (err) {
    console.error('Erreur delete user:', err);
    res.status(500).json({ error: 'Erreur', code: 'DELETE_USER_ERROR' });
  }
});

// POST /api/auth/change-password - Changer son mot de passe
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mots de passe requis', code: 'MISSING_FIELDS' });
    }

    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    const passwordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect', code: 'INVALID_PASSWORD' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    // Révoquer tous les refresh tokens
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

// POST /api/auth/users/:id/reset-password - Reset mot de passe (admin)
app.post('/api/auth/users/:id/reset-password', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Mot de passe invalide (min 8 caractères)', code: 'INVALID_PASSWORD' });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
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

// POST /api/auth/users/:id/unlock - Déverrouiller compte (admin)
app.post('/api/auth/users/:id/unlock', authMiddleware, requireRole('admin'), async (req, res) => {
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

// GET /api/auth/sessions - Voir ses sessions actives
app.get('/api/auth/sessions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, device_info, ip_address, created_at, expires_at FROM refresh_tokens WHERE user_id = $1 AND revoked = false AND expires_at > NOW() ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur get sessions:', err);
    res.status(500).json({ error: 'Erreur', code: 'GET_SESSIONS_ERROR' });
  }
});

// DELETE /api/auth/sessions/:id - Révoquer une session
app.delete('/api/auth/sessions/:id', authMiddleware, async (req, res) => {
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

// ============================================================
// MIDDLEWARE D'AUTHENTIFICATION POUR ROUTES PROTÉGÉES
// ============================================================

// Toutes les routes /api/* suivantes nécessitent une authentification
app.use('/api', (req, res, next) => {
  // Skip les routes publiques
  if (req.path.startsWith('/auth') || req.path === '/health') {
    return next();
  }
  authMiddleware(req, res, next);
});

// ==================== ROUTES HISTORIQUE ====================
app.get('/api/historique', async (req, res) => {
  try {
    const { table_name, start_date, end_date, action, limit = 500 } = req.query;
    
    let query = `
      SELECT h.*, 
             COALESCE(h.new_data->>'nom', h.new_data->>'numero', h.old_data->>'nom', h.old_data->>'numero', 'ID: ' || h.record_id::text) as item_name
      FROM historique h
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (table_name && table_name !== 'all') {
      query += ` AND h.table_name = $${paramIndex}`;
      params.push(table_name);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND h.timestamp >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND h.timestamp <= $${paramIndex}`;
      params.push(end_date + ' 23:59:59');
      paramIndex++;
    }
    
    if (action && action !== 'all') {
      query += ` AND h.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }
    
    query += ` ORDER BY h.timestamp DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

app.delete('/api/historique/purge', requireWriteAccess, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès admin requis' });
    }
    
    const { period, table_name, custom_date } = req.body;
    
    let deleteQuery = 'DELETE FROM historique WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (period === 'year') {
      deleteQuery += ` AND timestamp < NOW() - INTERVAL '1 year'`;
    } else if (period === 'month') {
      deleteQuery += ` AND timestamp < NOW() - INTERVAL '1 month'`;
    } else if (period === '6months') {
      deleteQuery += ` AND timestamp < NOW() - INTERVAL '6 months'`;
    } else if (period === 'custom' && custom_date) {
      deleteQuery += ` AND timestamp < $${paramIndex}`;
      params.push(custom_date);
      paramIndex++;
    }
    
    if (table_name && table_name !== 'all') {
      deleteQuery += ` AND table_name = $${paramIndex}`;
      params.push(table_name);
      paramIndex++;
    }
    
    deleteQuery += ' RETURNING id';
    
    const result = await pool.query(deleteQuery, params);
    res.json({ message: 'Purge effectuée', deleted_count: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la purge' });
  }
});

app.get('/api/historique/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name, action, COUNT(*) as count
      FROM historique
      GROUP BY table_name, action
      ORDER BY table_name, action
    `);
    
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM historique');
    const oldestResult = await pool.query('SELECT MIN(timestamp) as oldest FROM historique');
    
    res.json({
      stats: result.rows,
      total: parseInt(totalResult.rows[0].total),
      oldest: oldestResult.rows[0].oldest
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES CAVEURS ====================
app.get('/api/caveurs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM caveurs ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des caveurs' });
  }
});

app.post('/api/caveurs', requireWriteAccess, async (req, res) => {
  try {
    const { nom } = req.body;
    const result = await pool.query('INSERT INTO caveurs (nom) VALUES ($1) RETURNING *', [nom]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création du caveur' });
  }
});

app.put('/api/caveurs/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { nom } = req.body;
    const result = await pool.query('UPDATE caveurs SET nom = $1 WHERE id = $2 RETURNING *', [nom, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caveur non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.delete('/api/caveurs/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM caveurs WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caveur non trouvé' });
    }
    res.json({ message: 'Caveur supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES CHIENS ====================
app.get('/api/chiens', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM chiens ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des chiens' });
  }
});

app.post('/api/chiens', requireWriteAccess, async (req, res) => {
  try {
    const { nom, race } = req.body;
    const result = await pool.query('INSERT INTO chiens (nom, race) VALUES ($1, $2) RETURNING *', [nom, race || null]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création du chien' });
  }
});

app.put('/api/chiens/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, race } = req.body;
    const result = await pool.query('UPDATE chiens SET nom = $1, race = $2 WHERE id = $3 RETURNING *', [nom, race || null, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chien non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.delete('/api/chiens/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM chiens WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chien non trouvé' });
    }
    res.json({ message: 'Chien supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES PARCELLES ====================
app.get('/api/parcelles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nom, surface_ha, type_sol, ph_sol, exposition, notes, date_creation,
             ST_AsGeoJSON(geometrie) as geojson
      FROM parcelles ORDER BY nom
    `);
    
    const parcelles = result.rows.map(p => {
      let coordinates = [];
      if (p.geojson) {
        try {
          const geo = JSON.parse(p.geojson);
          if (geo.type === 'Polygon' && geo.coordinates && geo.coordinates[0]) {
            coordinates = geo.coordinates[0].map(coord => [coord[1], coord[0]]);
            if (coordinates.length > 0) coordinates.pop();
          }
        } catch (e) {
          console.error('Erreur parsing GeoJSON:', e);
        }
      }
      return {
        id: p.id, nom: p.nom, surface_ha: p.surface_ha, type_sol: p.type_sol,
        ph_sol: p.ph_sol, exposition: p.exposition, notes: p.notes,
        date_creation: p.date_creation, coordinates: coordinates
      };
    });
    
    res.json(parcelles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des parcelles' });
  }
});

app.get('/api/parcelles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM parcelles WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/parcelles', requireWriteAccess, async (req, res) => {
  try {
    const { nom, surface_ha, type_sol, ph_sol, exposition, notes, coordinates } = req.body;
    
    let query, params;
    
    if (coordinates && coordinates.length > 0) {
      const coordsString = coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(', ');
      const polygonWKT = `POLYGON((${coordsString}, ${coordinates[0][1]} ${coordinates[0][0]}))`;
      
      query = `INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, exposition, notes, geometrie) 
               VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromText($7, 4326)) RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, exposition, notes, polygonWKT];
    } else {
      query = 'INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, exposition, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
      params = [nom, surface_ha, type_sol, ph_sol, exposition, notes];
    }
    
    const result = await pool.query(query, params);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de la parcelle' });
  }
});

app.put('/api/parcelles/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, surface_ha, type_sol, ph_sol, exposition, notes, coordinates, deleteGeometry } = req.body;
    
    let query, params;
    
    if (deleteGeometry === true) {
      query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
               exposition = $5, notes = $6, geometrie = NULL WHERE id = $7 RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, exposition, notes, id];
    } else if (coordinates && coordinates.length > 0) {
      const coordsString = coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(', ');
      const polygonWKT = `POLYGON((${coordsString}, ${coordinates[0][1]} ${coordinates[0][0]}))`;
      
      query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
               exposition = $5, notes = $6, geometrie = ST_GeomFromText($7, 4326) WHERE id = $8 RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, exposition, notes, polygonWKT, id];
    } else {
      query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
               exposition = $5, notes = $6 WHERE id = $7 RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, exposition, notes, id];
    }
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.delete('/api/parcelles/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM parcelles WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvée' });
    }
    res.json({ message: 'Parcelle supprimée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES ARBRES ====================
app.get('/api/arbres', async (req, res) => {
  try {
    const { includeDeleted } = req.query;
    let query = `
      SELECT a.*, p.nom as parcelle_nom
      FROM arbres a
      LEFT JOIN parcelles p ON a.parcelle_id = p.id
    `;
    
    if (includeDeleted !== 'true') {
      query += ' WHERE a.deleted_at IS NULL';
    }
    
    query += ' ORDER BY a.numero';
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des arbres' });
  }
});

app.get('/api/arbres/corbeille', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, p.nom as parcelle_nom
      FROM arbres a
      LEFT JOIN parcelles p ON a.parcelle_id = p.id
      WHERE a.deleted_at IS NOT NULL
      ORDER BY a.deleted_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/arbres', requireWriteAccess, async (req, res) => {
  try {
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, latitude, longitude, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO arbres (parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, latitude, longitude, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [parcelle_id, numero, espece, variete_truffe, date_plantation, etat || 'Bon', circonference_cm, hauteur_m, latitude || null, longitude || null, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'arbre' });
  }
});

app.put('/api/arbres/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, date_derniere_taille, latitude, longitude, notes } = req.body;
    const result = await pool.query(
      `UPDATE arbres SET parcelle_id = $1, numero = $2, espece = $3, variete_truffe = $4, 
       date_plantation = $5, etat = $6, circonference_cm = $7, hauteur_m = $8, 
       date_derniere_taille = $9, latitude = $10, longitude = $11, notes = $12
       WHERE id = $13 AND deleted_at IS NULL RETURNING *`,
      [parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, date_derniere_taille, latitude || null, longitude || null, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.delete('/api/arbres/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE arbres SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé' });
    }
    res.json({ message: 'Arbre mis à la corbeille', arbre: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/arbres/corbeille/:id/restaurer', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE arbres SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé dans la corbeille' });
    }
    res.json({ message: 'Arbre restauré', arbre: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.delete('/api/arbres/corbeille/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM arbres WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé dans la corbeille' });
    }
    res.json({ message: 'Arbre supprimé définitivement', arbre: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.delete('/api/arbres/corbeille', requireWriteAccess, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM arbres WHERE deleted_at IS NOT NULL RETURNING id');
    res.json({ message: 'Corbeille vidée', count: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES TYPES INTERVENTION ====================
app.get('/api/types-intervention', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM types_intervention ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES INTERVENTIONS ====================
app.get('/api/interventions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, t.nom as type_nom, p.nom as parcelle_nom, a.numero as arbre_numero
      FROM interventions i
      LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
      LEFT JOIN parcelles p ON i.parcelle_id = p.id
      LEFT JOIN arbres a ON i.arbre_id = a.id
      ORDER BY i.date_prevue DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.get('/api/interventions/check-doublon', async (req, res) => {
  try {
    const { arbre_id, type_intervention_id, date_prevue, exclude_id } = req.query;
    
    let query = `SELECT COUNT(*) as count FROM interventions WHERE arbre_id = $1 AND type_intervention_id = $2 AND date_prevue = $3`;
    const params = [arbre_id, type_intervention_id, date_prevue];
    
    if (exclude_id) {
      query += ' AND id != $4';
      params.push(exclude_id);
    }
    
    const result = await pool.query(query, params);
    res.json({ exists: parseInt(result.rows[0].count) > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/interventions', requireWriteAccess, async (req, res) => {
  try {
    const { type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee, duree_minutes, personnel, description, cout, statut, meteo, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO interventions (type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee, duree_minutes, personnel, description, cout, statut, meteo, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [type_intervention_id, parcelle_id || null, arbre_id || null, date_prevue, date_realisee || null, duree_minutes || null, personnel, description, cout || null, statut || 'Planifié', meteo, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

app.put('/api/interventions/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee, duree_minutes, personnel, description, cout, statut, meteo, notes } = req.body;
    const result = await pool.query(
      `UPDATE interventions SET type_intervention_id = $1, parcelle_id = $2, arbre_id = $3, date_prevue = $4, 
       date_realisee = $5, duree_minutes = $6, personnel = $7, description = $8, cout = $9, statut = $10,
       meteo = $11, notes = $12 WHERE id = $13 RETURNING *`,
      [type_intervention_id, parcelle_id || null, arbre_id || null, date_prevue, date_realisee || null, duree_minutes || null, personnel, description, cout || null, statut, meteo, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.delete('/api/interventions/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM interventions WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }
    res.json({ message: 'Intervention supprimée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES RECOLTES ====================
app.get('/api/recoltes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, p.nom as parcelle_nom, a.numero as arbre_numero
      FROM recoltes r
      LEFT JOIN parcelles p ON r.parcelle_id = p.id
      LEFT JOIN arbres a ON r.arbre_id = a.id
      ORDER BY r.date_recolte DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/recoltes', requireWriteAccess, async (req, res) => {
  try {
    const { parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, conditions_meteo, temperature_sol, caveur, chien, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO recoltes (parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, conditions_meteo, temperature_sol, caveur, chien, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [parcelle_id || null, arbre_id || null, date_recolte, poids_grammes, qualite || null, calibre || null, maturite || null, profondeur_cm || null, conditions_meteo || null, temperature_sol || null, caveur || null, chien || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

app.put('/api/recoltes/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, conditions_meteo, temperature_sol, caveur, chien, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE recoltes SET parcelle_id = $1, arbre_id = $2, date_recolte = $3, poids_grammes = $4,
        qualite = $5, calibre = $6, maturite = $7, profondeur_cm = $8, conditions_meteo = $9,
        temperature_sol = $10, caveur = $11, chien = $12, notes = $13 WHERE id = $14 RETURNING *`,
      [parcelle_id || null, arbre_id || null, date_recolte, poids_grammes, qualite || null, calibre || null, maturite || null, profondeur_cm || null, conditions_meteo || null, temperature_sol || null, caveur || null, chien || null, notes || null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Récolte non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.delete('/api/recoltes/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM recoltes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Récolte non trouvée' });
    }
    res.json({ message: 'Récolte supprimée', recolte: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES CLIENTS ====================
app.get('/api/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY nom, raison_sociale');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.get('/api/clients/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    const commandesResult = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(montant_total), 0) as total FROM commandes WHERE client_id = $1',
      [id]
    );
    
    const ventesResult = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(montant_total), 0) as total FROM ventes WHERE client_id = $1',
      [id]
    );
    
    res.json({
      commandes: { count: parseInt(commandesResult.rows[0].count), total: parseFloat(commandesResult.rows[0].total) },
      ventes: { count: parseInt(ventesResult.rows[0].count), total: parseFloat(ventesResult.rows[0].total) }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.get('/api/clients/stats/by-type', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.type, COUNT(DISTINCT c.id) as nb_clients,
             COALESCE(SUM(cmd.montant_total), 0) as total_commandes,
             COALESCE(SUM(v.montant_total), 0) as total_ventes
      FROM clients c
      LEFT JOIN commandes cmd ON c.id = cmd.client_id
      LEFT JOIN ventes v ON c.id = v.client_id
      GROUP BY c.type
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/clients', requireWriteAccess, async (req, res) => {
  try {
    const { type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO clients (type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [type || 'Particulier', nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays || 'France', siret, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

app.put('/api/clients/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes } = req.body;
    const result = await pool.query(
      `UPDATE clients SET type = $1, nom = $2, prenom = $3, raison_sociale = $4, email = $5,
       telephone = $6, adresse = $7, code_postal = $8, ville = $9, pays = $10, siret = $11, notes = $12
       WHERE id = $13 RETURNING *`,
      [type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.delete('/api/clients/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }
    res.json({ message: 'Client supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES VENTES ====================
app.get('/api/ventes', async (req, res) => {
  try {
    const { client_id, recolte_id } = req.query;
    
    let query = `
      SELECT v.*, c.type as client_type, c.nom as client_nom, c.prenom as client_prenom, c.raison_sociale,
             r.date_recolte, r.poids_grammes as recolte_poids, a.numero as arbre_numero
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN recoltes r ON v.recolte_id = r.id
      LEFT JOIN arbres a ON r.arbre_id = a.id
    `;
    
    const conditions = [];
    const params = [];
    let idx = 1;
    
    if (client_id) { conditions.push(`v.client_id = $${idx++}`); params.push(client_id); }
    if (recolte_id) { conditions.push(`v.recolte_id = $${idx++}`); params.push(recolte_id); }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY v.date_vente DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/ventes', requireWriteAccess, async (req, res) => {
  try {
    const { client_id, recolte_id, commande_id, date_vente, quantite_grammes, prix_unitaire_kg, mode_paiement, statut, numero_facture, notes } = req.body;
    
    const montant_total = quantite_grammes && prix_unitaire_kg 
      ? (parseFloat(quantite_grammes) / 1000) * parseFloat(prix_unitaire_kg) 
      : 0;
    
    const result = await pool.query(
      `INSERT INTO ventes (client_id, recolte_id, commande_id, date_vente, quantite_grammes, prix_unitaire_kg, montant_total, mode_paiement, statut, numero_facture, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [client_id, recolte_id || null, commande_id || null, date_vente, quantite_grammes, prix_unitaire_kg || null, montant_total, mode_paiement, statut || 'En attente', numero_facture, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

app.put('/api/ventes/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { client_id, recolte_id, commande_id, date_vente, quantite_grammes, prix_unitaire_kg, mode_paiement, statut, numero_facture, notes } = req.body;
    
    const montant_total = quantite_grammes && prix_unitaire_kg 
      ? (parseFloat(quantite_grammes) / 1000) * parseFloat(prix_unitaire_kg) 
      : 0;
    
    const result = await pool.query(
      `UPDATE ventes SET client_id = $1, recolte_id = $2, commande_id = $3, date_vente = $4, quantite_grammes = $5,
       prix_unitaire_kg = $6, montant_total = $7, mode_paiement = $8, statut = $9, numero_facture = $10, notes = $11
       WHERE id = $12 RETURNING *`,
      [client_id, recolte_id || null, commande_id || null, date_vente, quantite_grammes, prix_unitaire_kg || null, montant_total, mode_paiement, statut, numero_facture, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.delete('/api/ventes/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM ventes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }
    res.json({ message: 'Vente supprimée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES COMMANDES ====================
app.get('/api/commandes', async (req, res) => {
  try {
    const { client_id } = req.query;
    
    let query = `
      SELECT c.*, cl.type as client_type, cl.nom as client_nom, cl.prenom as client_prenom, cl.raison_sociale
      FROM commandes c
      LEFT JOIN clients cl ON c.client_id = cl.id
    `;
    
    if (client_id) {
      query += ' WHERE c.client_id = $1 ORDER BY c.date_commande DESC';
      const result = await pool.query(query, [client_id]);
      return res.json(result.rows);
    }
    
    query += ' ORDER BY c.date_commande DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.get('/api/commandes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*, cl.type as client_type, cl.nom as client_nom, cl.prenom as client_prenom, 
             cl.raison_sociale, cl.email, cl.telephone, cl.adresse, cl.code_postal, cl.ville
      FROM commandes c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/commandes', requireWriteAccess, async (req, res) => {
  try {
    const { client_id, date_commande, date_livraison_demandee, poids_grammes, calibre, qualite, maturite, prix_unitaire_kg, statut, notes } = req.body;
    
    const year = new Date().getFullYear();
    const countResult = await pool.query('SELECT COUNT(*) FROM commandes WHERE EXTRACT(YEAR FROM date_commande) = $1', [year]);
    const count = parseInt(countResult.rows[0].count) + 1;
    const numero_commande = `CMD-${year}-${String(count).padStart(4, '0')}`;
    
    const poidsGrammesVal = poids_grammes === '' || poids_grammes === null || poids_grammes === undefined ? null : poids_grammes;
    const prixUnitaireKgVal = prix_unitaire_kg === '' || prix_unitaire_kg === null || prix_unitaire_kg === undefined ? null : prix_unitaire_kg;
    
    const montant_total = poidsGrammesVal && prixUnitaireKgVal 
      ? (parseFloat(poidsGrammesVal) / 1000) * parseFloat(prixUnitaireKgVal) 
      : null;
    
    const result = await pool.query(
      `INSERT INTO commandes (client_id, numero_commande, date_commande, date_livraison_demandee, poids_grammes, calibre, qualite, maturite, prix_unitaire_kg, montant_total, statut, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [client_id || null, numero_commande, date_commande, date_livraison_demandee || null, poidsGrammesVal, calibre || null, qualite || null, maturite || null, prixUnitaireKgVal, montant_total, statut || 'En attente', notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

app.put('/api/commandes/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { client_id, date_commande, date_livraison_demandee, poids_grammes, calibre, qualite, maturite, prix_unitaire_kg, statut, notes } = req.body;
    
    const poidsGrammesVal = poids_grammes === '' || poids_grammes === null || poids_grammes === undefined ? null : poids_grammes;
    const prixUnitaireKgVal = prix_unitaire_kg === '' || prix_unitaire_kg === null || prix_unitaire_kg === undefined ? null : prix_unitaire_kg;
    
    const montant_total = poidsGrammesVal && prixUnitaireKgVal 
      ? (parseFloat(poidsGrammesVal) / 1000) * parseFloat(prixUnitaireKgVal) 
      : null;
    
    const result = await pool.query(
      `UPDATE commandes SET client_id = $1, date_commande = $2, date_livraison_demandee = $3, 
       poids_grammes = $4, calibre = $5, qualite = $6, maturite = $7, prix_unitaire_kg = $8, 
       montant_total = $9, statut = $10, notes = $11 WHERE id = $12 RETURNING *`,
      [client_id || null, date_commande, date_livraison_demandee || null, poidsGrammesVal, calibre || null, qualite || null, maturite || null, prixUnitaireKgVal, montant_total, statut, notes || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.delete('/api/commandes/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM commandes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    res.json({ message: 'Commande supprimée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/commandes/:id/creer-vente', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    
    const commandeResult = await pool.query('SELECT * FROM commandes WHERE id = $1', [id]);
    if (commandeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    
    const commande = commandeResult.rows[0];
    
    const venteExistante = await pool.query('SELECT id FROM ventes WHERE commande_id = $1', [id]);
    if (venteExistante.rows.length > 0) {
      return res.status(400).json({ error: 'Une vente existe déjà pour cette commande' });
    }
    
    const year = new Date().getFullYear();
    const countResult = await pool.query('SELECT COUNT(*) FROM ventes WHERE numero_facture LIKE $1', [`FACT-${year}%`]);
    const count = parseInt(countResult.rows[0].count) + 1;
    const numero_facture = `FACT-${year}-${String(count).padStart(3, '0')}`;
    
    const venteResult = await pool.query(
      `INSERT INTO ventes (client_id, commande_id, date_vente, quantite_grammes, prix_unitaire_kg, montant_total, mode_paiement, statut, numero_facture, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [commande.client_id, commande.id, new Date().toISOString().split('T')[0], commande.poids_grammes, commande.prix_unitaire_kg, commande.montant_total, '', 'En attente', numero_facture, `Vente créée depuis commande ${commande.numero_commande}`]
    );
    
    res.status(201).json(venteResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de la vente' });
  }
});

// ==================== ROUTES PARAMETRES ====================
app.get('/api/parametres', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parametres ORDER BY cle');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.get('/api/parametres/:cle', async (req, res) => {
  try {
    const { cle } = req.params;
    const result = await pool.query('SELECT * FROM parametres WHERE cle = $1', [cle]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paramètre non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.put('/api/parametres/:cle', requireWriteAccess, async (req, res) => {
  try {
    const { cle } = req.params;
    const { valeur } = req.body;
    const result = await pool.query(
      'UPDATE parametres SET valeur = $1 WHERE cle = $2 RETURNING *',
      [valeur, cle]
    );
    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        'INSERT INTO parametres (cle, valeur) VALUES ($1, $2) RETURNING *',
        [cle, valeur]
      );
      return res.json(insertResult.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.post('/api/parametres/reset', requireWriteAccess, async (req, res) => {
  try {
    const defaults = {
      'colonnes_affichees_parcelles': '["nom", "surface_ha", "type_sol", "ph_sol", "exposition", "date_creation"]',
      'colonnes_affichees_arbres': '["numero", "espece", "variete_truffe", "parcelle_nom", "etat", "date_plantation", "circonference_cm"]',
      'colonnes_affichees_interventions': '["date_prevue", "type_nom", "parcelle_nom", "arbre_numero", "statut", "personnel", "cout"]',
      'colonnes_affichees_recoltes': '["date_recolte", "parcelle_nom", "arbre_numero", "poids_grammes", "qualite", "calibre", "caveur"]',
      'colonnes_affichees_clients': '["nom", "type", "email", "telephone", "ville"]',
      'colonnes_affichees_ventes': '["date_vente", "client_nom", "quantite_grammes", "prix_unitaire_kg", "montant_total", "statut"]'
    };
    
    for (const [cle, valeur] of Object.entries(defaults)) {
      await pool.query(
        'INSERT INTO parametres (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO UPDATE SET valeur = $2',
        [cle, valeur]
      );
    }
    
    res.json({ message: 'Paramètres réinitialisés' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES PREFERENCES UTILISATEUR ====================
app.get('/api/preferences-utilisateur', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id || 'default';
    const result = await pool.query('SELECT * FROM preferences_utilisateur WHERE user_id = $1', [userId.toString()]);
    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        'INSERT INTO preferences_utilisateur (user_id, colonnes_affichees, colonnes_export) VALUES ($1, $2, $3) RETURNING *',
        [userId.toString(), '{}', '{}']
      );
      return res.json(insertResult.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.put('/api/preferences-utilisateur', requireWriteAccess, async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id || 'default';
    const { colonnes_affichees, colonnes_export } = req.body;
    
    const result = await pool.query(
      `INSERT INTO preferences_utilisateur (user_id, colonnes_affichees, colonnes_export) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO UPDATE SET colonnes_affichees = $2, colonnes_export = $3 
       RETURNING *`,
      [userId.toString(), JSON.stringify(colonnes_affichees || {}), JSON.stringify(colonnes_export || {})]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/preferences-utilisateur/reset', requireWriteAccess, async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id || 'default';
    const result = await pool.query(
      'UPDATE preferences_utilisateur SET colonnes_affichees = $1, colonnes_export = $2 WHERE user_id = $3 RETURNING *',
      ['{}', '{}', userId.toString()]
    );
    res.json(result.rows[0] || { message: 'Préférences réinitialisées' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES STATISTIQUES ====================
app.get('/api/stats/dashboard', async (req, res) => {
  try {
    const parcelles = await pool.query('SELECT COUNT(*) as count, SUM(surface_ha) as surface FROM parcelles');
    const arbres = await pool.query('SELECT COUNT(*) as count FROM arbres WHERE deleted_at IS NULL');
    const arbresParEtat = await pool.query('SELECT etat, COUNT(*) as count FROM arbres WHERE deleted_at IS NULL GROUP BY etat');
    
    const recoltesSaison = await pool.query(`
      SELECT SUM(poids_grammes) as total_grammes, COUNT(*) as count
      FROM recoltes WHERE date_recolte >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '3 months'
    `);
    
    const ventesMois = await pool.query(`
      SELECT SUM(montant_total) as chiffre_affaires, COUNT(*) as count
      FROM ventes WHERE date_vente >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    
    const interventionsAVenir = await pool.query(`
      SELECT COUNT(*) as count FROM interventions WHERE date_prevue >= CURRENT_DATE AND statut = 'Planifié'
    `);
    
    const commandesEnCours = await pool.query(`
      SELECT COUNT(*) as count FROM commandes WHERE statut IN ('En attente', 'Confirmée', 'En préparation')
    `);

    res.json({
      parcelles: { count: parseInt(parcelles.rows[0].count), surface: parseFloat(parcelles.rows[0].surface) || 0 },
      arbres: { count: parseInt(arbres.rows[0].count), parEtat: arbresParEtat.rows },
      recoltes: { totalGrammes: parseFloat(recoltesSaison.rows[0].total_grammes) || 0, count: parseInt(recoltesSaison.rows[0].count) },
      ventes: { chiffreAffaires: parseFloat(ventesMois.rows[0].chiffre_affaires) || 0, count: parseInt(ventesMois.rows[0].count) },
      interventions: { aVenir: parseInt(interventionsAVenir.rows[0].count) },
      commandes: { enCours: parseInt(commandesEnCours.rows[0].count) }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.get('/api/stats/recoltes-annuelles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT EXTRACT(YEAR FROM date_recolte) as annee,
             SUM(poids_grammes) as total_grammes,
             COUNT(*) as nombre_recoltes
      FROM recoltes
      GROUP BY EXTRACT(YEAR FROM date_recolte)
      ORDER BY annee DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.get('/api/stats/recoltes-mensuelles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT TO_CHAR(date_recolte, 'YYYY-MM') as mois,
             SUM(poids_grammes) as total_grammes,
             COUNT(*) as nombre_recoltes
      FROM recoltes
      WHERE date_recolte >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year'
      GROUP BY TO_CHAR(date_recolte, 'YYYY-MM')
      ORDER BY mois
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTE DASHBOARD CONSOLIDÉE ====================
app.get('/api/dashboard/full', async (req, res) => {
  try {
    const [
      parcellesStats, arbresCount, arbresParEtat, recoltesSaison, ventesMois,
      interventionsAVenir, commandesEnCours, commandesEnAttente, ventesEnAttente,
      dernieresRecoltes, prochainesInterventions, commandesRecentes,
      productionMensuelle, productionParParcelle
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count, COALESCE(SUM(surface_ha), 0) as surface FROM parcelles'),
      pool.query('SELECT COUNT(*) as count FROM arbres WHERE deleted_at IS NULL'),
      pool.query(`SELECT etat, COUNT(*) as count FROM arbres WHERE deleted_at IS NULL GROUP BY etat
        ORDER BY CASE etat WHEN 'Bon' THEN 1 WHEN 'Moyen' THEN 2 WHEN 'Mauvais' THEN 3 WHEN 'Mort' THEN 4 ELSE 5 END`),
      pool.query(`SELECT COALESCE(SUM(poids_grammes), 0) as total_grammes, COUNT(*) as count
        FROM recoltes WHERE date_recolte >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '3 months'`),
      pool.query(`SELECT COALESCE(SUM(montant_total), 0) as chiffre_affaires, COUNT(*) as count
        FROM ventes WHERE date_vente >= DATE_TRUNC('month', CURRENT_DATE)`),
      pool.query(`SELECT COUNT(*) as count FROM interventions WHERE date_prevue >= CURRENT_DATE AND statut = 'Planifié'`),
      pool.query(`SELECT COUNT(*) as count FROM commandes WHERE statut IN ('En attente', 'Confirmée', 'En préparation')`),
      pool.query(`SELECT COUNT(*) as count FROM commandes WHERE statut IN ('En attente', 'Confirmée')`),
      pool.query(`SELECT COUNT(*) as count FROM ventes WHERE statut = 'En attente'`),
      pool.query(`SELECT r.id, r.date_recolte, r.poids_grammes, r.qualite, r.calibre,
        p.nom as parcelle_nom, a.numero as arbre_numero FROM recoltes r
        LEFT JOIN parcelles p ON r.parcelle_id = p.id LEFT JOIN arbres a ON r.arbre_id = a.id
        ORDER BY r.date_recolte DESC LIMIT 5`),
      pool.query(`SELECT i.id, i.date_prevue, i.statut, i.description,
        t.nom as type_nom, t.couleur as type_couleur, p.nom as parcelle_nom, a.numero as arbre_numero
        FROM interventions i LEFT JOIN types_intervention t ON i.type_id = t.id
        LEFT JOIN parcelles p ON i.parcelle_id = p.id LEFT JOIN arbres a ON i.arbre_id = a.id
        WHERE i.date_prevue >= CURRENT_DATE AND i.statut = 'Planifié' ORDER BY i.date_prevue ASC LIMIT 5`),
      pool.query(`SELECT c.id, c.numero_commande, c.date_commande, c.date_livraison_demandee,
        c.poids_grammes, c.montant_total, c.statut, cl.nom as client_nom
        FROM commandes c LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE c.statut NOT IN ('Annulée', 'Livrée') ORDER BY c.date_commande DESC LIMIT 5`),
      pool.query(`SELECT TO_CHAR(date_recolte, 'YYYY-MM') as mois, SUM(poids_grammes) as total_grammes,
        COUNT(*) as nombre_recoltes FROM recoltes
        WHERE date_recolte >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
        GROUP BY TO_CHAR(date_recolte, 'YYYY-MM') ORDER BY mois`),
      pool.query(`SELECT p.nom as parcelle_nom, COALESCE(SUM(r.poids_grammes), 0) as total_grammes
        FROM parcelles p LEFT JOIN recoltes r ON r.parcelle_id = p.id GROUP BY p.id, p.nom
        HAVING COALESCE(SUM(r.poids_grammes), 0) > 0 ORDER BY total_grammes DESC LIMIT 10`)
    ]);

    res.json({
      stats: {
        parcelles: { count: parseInt(parcellesStats.rows[0].count), surface: parseFloat(parcellesStats.rows[0].surface) || 0 },
        arbres: { count: parseInt(arbresCount.rows[0].count), parEtat: arbresParEtat.rows.map(r => ({ etat: r.etat, count: parseInt(r.count) })) },
        recoltes: { totalGrammes: parseFloat(recoltesSaison.rows[0].total_grammes) || 0, count: parseInt(recoltesSaison.rows[0].count) },
        ventes: { chiffreAffaires: parseFloat(ventesMois.rows[0].chiffre_affaires) || 0, count: parseInt(ventesMois.rows[0].count) },
        interventions: { aVenir: parseInt(interventionsAVenir.rows[0].count) },
        commandes: { enCours: parseInt(commandesEnCours.rows[0].count) }
      },
      alertes: { commandesEnAttente: parseInt(commandesEnAttente.rows[0].count), ventesEnAttente: parseInt(ventesEnAttente.rows[0].count) },
      activites: { dernieresRecoltes: dernieresRecoltes.rows, prochainesInterventions: prochainesInterventions.rows, commandesEnCours: commandesRecentes.rows },
      graphiques: {
        productionMensuelle: productionMensuelle.rows.map(r => ({ mois: r.mois, totalGrammes: parseFloat(r.total_grammes) || 0, nombreRecoltes: parseInt(r.nombre_recoltes) })),
        productionParParcelle: productionParParcelle.rows.map(r => ({ nom: r.parcelle_nom, totalGrammes: parseFloat(r.total_grammes) || 0 }))
      },
      meta: { generatedAt: new Date().toISOString(), periode: { recoltes: 'Saison en cours', ventes: 'Mois en cours', graphiqueMensuel: '12 derniers mois' } }
    });
  } catch (err) {
    console.error('Erreur dashboard/full:', err);
    res.status(500).json({ error: 'Erreur', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// ============================================================
// GESTION DES ERREURS
// ============================================================

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée', code: 'NOT_FOUND', path: req.path });
});

// Erreur globale
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  if (err.message === 'Non autorisé par CORS') {
    return res.status(403).json({ error: 'Origine non autorisée', code: 'CORS_ERROR' });
  }
  res.status(500).json({ error: 'Erreur interne', code: 'INTERNAL_ERROR' });
});

// ============================================================
// DÉMARRAGE DU SERVEUR
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🍄 API Truffière v2.0.0                                  ║
║   Serveur démarré sur le port ${PORT}                         ║
║                                                            ║
║   🔐 Authentification JWT activée                          ║
║   📊 Base de données PostgreSQL connectée                  ║
║                                                            ║
║   Endpoints:                                               ║
║   - POST /api/auth/login                                   ║
║   - POST /api/auth/refresh                                 ║
║   - GET  /api/auth/me                                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
