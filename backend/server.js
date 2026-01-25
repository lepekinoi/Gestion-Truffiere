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
      return res.status(409).json({ error: 'Email déjÃ  utilisé', code: 'EMAIL_EXISTS' });
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
        return res.status(409).json({ error: 'Email déjÃ  utilisé', code: 'EMAIL_EXISTS' });
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
      return res.status(400).json({ error: 'Aucune donnée Ã  mettre Ã  jour', code: 'NO_DATA' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING id, email, nom, prenom, role, is_active`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    res.json({ message: 'Utilisateur mis Ã  jour', user: result.rows[0] });
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

// ==================== ROUTES ESPECES ====================
const especesRoutes = require('./routes/especes.routes');

app.use('/api/especes', (req, res, next) => {
  // Passer la pool de connexion au router
  req.pool = pool;
  next();
}, especesRoutes);

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
      // Utiliser AT TIME ZONE pour comparer en heure locale (Europe/Paris)
      // start_date est au format YYYY-MM-DD, on veut le début du jour en heure locale
      query += ` AND h.timestamp >= ($${paramIndex}::date AT TIME ZONE 'Europe/Paris')`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      // end_date + 1 jour à minuit moins 1 seconde en heure locale
      query += ` AND h.timestamp < (($${paramIndex}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Paris')`;
      params.push(end_date);
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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
      SELECT id, nom, surface_ha, type_sol, ph_sol, notes, date_creation,
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
        ph_sol: p.ph_sol, notes: p.notes,
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
    const { nom, surface_ha, type_sol, ph_sol, notes, coordinates } = req.body;

    console.log('📥 POST /api/parcelles - Données reçues:', {
      nom,
      surface_ha,
      type_sol,
      ph_sol,
      notes,
      hasCoordinates: !!(coordinates && coordinates.length > 0)
    });

    // 🛡️ VALIDATION
    if (!nom || nom.trim() === '') {
      return res.status(400).json({ 
        error: 'Le nom est obligatoire',
        code: 'MISSING_NOM' 
      });
    }

    if (!surface_ha || isNaN(parseFloat(surface_ha))) {
      return res.status(400).json({ 
        error: 'La surface doit être un nombre valide',
        code: 'INVALID_SURFACE' 
      });
    }

    // Valider pH si fourni
    if (ph_sol !== null && ph_sol !== undefined && ph_sol !== '') {
      if (isNaN(parseFloat(ph_sol))) {
        return res.status(400).json({ 
          error: 'Le pH doit être un nombre valide',
          code: 'INVALID_PH' 
        });
      }
    }

    let query, params;

    // Avec coordonnées
    if (coordinates && coordinates.length > 0) {
      try {
const coordsString = coordinates.map(coord => 
  `${coord[1]} ${coord[0]}`
).join(', ');
		

        const firstCoord = coordinates[0];
        const lastCoord = coordinates[coordinates.length - 1];
        const needsClosure = (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]);

        const polygonWKT = needsClosure 
          ? `POLYGON((${coordsString}, ${firstCoord[1]} ${firstCoord[0]}))`
          : `POLYGON((${coordsString}))`;

        query = `INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, notes, geometrie) 
                 VALUES ($1, $2, $3, $4, $5, ST_GeomFromText($6, 4326)) 
                 RETURNING *`;

        params = [
          nom.trim(),
          parseFloat(surface_ha),
          type_sol && type_sol.trim() !== '' ? type_sol.trim() : null,
          ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null,
          notes && notes.trim() !== '' ? notes.trim() : null,
          polygonWKT
        ];

      } catch (geoError) {
        console.error('⚠️ Erreur géométrie, création sans géométrie:', geoError.message);

        // Sans géométrie en cas d'erreur
        query = `INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, notes) 
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING *`;

        params = [
          nom.trim(),
          parseFloat(surface_ha),
          type_sol && type_sol.trim() !== '' ? type_sol.trim() : null,
          ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null,
          notes && notes.trim() !== '' ? notes.trim() : null
        ];
      }
    } 
    // Sans coordonnées
    else {
      query = `INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, notes) 
               VALUES ($1, $2, $3, $4, $5) 
               RETURNING *`;

      params = [
        nom.trim(),
        parseFloat(surface_ha),
        type_sol && type_sol.trim() !== '' ? type_sol.trim() : null,
        ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null,
        notes && notes.trim() !== '' ? notes.trim() : null
      ];
    }

    console.log('🔵 Exécution SQL:', { query: query.substring(0, 80) + '...', params });

    const result = await pool.query(query, params);

    console.log('✅ Parcelle créée, ID:', result.rows[0].id);

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('═══════════════════════════════════════');
    console.error('❌ ERREUR POST /api/parcelles');
    console.error('Message:', err.message);
    console.error('Code:', err.code);
    console.error('Detail:', err.detail);
    console.error('═══════════════════════════════════════');

    res.status(500).json({ 
      error: 'Erreur lors de la création',
      details: err.message,
      code: err.code
    });
  }
});

