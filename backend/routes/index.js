// ====================================================================
// routes/index.js - Agrégateur central des routes
// ====================================================================

const express = require('express');
const router = express.Router();

// Import des routes
const authRoutes = require('./auth.routes');
const parcellesRoutes = require('./parcelles.routes');
const achatsRoutes = require('./achats.routes');

// Montage des routes
router.use('/auth', authRoutes);
router.use('/parcelles', parcellesRoutes);
router.use('/achats', achatsRoutes);

// Route de santé (health check)
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
