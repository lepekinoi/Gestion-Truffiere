const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // GET - Liste des zones de production actives
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM zones_production_truffes 
        WHERE actif = true 
        ORDER BY ordre_affichage ASC, nom ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Erreur récupération zones:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET - Zones groupées par région
  router.get('/par-region', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT region, json_agg(
          json_build_object(
            'id', id,
            'code', code,
            'nom', nom,
            'departement', departement,
            'departements', departements
          ) ORDER BY ordre_affichage
        ) as zones
        FROM zones_production_truffes 
        WHERE actif = true 
        GROUP BY region
        ORDER BY MIN(ordre_affichage)
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Erreur:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  return router;
};