app.put('/api/parcelles/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, surface_ha, type_sol, ph_sol, notes, coordinates, deleteGeometry } = req.body;
    
    let query, params;
    
    if (deleteGeometry === true) {
      query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
               notes = $5, geometrie = NULL WHERE id = $6 RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, notes, id];
    } else if (coordinates && coordinates.length > 0) {
      const coordsString = coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(', ');
      const polygonWKT = `POLYGON((${coordsString}, ${coordinates[0][1]} ${coordinates[0][0]}))`;
      
      query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
               notes = $5, geometrie = ST_GeomFromText($6, 4326) WHERE id = $7 RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, notes, polygonWKT, id];
    } else {
      query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
               notes = $5 WHERE id = $6 RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, notes, id];
    }
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, porte_greffe, rendement_estimé, circonference_cm, hauteur_m, latitude, longitude, notes, etat_sanitaire } = req.body;
    const result = await pool.query(
      `INSERT INTO arbres (parcelle_id, numero, espece, variete_truffe, date_plantation, porte_greffe, rendement_estimé, circonference_cm, hauteur_m, latitude, longitude, notes, etat_sanitaire)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        emptyToNull(parcelle_id),
        numero,
        espece,
        emptyToNull(variete_truffe),
        emptyToNull(date_plantation),
        emptyToNull(porte_greffe),
        emptyToNull(rendement_estimé),
        emptyToNull(circonference_cm),
        emptyToNull(hauteur_m),
        emptyToNull(latitude),
        emptyToNull(longitude),
        emptyToNull(notes),
        emptyToNull(etat_sanitaire) || 'bon'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création arbre:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'arbre', details: err.message });
  }
});


app.put('/api/arbres/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, porte_greffe, rendement_estimé, circonference_cm, hauteur_m, date_derniere_taille, latitude, longitude, notes, etat_sanitaire } = req.body;
    const result = await pool.query(
      `UPDATE arbres SET parcelle_id = $1, numero = $2, espece = $3, variete_truffe = $4, 
       date_plantation = $5, porte_greffe = $6, rendement_estimé = $7, circonference_cm = $8, hauteur_m = $9, 
       date_derniere_taille = $10, latitude = $11, longitude = $12, notes = $13, etat_sanitaire = $14
       WHERE id = $15 AND deleted_at IS NULL RETURNING *`,
      [
        emptyToNull(parcelle_id),
        numero,
        espece,
        emptyToNull(variete_truffe),
        emptyToNull(date_plantation),
        emptyToNull(porte_greffe),
        emptyToNull(rendement_estimé),
        emptyToNull(circonference_cm),
        emptyToNull(hauteur_m),
        emptyToNull(date_derniere_taille),
        emptyToNull(latitude),
        emptyToNull(longitude),
        emptyToNull(notes),
        emptyToNull(etat_sanitaire),
        id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur modification arbre:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour', details: err.message });
  }
});


// Routes corbeille (spécifiques) AVANT la route générique /:id
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
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Récupérer les IDs des arbres à supprimer
    const treesToDelete = await client.query(
      'SELECT id FROM arbres WHERE deleted_at IS NOT NULL'
    );
    const treeIds = treesToDelete.rows.map(row => row.id);
    
    if (treeIds.length === 0) {
      await client.query('COMMIT');
      return res.json({ message: 'Corbeille vide', count: 0 });
    }
    
    // Supprimer les références en cascade
    await client.query('DELETE FROM interventions WHERE arbre_id = ANY($1)', [treeIds]);
    await client.query('DELETE FROM recoltes WHERE arbre_id = ANY($1)', [treeIds]);
    
    // Enfin, supprimer les arbres
    const result = await client.query('DELETE FROM arbres WHERE deleted_at IS NOT NULL RETURNING id');
    
    await client.query('COMMIT');
    res.json({ message: 'Corbeille vidée', count: result.rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erreur lors du vidage de la corbeille', details: err.message });
  } finally {
    client.release();
  }
});

// Route générique APRÈS les routes /corbeille
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
    res.json({ message: 'Arbre mis Ã  la corbeille', arbre: result.rows[0] });
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

// POST - Créer une intervention (avec création optionnelle des détails)
app.post('/api/interventions', requireWriteAccess, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { 
      // Champs principaux (déjà utilisés dans ton code actuel)
      type_intervention_id ,
      parcelle_id ,
      arbre_id ,
      date_prevue ,
      date_realisee,
      duree_minutes,
      personnel,
      description,
      cout,
      statut,
      meteo,
      notes,

      // Champs de détails POTENTIELS (adapter selon ta table intervention_details)
      volume_eau_m3,
      volume_eau_par_arbre_l,
      methode_irrigation,
      source_eau,
      debit_l_h,
      frequence_irrigation,
      humidite_sol_avant,
      humidite_sol_apres,
      pression_bar,
      categorie_traitement,
      nom_commercial,
      matiere_active,
      numero_amm,
      dose_produit_ha,
      dose_produit_arbre,
      concentration,
      volume_bouillie_l,
      surface_traitee_ha,
      methode_application,
      cible_traitement,
      delai_avant_recolte_jours,
      conditions_application,
      equipement_protection,
      zone_non_traitee_m,
      fabricant
      // ajoute ici tout autre champ existant dans intervention_details
    } = req.body;
    
    console.log('📥 Création intervention (transaction):', { 
      type_intervention_id , parcelle_id , arbre_id , date_prevue , statut 
    });
    
    // ÉTAPE 1 : créer l'intervention principale (même logique que ton code actuel)
    const interventionResult = await client.query(
      `INSERT INTO interventions 
       (type_intervention_id , parcelle_id , arbre_id , date_prevue , date_realisee, 
        duree_minutes, personnel, description, cout, statut, meteo, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        emptyToNull(type_intervention_id),
        emptyToNull(parcelle_id),
        emptyToNull(arbre_id),
        date_prevue ,
        emptyToNull(date_realisee),
        emptyToNull(duree_minutes),
        personnel || '',
        description || '',
        emptyToNull(cout),
        statut || 'Planifié',
        emptyToNull(meteo),
        emptyToNull(notes)
      ]
    );
    
    const intervention = interventionResult.rows[0];
    const interventionId = intervention.id;
    console.log('✅ Intervention créée, ID:', interventionId);

    // ÉTAPE 2 : créer une ligne dans intervention_details SI des champs de détail sont fournis
    const detailsRaw = {
      volume_eau_m3,
      volume_eau_par_arbre_l,
      methode_irrigation,
      source_eau,
      debit_l_h,
      frequence_irrigation,
      humidite_sol_avant,
      humidite_sol_apres,
      pression_bar,
      categorie_traitement,
      nom_commercial,
      matiere_active,
      numero_amm,
      dose_produit_ha,
      dose_produit_arbre,
      concentration,
      volume_bouillie_l,
      surface_traitee_ha,
      methode_application,
      cible_traitement,
      delai_avant_recolte_jours,
      conditions_application,
      equipement_protection,
      zone_non_traitee_m,
      fabricant
      // ajoute ici les autres champs de intervention_details si tu en as
    };

    // Filtrer pour ne garder que les champs réellement renseignés
	// ✓ Accepter les zéros et chaînes vides
	const detailFields = Object.entries(detailsRaw)
	  .filter(([_, value]) => value !== undefined && value !== null)
	  // Ne filtrer que undefined et null
	  
	  // Convertir les chaînes vides en null pour la base
	  .map(([key, value]) => [key, value === '' ? null : value]);




    if (detailFields.length > 0) {
      const columns = ['intervention_id'];
      const values = [interventionId];
      const placeholders = ['$1'];
      let idx = 2;

      for (const [field, value] of detailFields) {
        columns.push(field);
        values.push(value);
        placeholders.push(`$${idx++}`);
      }

      console.log('📝 Insertion intervention_details:', { columns });

      await client.query(
        `INSERT INTO intervention_details (${columns.join(', ')})
         VALUES (${placeholders.join(', ')})`,
        values
      );
    } else {
      console.log('ℹ️ Aucun détail spécifique fourni, pas d'entrée dans intervention_details');
    }

    await client.query('COMMIT');

    res.status(201).json(intervention);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur création intervention (transaction):', err);
    res.status(500).json({ 
      error: 'Erreur lors de la création de l\'intervention', 
      details: err.message 
    });
  } finally {
    client.release();
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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


// ==================== ROUTES INTERVENTION DETAILS ====================

// GET - Récupérer les détails d'une intervention
app.get('/api/interventions/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM intervention_details WHERE intervention_id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur récupération détails intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
});

