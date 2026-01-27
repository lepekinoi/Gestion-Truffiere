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
const tokenRotation = require('./utils/tokenRotation');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

// ============================================================
// CONFIGURATION
// ============================================================

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant !');
  process.exit(1);
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 7;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

// Configuration base de données
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Vérifications de sécurité au démarrage
const requiredEnvVars = ['JWT_SECRET', 'DB_PASSWORD', 'DB_USER', 'DB_NAME'];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`❌ Variable d'environnement manquante : ${varName}`);
    process.exit(1);
  }
}



// ============================================================
// TEST DE CONNEXION À LA BASE DE DONNÉES (avec gestion d'erreur)
// ============================================================

const testDatabaseConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connexion à la base de données PostgreSQL réussie');
    console.log(`📦 Base: ${process.env.DB_NAME} | Hôte: ${process.env.DB_HOST}`);
    
    // Test simple de requête
    const result = await client.query('SELECT NOW()');
    console.log('🕐 Heure serveur DB:', result.rows[0].now);
    
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Erreur de connexion à la base de données');
    console.error('Message:', err.message);
    console.error('Configuration:', {
      host: process.env.DB_HOST || 'NON DÉFINI',
      port: process.env.DB_PORT || 'NON DÉFINI',
      database: process.env.DB_NAME || 'NON DÉFINI',
      user: process.env.DB_USER || 'NON DÉFINI'
    });
    console.error('\n⚠️  Vérifiez vos variables d\'environnement et que PostgreSQL est démarré\n');
    return false;
  }
};

// Tester la connexion avant de démarrer le serveur
testDatabaseConnection().then((connected) => {
  if (!connected) {
    console.error('❌ Impossible de démarrer le serveur sans connexion DB');
    process.exit(1);
  }
  
// ✅ Endpoint de santé pour Docker healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected' // Tu peux ajouter une vraie vérification de DB si tu veux
  });
});

  
  // Démarrer le serveur seulement si la connexion DB fonctionne
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║  🚀 Serveur API Truffière démarré      ║`);
    console.log(`║  📡 Port: ${PORT.toString().padEnd(28)} ║`);
    console.log(`║  🌍 URL: http://localhost:${PORT}        ║`);
    console.log('╚════════════════════════════════════════╝\n');
  });
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
    const allowedOrigins = (process.env.CORS_ORIGINS || "")
		  .split(",")
		  .map(s => s.trim())
		  .filter(Boolean);
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
// FONCTIONS UTILITAIRES
// ============================================================

