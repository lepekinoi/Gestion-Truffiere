// backend/routes/types-intervention.routes.js
const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/types-intervention - Liste des types d'intervention
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM types_intervention ORDER BY nom'
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
    }
  });

  return router;
};
