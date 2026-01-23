require('dotenv').config();

const express = require('express');
const app = express();

// Configuration & Utils
const { validateEnv } = require('./config/env');
const { pool, testDatabaseConnection } = require('./config/database');
const logger = require('./utils/logger');

// Middlewares
const { helmet, cors, apiLimiter } = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import des routes modulaires
const apiRoutes = require('./routes/index');

// Initialisation
validateEnv();
const PORT = process.env.PORT || 3001;

// Middlewares Globaux
app.use(helmet());
app.use(cors);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

// Logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Montage des routes (Toute la logique de routage est ici)
app.use('/api', apiRoutes);

// Gestion des erreurs
app.use(notFoundHandler);
app.use(errorHandler);

// Démarrage
async function startServer() {
  try {
    await testDatabaseConnection();
    app.listen(PORT, () => {
      logger.success(`Serveur démarré sur le port ${PORT}`);
    });
  } catch (error) {
    logger.error('Erreur au démarrage:', error);
    process.exit(1);
  }
}

// Arrêt gracieux
const gracefulShutdown = async (signal) => {
  logger.warning(`Signal ${signal} reçu, arrêt en cours...`);
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();

module.exports = app;