// Fonction pour convertir les valeurs vides en null (pour PostgreSQL)
const emptyToNull = (value) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  return value;
};

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
    // ✅ VALIDATION DES ENTRÉES
    if (!email || !password) {
      await logLoginAttempt(email, clientIp, userAgent, false, 'MISSING_CREDENTIALS');
      return res.status(400).json({ 
        error: 'Email et mot de passe requis', 
        code: 'MISSING_CREDENTIALS' 
      });
    }

    // ✅ RÉCUPÉRER L'UTILISATEUR DEPUIS LA BASE
    const userResult = await pool.query(
      `SELECT id, email, password_hash, nom, prenom, role, is_active, 
              failed_login_attempts, locked_until
       FROM users 
       WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      await logLoginAttempt(email, clientIp, userAgent, false, 'USER_NOT_FOUND');
      return res.status(401).json({ 
        error: 'Identifiants invalides', 
        code: 'INVALID_CREDENTIALS' 
      });
    }

    const user = userResult.rows[0];

    // ✅ VÉRIFIER SI LE COMPTE EST ACTIF
    if (!user.is_active) {
      await logLoginAttempt(email, clientIp, userAgent, false, 'ACCOUNT_DISABLED');
      return res.status(403).json({ 
        error: 'Compte désactivé', 
        code: 'ACCOUNT_DISABLED' 
      });
    }

    // ✅ VÉRIFIER SI LE COMPTE EST VERROUILLÉ
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await logLoginAttempt(email, clientIp, userAgent, false, 'ACCOUNT_LOCKED');
      return res.status(403).json({ 
        error: 'Compte temporairement verrouillé', 
        code: 'ACCOUNT_LOCKED',
        lockedUntil: user.locked_until
      });
    }

    // ✅ VÉRIFIER LE MOT DE PASSE
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordValid) {
      // Incrémenter les tentatives échouées
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      const maxAttempts = 5;
      
      if (newFailedAttempts >= maxAttempts) {
        // Verrouiller le compte pour 15 minutes
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await pool.query(
          `UPDATE users 
           SET failed_login_attempts = $1, locked_until = $2 
           WHERE id = $3`,
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
        `UPDATE users 
         SET failed_login_attempts = $1 
         WHERE id = $2`,
        [newFailedAttempts, user.id]
      );
      
      await logLoginAttempt(email, clientIp, userAgent, false, 'INVALID_PASSWORD');
      return res.status(401).json({ 
        error: 'Identifiants invalides', 
        code: 'INVALID_CREDENTIALS',
        attemptsRemaining: maxAttempts - newFailedAttempts
      });
    }

    // ✅ GÉNÉRER L'ACCESS TOKEN
    const accessToken = generateAccessToken(user);
    
    // ✅ UTILISER LA ROTATION POUR CRÉER LE REFRESH TOKEN
    const refreshTokenData = await tokenRotation.createRotatedToken(
      pool,
      user.id,
      userAgent.substring(0, 255),
      clientIp,
      userAgent
    );

    // ✅ RÉINITIALISER LES ÉCHECS DE CONNEXION
    await pool.query(
      `UPDATE users 
       SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() 
       WHERE id = $1`,
      [user.id]
    );

    await logLoginAttempt(email, clientIp, userAgent, true, null);

    // ✅ RETOURNER LA RÉPONSE
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
    res.status(500).json({ 
      error: 'Erreur lors de la connexion', 
      code: 'LOGIN_ERROR' 
    });
  }
});


// POST /api/auth/refresh - Rafraîchir le token
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  try {
    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'Refresh token requis', 
        code: 'MISSING_TOKEN' 
      });
    }

    // **ROTATION AUTOMATIQUE**
    const rotationResult = await tokenRotation.rotateRefreshToken(
      pool,
      refreshToken,
      userAgent.substring(0, 255),
      clientIp,
      userAgent
    );

    // Générer un nouveau access token
    const accessToken = generateAccessToken(rotationResult.user);

    res.json({ 
      accessToken, 
      refreshToken: rotationResult.token, // NOUVEAU token
      expiresIn: JWT_EXPIRES_IN 
    });

  } catch (err) {
    console.error('Erreur refresh:', err);

    // Gestion des erreurs spécifiques
    if (err.message === 'TOKEN_REUSE_DETECTED') {
      return res.status(401).json({ 
        error: 'Token réutilisé - Toutes les sessions ont été révoquées', 
        code: 'SECURITY_BREACH',
        action: 'FORCE_LOGOUT'
      });
    }

    if (err.message === 'TOKEN_EXPIRED') {
      return res.status(401).json({ 
        error: 'Token expiré', 
        code: 'TOKEN_EXPIRED' 
      });
    }

    if (err.message === 'INVALID_TOKEN') {
      return res.status(401).json({ 
        error: 'Token invalide', 
        code: 'INVALID_TOKEN' 
      });
    }

    if (err.message === 'USER_INACTIVE') {
      return res.status(403).json({ 
        error: 'Compte désactivé', 
        code: 'ACCOUNT_DISABLED' 
      });
    }

    if (err.message === 'MAX_ROTATION_EXCEEDED') {
      return res.status(401).json({ 
        error: 'Trop de rotations - Veuillez vous reconnecter', 
        code: 'MAX_ROTATION_EXCEEDED' 
      });
    }

    res.status(500).json({ 
      error: 'Erreur lors du rafraîchissement', 
      code: 'REFRESH_ERROR' 
    });
  }
});
// POST /api/auth/logout - Déconnexion
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  const { refreshToken } = req.body;

  try {
    if (refreshToken) {
      const tokenHash = tokenRotation.hashToken(refreshToken);
      
      // Trouver l'ID du token
      const tokenResult = await pool.query(
        'SELECT id FROM refresh_tokens WHERE token_hash = $1',
        [tokenHash]
      );

      if (tokenResult.rows.length > 0) {
        // Révoquer la chaîne complète
        await tokenRotation.revokeTokenChain(
          pool, 
          tokenResult.rows[0].id, 
          'user_logout'
        );
      }
    }
    
    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    console.error('Erreur logout:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la déconnexion', 
      code: 'LOGOUT_ERROR' 
    });
  }
});

// POST /api/auth/logout-all - Déconnexion de tous les appareils
app.post('/api/auth/logout-all', authMiddleware, async (req, res) => {
  try {
    const revokedCount = await tokenRotation.revokeAllUserTokens(
      pool, 
      req.user.id, 
      'logout_all_devices'
    );
    
    res.json({ 
      message: 'Déconnexion de tous les appareils', 
      sessionsRevoked: revokedCount 
    });
  } catch (err) {
    console.error('Erreur logout-all:', err);
    res.status(500).json({ 
      error: 'Erreur', 
      code: 'LOGOUT_ALL_ERROR' 
    });
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
      return res.status(409).json({ error: 'Email déjÃ  utilisé', code: 'EMAIL_EXISTS' });
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
        return res.status(409).json({ error: 'Email déjÃ  utilisé', code: 'EMAIL_EXISTS' });
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
      return res.status(400).json({ error: 'Aucune donnée Ã  mettre Ã  jour', code: 'NO_DATA' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, email, nom, prenom, role, is_active`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json({ message: 'Utilisateur mis Ã  jour', user: result.rows[0] });
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

// GET /api/auth/sessions - Voir ses sessions actives
app.get('/api/auth/sessions', authMiddleware, async (req, res) => {
  try {
    const sessions = await tokenRotation.getActiveSessions(pool, req.user.id);
    res.json(sessions);
  } catch (err) {
    console.error('Erreur get sessions:', err);
    res.status(500).json({ 
      error: 'Erreur', 
      code: 'GET_SESSIONS_ERROR' 
    });
  }
});

// GET /api/auth/token-stats - Statistiques des tokens (admin)
app.get('/api/auth/token-stats', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const stats = await tokenRotation.getTokenStats(pool, req.query.userId || req.user.id);
    res.json(stats);
  } catch (err) {
    console.error('Erreur token stats:', err);
    res.status(500).json({ 
      error: 'Erreur', 
      code: 'TOKEN_STATS_ERROR' 
    });
  }
});

