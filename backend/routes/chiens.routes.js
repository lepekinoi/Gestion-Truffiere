// backend/routes/chiens.routes.js
const express = require('express');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/chiens - Liste des chiens
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM chiens ORDER BY nom');
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la récupération des chiens' });
    }
  });

  // POST /api/chiens - Créer un chien
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { nom, race } = req.body;
      const result = await pool.query(
        'INSERT INTO chiens (nom, race) VALUES ($1, $2) RETURNING *', 
        [nom, race || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la création du chien' });
    }
  });

  // PUT /api/chiens/:id - Modifier un chien
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { nom, race } = req.body;
      const result = await pool.query(
        'UPDATE chiens SET nom = $1, race = $2 WHERE id = $3 RETURNING *', 
        [nom, race || null, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Chien non trouvé' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
  });

  // DELETE /api/chiens/:id - Supprimer un chien
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'DELETE FROM chiens WHERE id = $1 RETURNING *', 
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Chien non trouvé' });
      }
      res.json({ message: 'Chien supprimé' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  });

  return router;
};
