// backend/routes/caveurs.routes.js
const express = require('express');
const { logAuditTrail } = require('../utils');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/caveurs - Liste des caveurs
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM caveurs ORDER BY nom');
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération caveurs:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des caveurs',
        code: 'LIST_CAVEURS_ERROR'
      });
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

      const newCaveur = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create', 'caveur', newCaveur.id, null, newCaveur);
      }

      res.status(201).json(newCaveur);
    } catch (err) {
      console.error('Erreur création caveur:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la création du caveur',
        code: 'CREATE_CAVEUR_ERROR',
        details: err.message
      });
    }
  });

  // PUT /api/caveurs/:id - Modifier un caveur
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { nom } = req.body;

      // Récupérer anciennes valeurs
      const oldDataResult = await pool.query('SELECT * FROM caveurs WHERE id = $1', [id]);
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Caveur non trouvé',
          code: 'CAVEUR_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];

      const result = await pool.query(
        'UPDATE caveurs SET nom = $1 WHERE id = $2 RETURNING *', 
        [nom, id]
      );

      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'caveur', parseInt(id), oldData, newData);
      }

      res.json(newData);
    } catch (err) {
      console.error('Erreur mise à jour caveur:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour du caveur',
        code: 'UPDATE_CAVEUR_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/caveurs/:id - Supprimer un caveur
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;

      // Récupérer les données
      const oldDataResult = await pool.query('SELECT * FROM caveurs WHERE id = $1', [id]);
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Caveur non trouvé',
          code: 'CAVEUR_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];

      const result = await pool.query(
        'DELETE FROM caveurs WHERE id = $1 RETURNING *', 
        [id]
      );

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'delete', 'caveur', parseInt(id), oldData, null);
      }

      res.json({ 
        message: 'Caveur supprimé',
        code: 'CAVEUR_DELETED'
      });
    } catch (err) {
      console.error('Erreur suppression caveur:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la suppression du caveur',
        code: 'DELETE_CAVEUR_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
