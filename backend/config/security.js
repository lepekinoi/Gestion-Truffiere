// ============================================================
// config/security.js
// Configuration de sécurité pour l'API
// ============================================================

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

/**
 * Configuration CORS
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Liste des origines autorisées
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
      : [process.env.FRONTEND_URL];
    
    // Permettre les requêtes sans origin (apps mobiles, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origine bloquée - ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400 // Cache preflight pendant 24h
};

/**
 * Configuration Helmet (headers de sécurité)
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openweathermap.org"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,        // 1 an
    includeSubDomains: true,
    preload: true
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

/**
 * Rate limiter global (toutes les requêtes)
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requêtes par fenêtre
  message: {
    error: 'Trop de requêtes, veuillez réessayer plus tard',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 15 * 60 // secondes
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Ne pas limiter les health checks
    return req.path === '/api/health';
  }
});

/**
 * Rate limiter pour l'authentification (plus strict)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives max
  message: {
    error: 'Trop de tentatives de connexion, compte temporairement bloqué',
    code: 'AUTH_RATE_LIMIT',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Ne compte pas les succès
  keyGenerator: (req) => {
    // Limiter par IP + email si disponible
    const email = req.body?.email || '';
    return `${req.ip}-${email}`;
  }
});

/**
 * Rate limiter pour la création de compte
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 créations max par heure
  message: {
    error: 'Trop de créations de compte, veuillez réessayer plus tard',
    code: 'REGISTER_RATE_LIMIT',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter pour réinitialisation de mot de passe
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // 3 demandes max par heure
  message: {
    error: 'Trop de demandes de réinitialisation, veuillez réessayer plus tard',
    code: 'RESET_RATE_LIMIT',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter pour les API sensibles (export, etc.)
 */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requêtes par minute
  message: {
    error: 'Trop de requêtes sur cette ressource',
    code: 'SENSITIVE_RATE_LIMIT',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Configuration des cookies sécurisés
 */
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
};

/**
 * Configuration bcrypt
 */
const bcryptConfig = {
  saltRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
};

/**
 * Liste des routes publiques (sans authentification)
 */
const publicRoutes = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password'
];

/**
 * Vérifie si une route est publique
 */
const isPublicRoute = (path, method) => {
  return publicRoutes.some(route => {
    if (typeof route === 'string') {
      return path.startsWith(route);
    }
    return route.path === path && route.method === method;
  });
};

// À la fin du fichier
console.log('🔒 Configuration sécurité chargée :');
console.log(`   - CORS origines : ${process.env.CORS_ORIGINS || process.env.FRONTEND_URL}`);
console.log(`   - Rate limiting global : ${globalLimiter.max} req/${globalLimiter.windowMs/60000}min`);
console.log(`   - Rate limiting auth : ${authLimiter.max} req/${authLimiter.windowMs/60000}min`);

module.exports = {
  corsOptions,
  helmetConfig,
  globalLimiter,
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  sensitiveLimiter,
  cookieOptions,
  bcryptConfig,
  publicRoutes,
  isPublicRoute,
  cors: () => cors(corsOptions)
};
