// ====================================================================
// middleware/security.js - Configuration de sécurité (Rate limiting, CORS, Helmet)
// ====================================================================

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

// Configuration CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};

// Rate limiting pour les routes API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 requêtes par IP
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting strict pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 tentatives
  message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.',
  skipSuccessfulRequests: true
});

module.exports = {
  helmet,
  cors: cors(corsOptions),
  apiLimiter,
  authLimiter
};
