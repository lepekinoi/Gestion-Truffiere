// ====================================================================
// server.js - API Truffiere avec Authentification JWT
// Version 3.0.0 - Architecture modulaire
// ====================================================================

require('dotenv').config();

// ====================================================================
// IMPORTS - Modules principaux
// ====================================================================
const express = require('express');
const app = express();

// ====================================================================
// IMPORTS - Configuration
// ====================================================================
const { validateEnv } = require('./config/env');
const { pool, testDatabaseConnection } = require('./config/database');
const logger = require('./utils/logger');

// ====================================================================
// IMPORTS - Middleware de sécurité
// ====================================================================
const { helmet, cors, apiLimiter } = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// ====================================================================
// IMPORTS - Routes
// ====================================================================
const apiRoutes = require('./routes/index');

// ====================================================================
// VALIDATION ENVIRONNEMENT
// ====================================================================
validateEnv();

const PORT = process.env.PORT || 3001;

// ====================================================================
// MIDDLEWARE GLOBAUX
// ====================================================================

// Sécurité
app.use(helmet());
app.use(cors);

// Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy (pour rate limiting derrière un reverse proxy)
app.set('trust proxy', 1);

// Rate limiting global
app.use('/api', apiLimiter);

// Logs des requêtes
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ====================================================================
// ROUTES
// ====================================================================

// Route de base
app.get('/', (req, res) => {
  res.json({
    message: 'API Gestion Truffiere',
    version: '3.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      parcelles: '/api/parcelles',
      achats: '/api/achats'
    }
  });
});

// Montage des routes API
app.use('/api', apiRoutes);

// ====================================================================
// GESTION DES ERREURS
// ====================================================================

// Route non trouvée (404)
app.use(notFoundHandler);

// Gestionnaire d'erreurs global
app.use(errorHandler);

// ====================================================================
// DÉMARRAGE DU SERVEUR
// ====================================================================

async function startServer() {
  try {
    // Test de connexion à la base de données
    await testDatabaseConnection();
    
    // Démarrage du serveur
    app.listen(PORT, () => {
      logger.success(`Serveur démarré sur le port ${PORT}`);
      logger.info(`Environnement: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Gestion propre de l'arrêt
process.on('SIGTERM', async () => {
  logger.warning('Signal SIGTERM reçu, arrêt gracieux...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.warning('Signal SIGINT reçu, arrêt gracieux...');
  await pool.end();
  process.exit(0);
});

// Démarrage
startServer();

module.exports = app;
