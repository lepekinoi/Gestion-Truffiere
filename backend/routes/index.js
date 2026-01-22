// ====================================================================
// routes/index.js - Agrégateur central des routes
// Version 3.0.0 - Toutes les routes de l'API
// ====================================================================

const express = require('express');
const router = express.Router();

// ====================================================================
// IMPORT DES ROUTES PAR DOMAINE MÉTIER
// ====================================================================

// 🔐 Authentification et gestion utilisateurs
const authRoutes = require('./auth.routes');

// 🌳 Gestion de la truffière
const parcellesRoutes = require('./parcelles.routes');
const arbresRoutes = require('./arbres.routes');
const interventionsRoutes = require('./interventions.routes');

// 📦 Récolte et commercialisation
const recoltesRoutes = require('./recoltes.routes');
const commercesRoutes = require('./commerces.routes');
const achatsRoutes = require('./achats.routes');

// 📚 Référentiels et données de base
const referentielsRoutes = require('./referentiels.routes');

// 🛠️ Outils et historique
const historiqueRoutes = require('./historique.routes');
const utilitairesRoutes = require('./utilitaires.routes');

// ====================================================================
// MONTAGE DES ROUTES SUR LEURS PRÉFIXES
// ====================================================================

// 🔐 Authentification - /api/auth/*
router.use('/auth', authRoutes);

// 🌳 Truffière - /api/parcelles/*, /api/arbres/*, /api/interventions/*
router.use('/parcelles', parcellesRoutes);
router.use('/arbres', arbresRoutes);
router.use('/interventions', interventionsRoutes);

// 📦 Récolte et ventes - /api/recoltes/*, /api/commerces/*, /api/achats/*
router.use('/recoltes', recoltesRoutes);
router.use('/commerces', commercesRoutes);
router.use('/achats', achatsRoutes);

// 📚 Référentiels - /api/referentiels/*
router.use('/referentiels', referentielsRoutes);

// 🛠️ Outils - /api/historique/*, /api/utilitaires/*
router.use('/historique', historiqueRoutes);
router.use('/utilitaires', utilitairesRoutes);

// ====================================================================
// ROUTE DE SANTÉ (HEALTH CHECK)
// ====================================================================

/**
 * GET /api/health
 * Vérifie que l'API est opérationnelle
 * @returns {Object} Status de l'API
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '3.0.0',
    service: 'API Gestion Truffière',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    routes: {
      auth: '/api/auth',
      parcelles: '/api/parcelles',
      arbres: '/api/arbres',
      interventions: '/api/interventions',
      recoltes: '/api/recoltes',
      commerces: '/api/commerces',
      achats: '/api/achats',
      referentiels: '/api/referentiels',
      historique: '/api/historique',
      utilitaires: '/api/utilitaires'
    }
  });
});

// ====================================================================
// ROUTE DE DOCUMENTATION
// ====================================================================

/**
 * GET /api
 * Documentation rapide de l'API
 */
router.get('/', (req, res) => {
  res.json({
    message: 'API Gestion Truffière',
    version: '3.0.0',
    documentation: '/api/health',
    endpoints: [
      { path: '/api/auth', description: 'Authentification et gestion utilisateurs' },
      { path: '/api/parcelles', description: 'Gestion des parcelles' },
      { path: '/api/arbres', description: 'Gestion des arbres truffiers' },
      { path: '/api/interventions', description: 'Gestion des interventions (irrigation, traitement, etc.)' },
      { path: '/api/recoltes', description: 'Gestion des récoltes de truffes' },
      { path: '/api/commerces', description: 'Gestion commerciale (clients, ventes, commandes)' },
      { path: '/api/achats', description: 'Gestion des achats' },
      { path: '/api/referentiels', description: 'Données de référence (caveurs, chiens, types, etc.)' },
      { path: '/api/historique', description: 'Historique des modifications' },
      { path: '/api/utilitaires', description: 'Outils et utilitaires (stats, export, recherche)' }
    ],
    security: {
      authentication: 'JWT Bearer Token',
      rateLimit: 'Actif',
      cors: 'Configuré'
    }
  });
});

module.exports = router;
