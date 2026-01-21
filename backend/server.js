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

// Routes d'authentification (voir fichier original pour le code complet)
// ...
// [Le reste du code d'authentification reste inchangé]

// ... (insertion de tout le code middleware et routes d'authentification ici - trop long pour afficher)

// ==================== ROUTES STATISTIQUES ====================

app.get('/api/stats/recoltes-mensuelles', async (req, res) => {
  try {
    // ✅ FIX: Retirer la limite de 12 mois pour afficher toutes les années
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

// ... (le reste du code reste inchangé)
