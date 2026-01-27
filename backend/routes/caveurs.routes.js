// backend/routes/caveurs.routes.js
const express = require('express');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/caveurs - Liste des caveurs
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM caveurs ORDER BY nom');
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la récupération des caveurs' });
    }
  });

  // POST /api/caveurs - Créer un caveur
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { nom } = req.body;
      const result = await pool.query(
        'INSERT INTO caveurs (nom) VALUES ($1) RETURNING *', 
        [nom]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la création du caveur' });
    }
  });

  // PUT /api/caveurs/:id - Modifier un caveur
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { nom } = req.body;
      const result = await pool.query(
        'UPDATE caveurs SET nom = $1 WHERE id = $2 RETURNING *', 
        [nom, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Caveur non trouvé' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
  });

  // DELETE /api/caveurs/:id - Supprimer un caveur
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'DELETE FROM caveurs WHERE id = $1 RETURNING *', 
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Caveur non trouvé' });
      }
      res.json({ message: 'Caveur supprimé' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  });

  return router;
};