// POST /api/auth/cleanup-tokens - Nettoyer les tokens expirés (admin)
app.post('/api/auth/cleanup-tokens', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const daysOld = parseInt(req.body.daysOld) || 30;
    const deletedCount = await tokenRotation.cleanupExpiredTokens(pool, daysOld);
    
    res.json({ 
      message: 'Nettoyage effectué', 
      deletedCount 
    });
  } catch (err) {
    console.error('Erreur cleanup:', err);
    res.status(500).json({ 
      error: 'Erreur', 
      code: 'CLEANUP_ERROR' 
    });
  }
});

// ============================================================
// MIDDLEWARE D'AUTHENTIFICATION POUR ROUTES PROTÉGÉES
// ============================================================

// Toutes les routes /api/* suivantes nécessitent une authentification
app.use('/api', (req, res, next) => {
  // Skip les routes publiques
  if (req.path.startsWith('/auth') || req.path === '/health' || req.path.startsWith('/especes')) {
    return next();
  }
  authMiddleware(req, res, next);
});


// ==================== ROUTES PARCELLE ====================
const parcellesRoutes = require('./routes/parcelles.routes');
app.use('/api/parcelles', (req, res, next) => {
  req.pool = pool;
  next();
}, parcellesRoutes(pool, requireWriteAccess, emptyToNull));

// ==================== ROUTES Arbres (avec corbeille) ====================

const arbresRoutes = require('./routes/arbres.routes');
app.use('/api/arbres', (req, res, next) => {
  req.pool = pool;
  next();
}, arbresRoutes(pool, requireWriteAccess, emptyToNull));

// ==================== ROUTES Caveurs ====================
const caveursRoutes = require('./routes/caveurs.routes');
app.use('/api/caveurs', (req, res, next) => {
  req.pool = pool;
  next();
}, caveursRoutes(pool, requireWriteAccess));

// ==================== ROUTES Chiens ====================
const chiensRoutes = require('./routes/chiens.routes');
app.use('/api/chiens', (req, res, next) => {
  req.pool = pool;
  next();
}, chiensRoutes(pool, requireWriteAccess));

// ==================== ROUTES Récoltes ====================
const recoltesRoutes = require('./routes/recoltes.routes');
app.use('/api/recoltes', (req, res, next) => {
  req.pool = pool;
  next();
}, recoltesRoutes(pool, requireWriteAccess));

