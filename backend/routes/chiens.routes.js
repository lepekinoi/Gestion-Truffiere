// backend/routes/chiens.routes.js
const express = require('express');
const { emptyToNull, logAuditTrail } = require('../utils');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/chiens - Liste des chiens
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM chiens ORDER BY nom');
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération chiens:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des chiens',
        code: 'LIST_CHIENS_ERROR'
      });
    }
  });

  // POST /api/chiens - Créer un chien
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { nom, race } = req.body;
      const result = await pool.query(
        'INSERT INTO chiens (nom, race) VALUES ($1, $2) RETURNING *', 
        [nom, emptyToNull(race)]
      );

      const newChien = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create', 'chien', newChien.id, null, newChien);
      }

      res.status(201).json(newChien);
    } catch (err) {
      console.error('Erreur création chien:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la création du chien',
        code: 'CREATE_CHIEN_ERROR',
        details: err.message
      });
    }
  });

  // PUT /api/chiens/:id - Modifier un chien
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { nom, race } = req.body;

      // Récupérer anciennes valeurs
      const oldDataResult = await pool.query('SELECT * FROM chiens WHERE id = $1', [id]);
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Chien non trouvé',
          code: 'CHIEN_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];

      const result = await pool.query(
        'UPDATE chiens SET nom = $1, race = $2 WHERE id = $3 RETURNING *', 
        [nom, emptyToNull(race), id]
      );

      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'chien', parseInt(id), oldData, newData);
      }

      res.json(newData);
    } catch (err) {
      console.error('Erreur mise à jour chien:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour du chien',
        code: 'UPDATE_CHIEN_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/chiens/:id - Supprimer un chien
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;

      // Récupérer les données
      const oldDataResult = await pool.query('SELECT * FROM chiens WHERE id = $1', [id]);
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Chien non trouvé',
          code: 'CHIEN_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];

      const result = await pool.query(
        'DELETE FROM chiens WHERE id = $1 RETURNING *', 
        [id]
      );

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'delete', 'chien', parseInt(id), oldData, null);
      }

      res.json({ 
        message: 'Chien supprimé',
        code: 'CHIEN_DELETED'
      });
    } catch (err) {
      console.error('Erreur suppression chien:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la suppression du chien',
        code: 'DELETE_CHIEN_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