// POST - Créer ou mettre Ã  jour les détails d'une intervention
app.post('/api/interventions/:id/details', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const details = req.body;
    
    // Vérifier que l'intervention existe
    const interventionCheck = await pool.query('SELECT id FROM interventions WHERE id = $1', [id]);
    if (interventionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }
    
    // Vérifier si des détails existent déjÃ 
    const existingDetails = await pool.query(
      'SELECT id FROM intervention_details WHERE intervention_id = $1',
      [id]
    );
    
    // Construire dynamiquement la requête selon les champs fournis
    const fields = Object.keys(details).filter(key => details[key] !== undefined && details[key] !== '');
    
    if (fields.length === 0) {
      return res.json({ message: 'Aucun détail Ã  enregistrer' });
    }
    
    let result;
    
    if (existingDetails.rows.length > 0) {
      // UPDATE
      const setClauses = fields.map((field, index) => `${field} = $${index + 1}`);
      const values = fields.map(field => details[field] === '' ? null : details[field]);
      values.push(id);
      
      result = await pool.query(
        `UPDATE intervention_details 
         SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP 
         WHERE intervention_id = $${values.length} 
         RETURNING *`,
        values
      );
    } else {
      // INSERT
      const columns = ['intervention_id', ...fields];
      const placeholders = columns.map((_, index) => `$${index + 1}`);
      const values = [id, ...fields.map(field => details[field] === '' ? null : details[field])];
      
      result = await pool.query(
        `INSERT INTO intervention_details (${columns.join(', ')}) 
         VALUES (${placeholders.join(', ')}) 
         RETURNING *`,
        values
      );
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur sauvegarde détails intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des détails' });
  }
});