// ==================== ROUTES Historique ====================
const historiqueRoutes = require('./routes/historique.routes');
app.use('/api/historique', (req, res, next) => {
  req.pool = pool;
  next();
}, historiqueRoutes(pool, requireWriteAccess, requireRole));

// ==================== ROUTES Clients ====================
const clientsRoutes = require('./routes/clients.routes');
app.use('/api/clients', (req, res, next) => {
  req.pool = pool;
  next();
}, clientsRoutes(pool, requireWriteAccess));

// ==================== ROUTES Ventes ====================
const ventesRoutes = require('./routes/ventes.routes');
app.use('/api/ventes', (req, res, next) => {
  req.pool = pool;
  next();
}, ventesRoutes(pool, requireWriteAccess));

// ==================== ROUTES Commandes ====================
const commandesRoutes = require('./routes/commandes.routes');
app.use('/api/commandes', (req, res, next) => {
  req.pool = pool;
  next();
}, commandesRoutes(pool, requireWriteAccess));

// ==================== ROUTES Paramètres ====================
const parametresRoutes = require('./routes/parametres.routes');
app.use('/api/parametres', (req, res, next) => {
  req.pool = pool;
  next();
}, parametresRoutes(pool, requireWriteAccess));

// ==================== ROUTES Préférences utilisateur ====================
const preferencesRoutes = require('./routes/preferences.routes');
app.use('/api/preferences-utilisateur', (req, res, next) => {
  req.pool = pool;
  next();
}, preferencesRoutes(pool, requireWriteAccess));

// ==================== ROUTES Statistiques ====================
const statsRoutes = require('./routes/stats.routes');
app.use('/api/stats', (req, res, next) => {
  req.pool = pool;
  next();
}, statsRoutes(pool));

// ==================== ROUTES Dashboard ====================
const dashboardRoutes = require('./routes/dashboard.routes');
app.use('/api/dashboard', (req, res, next) => {
  req.pool = pool;
  next();
}, dashboardRoutes(pool));

// ==================== ROUTES Stock ====================
const stockRoutes = require('./routes/stock.routes');
app.use('/api/stock', (req, res, next) => {
  req.pool = pool;
  next();
}, stockRoutes(pool));

// ==================== ROUTES ESPECES ====================
const especesRoutes = require('./routes/especes.routes');
app.use('/api/especes', (req, res, next) => {
  req.pool = pool;
  next();
}, especesRoutes);

// ==================== ROUTES Types d'intervention ====================
const typesInterventionRoutes = require('./routes/types-intervention.routes');
app.use('/api/types-intervention', (req, res, next) => {
  req.pool = pool;
  next();
}, typesInterventionRoutes(pool));

// ==================== ROUTES Interventions (avec details et stats) ====================
const interventionsRoutes = require('./routes/interventions.routes');
app.use('/api/interventions', (req, res, next) => {
  req.pool = pool;
  next();
}, interventionsRoutes(pool, requireWriteAccess, emptyToNull));

// ==================== ROUTES Produits phytosanitaires ====================
const produitsPhytoRoutes = require('./routes/produits-phyto.routes');
app.use('/api/produits-phyto', (req, res, next) => {
  req.pool = pool;
  next();
}, produitsPhytoRoutes(pool, requireWriteAccess));

// ==================== ROUTES Amendements référentiel ====================
const amendementsRefRoutes = require('./routes/amendements-ref.routes');
app.use('/api/amendements-ref', (req, res, next) => {
  req.pool = pool;
  next();
}, amendementsRefRoutes(pool, requireWriteAccess));

// ============================================================
// ROUTES RECHERCHE GLOBALE
// ============================================================

