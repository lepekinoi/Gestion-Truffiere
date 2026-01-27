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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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
    res.json({ message: 'Arbre mis Ã  la corbeille', arbre: result.rows[0] });
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
      console.log('ℹ️ Aucun détail spécifique fourni, pas d’entrée dans intervention_details');
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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

// POST - Créer ou mettre Ã  jour les détails d'une intervention
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
      return res.json({ message: 'Aucun détail Ã  enregistrer' });
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
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
      return res.status(400).json({ error: 'Une vente existe déjÃ  pour cette commande' });
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
  }
});

app.post('/api/parametres/reset', requireWriteAccess, async (req, res) => {
  try {
    const defaults = {
      'colonnes_affichees_parcelles': '["nom", "surface_ha", "type_sol", "ph_sol", "date_creation"]',
      'colonnes_affichees_arbres': '["numero", "espece", "variete_truffe", "parcelle_nom", "etat_sanitaire", "date_plantation", "circonference_cm"]',
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

// Créer un nouveau paramètre
app.post('/api/parametres', requireWriteAccess, async (req, res) => {
  try {
    const { cle, valeur, description } = req.body;
    
    if (!cle || !cle.trim()) {
      return res.status(400).json({ error: 'La clé est obligatoire' });
    }
    
    // Vérifier si le paramètre existe déjÃ 
    const existing = await pool.query('SELECT id FROM parametres WHERE cle = $1', [cle.trim()]);
    
    if (existing.rows.length > 0) {
      // Mettre Ã  jour si existe
      const result = await pool.query(
        'UPDATE parametres SET valeur = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE cle = $3 RETURNING *',
        [valeur, description, cle.trim()]
      );
      return res.json(result.rows[0]);
    }
    
    // Créer nouveau
    const result = await pool.query(
      'INSERT INTO parametres (cle, valeur, description) VALUES ($1, $2, $3) RETURNING *',
      [cle.trim(), valeur, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création paramètre:', err);
    res.status(500).json({ error: 'Erreur lors de la création du paramètre' });
  }
});

// Mettre Ã  jour un paramètre par ID
app.put('/api/parametres/:id(\\d+)', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { cle, valeur, description } = req.body;
    
    const result = await pool.query(
      'UPDATE parametres SET cle = COALESCE($1, cle), valeur = COALESCE($2, valeur), description = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [cle, valeur, description, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paramètre non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur mise Ã  jour paramètre:', err);
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour' });
  }
});

// Supprimer un paramètre par ID
app.delete('/api/parametres/:id(\\d+)', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM parametres WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paramètre non trouvé' });
    }
    
    res.json({ message: 'Paramètre supprimé', parametre: result.rows[0] });
  } catch (err) {
    console.error('Erreur suppression paramètre:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
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
    const arbresParEtat = await pool.query('SELECT etat_sanitaire, COUNT(*) as count FROM arbres WHERE deleted_at IS NULL GROUP BY etat_sanitaire');
    
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
      pool.query(`SELECT etat_sanitaire, COUNT(*) as count FROM arbres WHERE deleted_at IS NULL GROUP BY etat_sanitaire
        ORDER BY CASE etat_sanitaire WHEN 'Bon' THEN 1 WHEN 'Moyen' THEN 2 WHEN 'Mauvais' THEN 3 WHEN 'Mort' THEN 4 ELSE 5 END`),
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
        arbres: { count: parseInt(arbresCount.rows[0].count), parEtat: arbresParEtat.rows.map(r => ({ etat_sanitaire: r.etat_sanitaire, count: parseInt(r.count) })) },
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
// ROUTES STOCK AUTOMATIQUE
// ============================================================

// Calcul du stock automatique (Récoltes - Ventes payées)
app.get('/api/stock', async (req, res) => {
  try {
    // Total récolté
    const totalRecolte = await pool.query(`
      SELECT COALESCE(SUM(poids_grammes), 0) as total_grammes
      FROM recoltes
    `);

    // Total vendu (uniquement ventes payées)
    const totalVendu = await pool.query(`
      SELECT COALESCE(SUM(quantite_grammes), 0) as total_grammes
      FROM ventes
      WHERE statut = 'Payée'
    `);

    // Détail par qualité et calibre
    const detailsStock = await pool.query(`
      WITH recoltes_agg AS (
        SELECT 
          COALESCE(qualite, 'Non spécifié') as qualite,
          COALESCE(calibre, 'Non spécifié') as calibre,
          SUM(poids_grammes) as total_recolte
        FROM recoltes
        GROUP BY COALESCE(qualite, 'Non spécifié'), COALESCE(calibre, 'Non spécifié')
      ),
      ventes_agg AS (
        SELECT 
          COALESCE(r.qualite, 'Non spécifié') as qualite,
          COALESCE(r.calibre, 'Non spécifié') as calibre,
          SUM(v.quantite_grammes) as total_vendu
        FROM ventes v
        LEFT JOIN recoltes r ON v.recolte_id = r.id
        WHERE v.statut = 'Payée'
        GROUP BY COALESCE(r.qualite, 'Non spécifié'), COALESCE(r.calibre, 'Non spécifié')
      )
      SELECT 
        COALESCE(ra.qualite, va.qualite) as qualite,
        COALESCE(ra.calibre, va.calibre) as calibre,
        COALESCE(ra.total_recolte, 0) as recolte_grammes,
        COALESCE(va.total_vendu, 0) as vendu_grammes,
        COALESCE(ra.total_recolte, 0) - COALESCE(va.total_vendu, 0) as disponible_grammes
      FROM recoltes_agg ra
      FULL OUTER JOIN ventes_agg va ON ra.qualite = va.qualite AND ra.calibre = va.calibre
      ORDER BY qualite, calibre
    `);

    // Stock par saison (année de récolte)
    const stockParSaison = await pool.query(`
      WITH recoltes_saison AS (
        SELECT 
          CASE 
            WHEN EXTRACT(MONTH FROM date_recolte) >= 11 THEN 
              EXTRACT(YEAR FROM date_recolte)::text || '-' || (EXTRACT(YEAR FROM date_recolte) + 1)::text
            ELSE 
              (EXTRACT(YEAR FROM date_recolte) - 1)::text || '-' || EXTRACT(YEAR FROM date_recolte)::text
          END as saison,
          SUM(poids_grammes) as total_recolte
        FROM recoltes
        GROUP BY saison
      ),
      ventes_saison AS (
        SELECT 
          CASE 
            WHEN EXTRACT(MONTH FROM r.date_recolte) >= 11 THEN 
              EXTRACT(YEAR FROM r.date_recolte)::text || '-' || (EXTRACT(YEAR FROM r.date_recolte) + 1)::text
            ELSE 
              (EXTRACT(YEAR FROM r.date_recolte) - 1)::text || EXTRACT(YEAR FROM r.date_recolte)::text
          END as saison,
          SUM(v.quantite_grammes) as total_vendu
        FROM ventes v
        JOIN recoltes r ON v.recolte_id = r.id
        WHERE v.statut = 'Payée'
        GROUP BY saison
      )
      SELECT 
        COALESCE(rs.saison, vs.saison) as saison,
        COALESCE(rs.total_recolte, 0) as recolte_grammes,
        COALESCE(vs.total_vendu, 0) as vendu_grammes,
        COALESCE(rs.total_recolte, 0) - COALESCE(vs.total_vendu, 0) as disponible_grammes
      FROM recoltes_saison rs
      FULL OUTER JOIN ventes_saison vs ON rs.saison = vs.saison
      ORDER BY saison DESC
    `);

    // Prix moyen au kg pour estimation de valeur
    const prixMoyen = await pool.query(`
      SELECT COALESCE(AVG(prix_unitaire_kg), 800) as prix_moyen_kg
      FROM ventes
      WHERE statut = 'Payée' AND date_vente >= NOW() - INTERVAL '1 year'
    `);

    const stockDisponible = parseFloat(totalRecolte.rows[0].total_grammes) - parseFloat(totalVendu.rows[0].total_grammes);
    const prixMoyenKg = parseFloat(prixMoyen.rows[0].prix_moyen_kg);
    const valeurEstimee = (stockDisponible / 1000) * prixMoyenKg;
    const tauxUtilisation = parseFloat(totalRecolte.rows[0].total_grammes) > 0 
      ? (parseFloat(totalVendu.rows[0].total_grammes) / parseFloat(totalRecolte.rows[0].total_grammes)) * 100 
      : 0;

    res.json({
      stock_disponible_grammes: stockDisponible,
      total_recolte_grammes: parseFloat(totalRecolte.rows[0].total_grammes),
      total_vendu_grammes: parseFloat(totalVendu.rows[0].total_grammes),
      taux_utilisation: tauxUtilisation,
      prix_moyen_kg: prixMoyenKg,
      valeur_estimee: valeurEstimee,
      details_stock: detailsStock.rows.map(d => ({
        qualite: d.qualite,
        calibre: d.calibre,
        recolte_grammes: parseFloat(d.recolte_grammes),
        vendu_grammes: parseFloat(d.vendu_grammes),
        disponible_grammes: parseFloat(d.disponible_grammes)
      })),
      stock_par_saison: stockParSaison.rows.map(s => ({
        saison: s.saison,
        recolte_grammes: parseFloat(s.recolte_grammes),
        vendu_grammes: parseFloat(s.vendu_grammes),
        disponible_grammes: parseFloat(s.disponible_grammes)
      })),
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erreur calcul stock:', err);
    res.status(500).json({ error: 'Erreur lors du calcul du stock' });
  }
});

// Stock disponible pour une récolte spécifique
app.get('/api/stock/recolte/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const recolte = await pool.query(`
      SELECT poids_grammes FROM recoltes WHERE id = $1
    `, [id]);

    if (recolte.rows.length === 0) {
      return res.status(404).json({ error: 'Récolte non trouvée' });
    }

    const vendu = await pool.query(`
      SELECT COALESCE(SUM(quantite_grammes), 0) as total_vendu
      FROM ventes
      WHERE recolte_id = $1 AND statut = 'Payée'
    `, [id]);

    const poidsRecolte = parseFloat(recolte.rows[0].poids_grammes);
    const poidsVendu = parseFloat(vendu.rows[0].total_vendu);

    res.json({
      recolte_id: parseInt(id),
      poids_recolte: poidsRecolte,
      poids_vendu: poidsVendu,
      stock_disponible: poidsRecolte - poidsVendu
    });
  } catch (err) {
    console.error('Erreur stock récolte:', err);
    res.status(500).json({ error: 'Erreur lors du calcul du stock de la récolte' });
  }
});

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