// DELETE - Supprimer les détails d'une intervention
app.delete('/api/interventions/:id/details', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM intervention_details WHERE intervention_id = $1', [id]);
    res.json({ message: 'Détails supprimés' });
  } catch (err) {
    console.error('Erreur suppression détails intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES PRODUITS PHYTO ====================

// GET - Liste des produits phytosanitaires
app.get('/api/produits-phyto', async (req, res) => {
  try {
    const { categorie, bio_only } = req.query;
    let query = 'SELECT * FROM produits_phyto WHERE actif = true';
    const params = [];
    
    if (categorie) {
      params.push(categorie);
      query += ` AND categorie = $${params.length}`;
    }
    
    if (bio_only === 'true') {
      query += ' AND utilisable_bio = true';
    }
    
    query += ' ORDER BY nom_commercial';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération produits phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST - Ajouter un produit phytosanitaire
app.post('/api/produits-phyto', requireWriteAccess, async (req, res) => {
  try {
    const { 
      nom_commercial, matiere_active, numero_amm, categorie, 
      fabricant, dose_recommandee_ha, dar_jours, znt_metres, 
      utilisable_bio, phrase_risque, conseils_utilisation 
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO produits_phyto 
       (nom_commercial, matiere_active, numero_amm, categorie, fabricant, 
        dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio, phrase_risque, conseils_utilisation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [nom_commercial, matiere_active, numero_amm, categorie, fabricant,
       dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio || false, phrase_risque, conseils_utilisation]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création produit phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT - Modifier un produit phytosanitaire
app.put('/api/produits-phyto/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      nom_commercial, matiere_active, numero_amm, categorie, 
      fabricant, dose_recommandee_ha, dar_jours, znt_metres, 
      utilisable_bio, phrase_risque, conseils_utilisation, actif
    } = req.body;
    
    const result = await pool.query(
      `UPDATE produits_phyto SET 
       nom_commercial = $1, matiere_active = $2, numero_amm = $3, categorie = $4,
       fabricant = $5, dose_recommandee_ha = $6, dar_jours = $7, znt_metres = $8,
       utilisable_bio = $9, phrase_risque = $10, conseils_utilisation = $11, actif = $12
       WHERE id = $13 RETURNING *`,
      [nom_commercial, matiere_active, numero_amm, categorie, fabricant,
       dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio, phrase_risque, 
       conseils_utilisation, actif !== false, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur modification produit phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// DELETE - Désactiver un produit (soft delete)
app.delete('/api/produits-phyto/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE produits_phyto SET actif = false WHERE id = $1', [id]);
    res.json({ message: 'Produit désactivé' });
  } catch (err) {
    console.error('Erreur désactivation produit phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la désactivation' });
  }
});

// ==================== ROUTES AMENDEMENTS RÉFÉRENTIEL ====================

// GET - Liste des amendements
app.get('/api/amendements-ref', async (req, res) => {
  try {
    const { type, bio_only } = req.query;
    let query = 'SELECT * FROM amendements_ref WHERE actif = true';
    const params = [];
    
    if (type) {
      params.push(type);
      query += ` AND type_amendement = $${params.length}`;
    }
    
    if (bio_only === 'true') {
      query += ' AND utilisable_bio = true';
    }
    
    query += ' ORDER BY nom';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération amendements:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST - Ajouter un amendement
app.post('/api/amendements-ref', requireWriteAccess, async (req, res) => {
  try {
    const { nom, type_amendement, composition, dose_recommandee_ha, utilisable_bio, effet_principal, precautions } = req.body;
    
    const result = await pool.query(
      `INSERT INTO amendements_ref (nom, type_amendement, composition, dose_recommandee_ha, utilisable_bio, effet_principal, precautions)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nom, type_amendement, composition, dose_recommandee_ha, utilisable_bio || false, effet_principal, precautions]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création amendement:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// ==================== ROUTES STATISTIQUES INTERVENTIONS ====================

// GET - Statistiques des interventions par type et période
app.get('/api/interventions/stats', async (req, res) => {
  try {
    const { date_debut, date_fin, parcelle_id } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (date_debut) {
      params.push(date_debut);
      whereClause += ` AND i.date_realisee >= $${params.length}`;
    }
    if (date_fin) {
      params.push(date_fin);
      whereClause += ` AND i.date_realisee <= $${params.length}`;
    }
    if (parcelle_id) {
      params.push(parcelle_id);
      whereClause += ` AND i.parcelle_id = $${params.length}`;
    }
    
    // Statistiques par type d'intervention
    const statsByType = await pool.query(`
      SELECT 
        t.nom as type_intervention,
        t.couleur,
        COUNT(i.id) as nombre,
        COALESCE(SUM(i.cout), 0) as cout_total,
        COALESCE(AVG(i.duree_minutes), 0) as duree_moyenne
      FROM interventions i
      JOIN types_intervention t ON i.type_intervention_id = t.id
      ${whereClause}
      GROUP BY t.id, t.nom, t.couleur
      ORDER BY nombre DESC
    `, params);
    
    // Total général
    const totaux = await pool.query(`
      SELECT 
        COUNT(*) as total_interventions,
        COALESCE(SUM(cout), 0) as cout_total,
        COALESCE(SUM(duree_minutes), 0) as duree_totale_minutes
      FROM interventions i
      ${whereClause}
    `, params);
    
    res.json({
      par_type: statsByType.rows,
      totaux: totaux.rows[0]
    });
  } catch (err) {
    console.error('Erreur statistiques interventions:', err);
    res.status(500).json({ error: 'Erreur lors du calcul des statistiques' });
  }
});

// GET - Consommation d'eau par période
app.get('/api/interventions/stats/eau', async (req, res) => {
  try {
    const { date_debut, date_fin, parcelle_id } = req.query;
    
    let whereClause = `WHERE i.type_intervention_id = (SELECT id FROM types_intervention WHERE nom = 'Irrigation' LIMIT 1)`;
    const params = [];
    
    if (date_debut) {
      params.push(date_debut);
      whereClause += ` AND i.date_realisee >= $${params.length}`;
    }
    if (date_fin) {
      params.push(date_fin);
      whereClause += ` AND i.date_realisee <= $${params.length}`;
    }
    if (parcelle_id) {
      params.push(parcelle_id);
      whereClause += ` AND i.parcelle_id = $${params.length}`;
    }
    
    const result = await pool.query(`
      SELECT 
        p.nom as parcelle,
        COUNT(i.id) as nb_irrigations,
        COALESCE(SUM(id.volume_eau_m3), 0) as volume_total_m3,
        COALESCE(AVG(id.volume_eau_m3), 0) as volume_moyen_m3,
        COALESCE(SUM(i.duree_minutes), 0) as duree_totale_minutes
      FROM interventions i
      LEFT JOIN intervention_details id ON i.id = id.intervention_id
      LEFT JOIN parcelles p ON i.parcelle_id = p.id
      ${whereClause}
      GROUP BY p.id, p.nom
      ORDER BY volume_total_m3 DESC
    `, params);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur stats eau:', err);
    res.status(500).json({ error: 'Erreur lors du calcul' });
  }
});

// GET - Historique des traitements phytosanitaires (traçabilité)
app.get('/api/interventions/stats/traitements', async (req, res) => {
  try {
    const { date_debut, date_fin, parcelle_id } = req.query;
    
    let whereClause = `WHERE i.type_intervention_id = (SELECT id FROM types_intervention WHERE nom = 'Traitement' LIMIT 1)`;
    const params = [];
    
    if (date_debut) {
      params.push(date_debut);
      whereClause += ` AND i.date_realisee >= $${params.length}`;
    }
    if (date_fin) {
      params.push(date_fin);
      whereClause += ` AND i.date_realisee <= $${params.length}`;
    }
    if (parcelle_id) {
      params.push(parcelle_id);
      whereClause += ` AND i.parcelle_id = $${params.length}`;
    }
    
    const result = await pool.query(`
      SELECT 
        i.id,
        i.date_realisee,
        p.nom as parcelle,
        a.numero as arbre,
        id.nom_commercial,
        id.matiere_active,
        id.numero_amm,
        id.dose_produit_ha,
        id.surface_traitee_ha,
        id.volume_bouillie_L,
        id.methode_application,
        id.cible_traitement,
        id.delai_avant_recolte_jours,
        i.personnel,
        i.notes
      FROM interventions i
      LEFT JOIN intervention_details id ON i.id = id.intervention_id
      LEFT JOIN parcelles p ON i.parcelle_id = p.id
      LEFT JOIN arbres a ON i.arbre_id = a.id
      ${whereClause}
      ORDER BY i.date_realisee DESC
    `, params);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur stats traitements:', err);
    res.status(500).json({ error: 'Erreur lors du calcul' });
  }
});

// GET - Interventions complètes avec détails (pour export)
app.get('/api/interventions/export', async (req, res) => {
  try {
    const { date_debut, date_fin, type_id, parcelle_id, statut } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (date_debut) {
      params.push(date_debut);
      whereClause += ` AND i.date_prevue >= $${params.length}`;
    }
    if (date_fin) {
      params.push(date_fin);
      whereClause += ` AND i.date_prevue <= $${params.length}`;
    }
    if (type_id) {
      params.push(type_id);
      whereClause += ` AND i.type_intervention_id = $${params.length}`;
    }
    if (parcelle_id) {
      params.push(parcelle_id);
      whereClause += ` AND i.parcelle_id = $${params.length}`;
    }
    if (statut) {
      params.push(statut);
      whereClause += ` AND i.statut = $${params.length}`;
    }
    
    const result = await pool.query(`
      SELECT 
        i.*,
        t.nom as type_nom,
        p.nom as parcelle_nom,
        a.numero as arbre_numero,
        id.*
      FROM interventions i
      LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
      LEFT JOIN parcelles p ON i.parcelle_id = p.id
      LEFT JOIN arbres a ON i.arbre_id = a.id
      LEFT JOIN intervention_details id ON i.id = id.intervention_id
      ${whereClause}
      ORDER BY i.date_prevue DESC
    `, params);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur export interventions:', err);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

// ============================================================================
// FIN DES ROUTES API
// ============================================================================


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
    const { parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, exposition, conditions_meteo, temperature_sol, caveur, chien, notes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO recoltes (parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, exposition, conditions_meteo, temperature_sol, caveur, chien, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [parcelle_id || null, arbre_id || null, date_recolte, poids_grammes, qualite || null, calibre || null, maturite || null, profondeur_cm || null, exposition || null, conditions_meteo || null, temperature_sol || null, caveur || null, chien || null, notes || null]
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
    const { parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, exposition, conditions_meteo, temperature_sol, caveur, chien, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE recoltes SET parcelle_id = $1, arbre_id = $2, date_recolte = $3, poids_grammes = $4,
        qualite = $5, calibre = $6, maturite = $7, profondeur_cm = $8, exposition = $9, conditions_meteo = $10,
        temperature_sol = $11, caveur = $12, chien = $13, notes = $14 WHERE id = $15 RETURNING *`,
      [parcelle_id || null, arbre_id || null, date_recolte, poids_grammes, qualite || null, calibre || null, maturite || null, profondeur_cm || null, exposition || null, conditions_meteo || null, temperature_sol || null, caveur || null, chien || null, notes || null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Récolte non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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
    const result = await pool.query(
      `SELECT c.*, COUNT(r.id) as nombre_recoltes, SUM(r.poids_grammes) as poids_total
       FROM clients c
       LEFT JOIN recoltes r ON c.id = r.client_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});
