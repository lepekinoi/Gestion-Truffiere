// routes/index.js - VERSION COMPLÈTE

const express = require('express');
const router = express.Router();

// Import de TOUTES les routes
const authRoutes = require('./auth.routes');
const parcellesRoutes = require('./parcelles.routes');
const arbresRoutes = require('./arbres.routes');
const interventionsRoutes = require('./interventions.routes');
const recoltesRoutes = require('./recoltes.routes');
const referentielsRoutes = require('./referentiels.routes');
const commercesRoutes = require('./commerces.routes');
const historiqueRoutes = require('./historique.routes');
const utilitairesRoutes = require('./utilitaires.routes');
const achatsRoutes = require('./achats.routes');

// Montage de TOUTES les routes
router.use('/auth', authRoutes);
router.use('/parcelles', parcellesRoutes);
router.use('/arbres', arbresRoutes);
router.use('/interventions', interventionsRoutes);
router.use('/recoltes', recoltesRoutes);
router.use('/referentiels', referentielsRoutes);
router.use('/commerces', commercesRoutes);
router.use('/historique', historiqueRoutes);
router.use('/utilitaires', utilitairesRoutes);
router.use('/achats', achatsRoutes);

// Route de santé
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