app.get('/api/search/global', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q.toLowerCase()}%`;
    const results = [];

    // Recherche dans les parcelles
    try {
      const parcelles = await pool.query(`
        SELECT id, nom, surface_ha, type_sol
        FROM parcelles
        WHERE LOWER(COALESCE(nom, '')) LIKE $1 
           OR LOWER(COALESCE(type_sol, '')) LIKE $1 
           OR LOWER(COALESCE(notes, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (parcelles.rows.length > 0) {
        results.push({
          category: 'parcelles',
          items: parcelles.rows.map(p => ({
            id: p.id,
            title: p.nom,
            subtitle: `${p.surface_ha} ha - ${p.type_sol || 'Type non défini'}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche parcelles:', e.message);
    }

    // Recherche dans les arbres
    try {
      const arbres = await pool.query(`
        SELECT a.id, a.numero, a.espece, a.variete_truffe, a.etat_sanitaire, p.nom as parcelle_nom
        FROM arbres a
        LEFT JOIN parcelles p ON a.parcelle_id = p.id
        WHERE LOWER(COALESCE(a.numero, '')) LIKE $1 
           OR LOWER(COALESCE(a.espece, '')) LIKE $1 
           OR LOWER(COALESCE(a.variete_truffe, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (arbres.rows.length > 0) {
        results.push({
          category: 'arbres',
          items: arbres.rows.map(a => ({
            id: a.id,
            title: `${a.numero} - ${a.espece}`,
            subtitle: `${a.parcelle_nom || 'Sans parcelle'} - ${a.etat_sanitaire}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche arbres:', e.message);
    }

    // Recherche dans les récoltes
    try {
      const recoltes = await pool.query(`
        SELECT r.id, r.date_recolte, r.poids_grammes, r.qualite, r.calibre, 
               a.numero as arbre_numero, p.nom as parcelle_nom
        FROM recoltes r
        LEFT JOIN arbres a ON r.arbre_id = a.id
        LEFT JOIN parcelles p ON r.parcelle_id = p.id
        WHERE LOWER(COALESCE(r.qualite, '')) LIKE $1 
           OR LOWER(COALESCE(r.calibre, '')) LIKE $1 
           OR LOWER(COALESCE(r.caveur, '')) LIKE $1
           OR LOWER(COALESCE(p.nom, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (recoltes.rows.length > 0) {
        results.push({
          category: 'recoltes',
          items: recoltes.rows.map(r => ({
            id: r.id,
            title: `${new Date(r.date_recolte).toLocaleDateString('fr-FR')} - ${r.poids_grammes}g`,
            subtitle: `${r.qualite || 'Qualité NC'} - ${r.calibre || 'Calibre NC'} - ${r.parcelle_nom || ''}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche récoltes:', e.message);
    }

    // Recherche dans les clients
    try {
      const clients = await pool.query(`
        SELECT id, type, nom, prenom, raison_sociale, email, telephone, ville
        FROM clients
        WHERE LOWER(COALESCE(nom, '')) LIKE $1 
           OR LOWER(COALESCE(prenom, '')) LIKE $1 
           OR LOWER(COALESCE(raison_sociale, '')) LIKE $1
           OR LOWER(COALESCE(email, '')) LIKE $1 
           OR LOWER(COALESCE(telephone, '')) LIKE $1 
           OR LOWER(COALESCE(ville, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (clients.rows.length > 0) {
        results.push({
          category: 'clients',
          items: clients.rows.map(c => ({
            id: c.id,
            title: c.type === 'Professionnel' ? (c.raison_sociale || c.nom) : `${c.prenom || ''} ${c.nom}`.trim(),
            subtitle: `${c.type} - ${c.ville || 'Ville NC'} - ${c.email || ''}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche clients:', e.message);
    }

    // Recherche dans les ventes
    try {
      const ventes = await pool.query(`
        SELECT v.id, v.date_vente, v.quantite_grammes, v.montant_total, v.statut, v.numero_facture,
               c.nom as client_nom, c.prenom as client_prenom, c.raison_sociale as client_raison_sociale
        FROM ventes v
        LEFT JOIN clients c ON v.client_id = c.id
        WHERE LOWER(COALESCE(v.numero_facture, '')) LIKE $1 
           OR LOWER(COALESCE(v.statut, '')) LIKE $1
           OR LOWER(COALESCE(c.nom, '')) LIKE $1 
           OR LOWER(COALESCE(c.raison_sociale, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (ventes.rows.length > 0) {
        results.push({
          category: 'ventes',
          items: ventes.rows.map(v => ({
            id: v.id,
            title: `${v.numero_facture || 'Sans n°'} - ${v.montant_total}ââ€Å¡¬`,
            subtitle: `${v.client_raison_sociale || `${v.client_prenom || ''} ${v.client_nom || ''}`.trim() || 'Client NC'} - ${v.statut}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche ventes:', e.message);
    }

    // Recherche dans les commandes
    try {
      const commandes = await pool.query(`
        SELECT co.id, co.numero_commande, co.date_commande, co.poids_grammes, co.statut,
               c.nom as client_nom, c.prenom as client_prenom, c.raison_sociale as client_raison_sociale
        FROM commandes co
        LEFT JOIN clients c ON co.client_id = c.id
        WHERE LOWER(COALESCE(co.numero_commande, '')) LIKE $1 
           OR LOWER(COALESCE(co.statut, '')) LIKE $1
           OR LOWER(COALESCE(c.nom, '')) LIKE $1 
           OR LOWER(COALESCE(c.raison_sociale, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (commandes.rows.length > 0) {
        results.push({
          category: 'commandes',
          items: commandes.rows.map(co => ({
            id: co.id,
            title: `${co.numero_commande || 'Sans n°'} - ${co.poids_grammes}g`,
            subtitle: `${co.client_raison_sociale || `${co.client_prenom || ''} ${co.client_nom || ''}`.trim() || 'Client NC'} - ${co.statut}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche commandes:', e.message);
    }

    // Recherche dans les interventions
    try {
      const interventions = await pool.query(`
        SELECT i.id, i.date_prevue, i.date_realisee, i.description, i.statut,
               t.nom as type_nom, p.nom as parcelle_nom
        FROM interventions i
        LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
        LEFT JOIN parcelles p ON i.parcelle_id = p.id
        WHERE LOWER(COALESCE(t.nom, '')) LIKE $1 
           OR LOWER(COALESCE(i.description, '')) LIKE $1 
           OR LOWER(COALESCE(p.nom, '')) LIKE $1
           OR LOWER(COALESCE(i.personnel, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (interventions.rows.length > 0) {
        results.push({
          category: 'interventions',
          items: interventions.rows.map(i => ({
            id: i.id,
            title: `${i.type_nom || 'Intervention'} - ${new Date(i.date_prevue).toLocaleDateString('fr-FR')}`,
            subtitle: `${i.parcelle_nom || 'Sans parcelle'} - ${i.statut || ''}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche interventions:', e.message);
    }

    res.json(results);
  } catch (err) {
    console.error('Erreur recherche globale:', err);
    res.status(500).json({ error: 'Erreur lors de la recherche', details: err.message });
  }
});

// ============================================================
// ROUTES FACTURES PDF
// ============================================================

// Récupérer les données pour générer une facture
app.get('/api/factures/:venteId', async (req, res) => {
  try {
    const { venteId } = req.params;

    const vente = await pool.query(`
      SELECT 
        v.*,
        c.type as client_type,
        c.nom as client_nom,
        c.prenom as client_prenom,
        c.raison_sociale as client_raison_sociale,
        c.email as client_email,
        c.telephone as client_telephone,
        c.adresse as client_adresse,
        c.code_postal as client_code_postal,
        c.ville as client_ville,
        c.pays as client_pays,
        c.siret as client_siret,
        r.date_recolte,
        r.qualite as recolte_qualite,
        r.calibre as recolte_calibre,
        r.maturite as recolte_maturite,
        p.nom as parcelle_nom
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN recoltes r ON v.recolte_id = r.id
      LEFT JOIN parcelles p ON r.parcelle_id = p.id
      WHERE v.id = $1
    `, [venteId]);

    if (vente.rows.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    // Récupérer les paramètres de l'entreprise
    const parametres = await pool.query(`
      SELECT cle, valeur FROM parametres 
      WHERE cle IN ('entreprise_nom', 'entreprise_adresse', 'entreprise_code_postal', 
                    'entreprise_ville', 'entreprise_telephone', 'entreprise_email',
                    'entreprise_siret', 'entreprise_tva', 'facture_mentions_legales',
                    'facture_conditions_paiement', 'facture_iban', 'facture_bic')
    `);

    const params = {};
    parametres.rows.forEach(p => {
      params[p.cle] = p.valeur;
    });

    const venteData = vente.rows[0];
    
    // Générer le numéro de facture si non existant
    let numeroFacture = venteData.numero_facture;
    if (!numeroFacture) {
      const year = new Date(venteData.date_vente).getFullYear();
      const countResult = await pool.query(`
        SELECT COUNT(*) as count FROM ventes 
        WHERE EXTRACT(YEAR FROM date_vente) = $1 AND numero_facture IS NOT NULL
      `, [year]);
      const count = parseInt(countResult.rows[0].count) + 1;
      numeroFacture = `FAC-${year}-${String(count).padStart(4, '0')}`;
      
      // Mettre Ã  jour la vente avec le numéro de facture
      await pool.query(`UPDATE ventes SET numero_facture = $1 WHERE id = $2`, [numeroFacture, venteId]);
    }

    res.json({
      facture: {
        numero: numeroFacture,
        date_emission: new Date().toISOString(),
        date_vente: venteData.date_vente,
        quantite_grammes: venteData.quantite_grammes,
        prix_unitaire_kg: venteData.prix_unitaire_kg,
        montant_ht: venteData.montant_total,
        tva_taux: 5.5, // TVA réduite pour produits alimentaires
        tva_montant: venteData.montant_total * 0.055,
        montant_ttc: venteData.montant_total * 1.055,
        mode_paiement: venteData.mode_paiement,
        statut: venteData.statut,
        notes: venteData.notes
      },
      client: {
        type: venteData.client_type,
        nom: venteData.client_nom,
        prenom: venteData.client_prenom,
        raison_sociale: venteData.client_raison_sociale,
        email: venteData.client_email,
        telephone: venteData.client_telephone,
        adresse: venteData.client_adresse,
        code_postal: venteData.client_code_postal,
        ville: venteData.client_ville,
        pays: venteData.client_pays,
        siret: venteData.client_siret
      },
      produit: {
        description: 'Truffes fraîches',
        qualite: venteData.recolte_qualite,
        calibre: venteData.recolte_calibre,
        maturite: venteData.recolte_maturite,
        date_recolte: venteData.date_recolte,
        parcelle: venteData.parcelle_nom
      },
      entreprise: {
        nom: params.entreprise_nom || 'Truffière',
        adresse: params.entreprise_adresse || '',
        code_postal: params.entreprise_code_postal || '',
        ville: params.entreprise_ville || '',
        telephone: params.entreprise_telephone || '',
        email: params.entreprise_email || '',
        siret: params.entreprise_siret || '',
        tva_intra: params.entreprise_tva || '',
        iban: params.facture_iban || '',
        bic: params.facture_bic || '',
        mentions_legales: params.facture_mentions_legales || '',
        conditions_paiement: params.facture_conditions_paiement || 'Paiement Ã  réception'
      }
    });
  } catch (err) {
    console.error('Erreur récupération facture:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des données de facture' });
  }
});

// Générer un numéro de facture
app.post('/api/factures/generer-numero', requireWriteAccess, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM ventes 
      WHERE EXTRACT(YEAR FROM date_vente) = $1 AND numero_facture IS NOT NULL
    `, [year]);
    const count = parseInt(countResult.rows[0].count) + 1;
    const numeroFacture = `FAC-${year}-${String(count).padStart(4, '0')}`;
    
    res.json({ numero_facture: numeroFacture });
  } catch (err) {
    console.error('Erreur génération numéro facture:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du numéro de facture' });
  }
});




// ============================================================
// GESTION DES ERREURS
// ============================================================

// ✅ 1. ENDPOINT /HEALTH EN PREMIER (avant le middleware 404)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ✅ 2. MIDDLEWARE 404 (capture tout ce qui n'a pas été défini avant)
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée', code: 'NOT_FOUND', path: req.path });
});

// ✅ 3. GESTIONNAIRE D'ERREURS GLOBAL (toujours en dernier)
app.use((err, req, res, next) => {
	console.error('Erreur serveur:', {
		message: err.message, 
		stack: process.env.NODE_ENV === 'development' ? err.stack : undefined, 
		route: req.path, 
		user: req.user?.id, 
		ip: req.ip 
	});
	
	if (err.message === 'Non autorisé par CORS') {
		return res.status(403).json({ error: 'Origine non autorisée', code: 'CORS_ERROR' });
	}
	// Erreurs PostgreSQL courantes
	if (err.code === '23505') {
		return res.status(409).json({ error: 'Conflit : doublon détecté', code: 'UNIQUE_VIOLATION' });
	}
	
	res.status(500).json({ 
		error: 'Erreur interne', 
		code: 'INTERNAL_ERROR', 
		details: process.env.NODE_ENV === 'development' ? err.message : undefined 
	}); 
});

module.exports = app;
