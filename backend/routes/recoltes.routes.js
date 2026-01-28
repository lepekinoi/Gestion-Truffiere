// backend/routes/recoltes.routes.js
const express = require('express');
const { emptyToNull, logAuditTrail } = require('../utils');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/recoltes - Liste des récoltes
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT r.*, p.nom as parcelle_nom, a.numero as arbre_numero
        FROM recoltes r
        LEFT JOIN parcelles p ON r.parcelle_id = p.id
        LEFT JOIN arbres a ON r.arbre_id = a.id
        ORDER BY r.date_recolte DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération récoltes:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des récoltes',
        code: 'LIST_RECOLTES_ERROR'
      });
    }
  });

  // POST /api/recoltes - Créer une récolte
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { 
        parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, 
        calibre, maturite, profondeur_cm, exposition, conditions_meteo, 
        temperature_sol, caveur, chien, notes 
      } = req.body;
      
      const result = await pool.query(
        `INSERT INTO recoltes (
          parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, 
          calibre, maturite, profondeur_cm, exposition, conditions_meteo, 
          temperature_sol, caveur, chien, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
        RETURNING *`,
        [
          emptyToNull(parcelle_id), 
          emptyToNull(arbre_id), 
          date_recolte, 
          poids_grammes, 
          emptyToNull(qualite), 
          emptyToNull(calibre), 
          emptyToNull(maturite), 
          emptyToNull(profondeur_cm), 
          emptyToNull(exposition), 
          emptyToNull(conditions_meteo), 
          emptyToNull(temperature_sol), 
          emptyToNull(caveur), 
          emptyToNull(chien), 
          emptyToNull(notes)
        ]
      );

      const newRecolte = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create', 'recolte', newRecolte.id, null, newRecolte);
      }

      res.status(201).json(newRecolte);
    } catch (err) {
      console.error('Erreur création récolte:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la création de la récolte',
        code: 'CREATE_RECOLTE_ERROR',
        details: err.message
      });
    }
  });

  // PUT /api/recoltes/:id - Modifier une récolte
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, 
        calibre, maturite, profondeur_cm, exposition, conditions_meteo, 
        temperature_sol, caveur, chien, notes 
      } = req.body;
      
      // Récupérer anciennes valeurs pour audit trail
      const oldDataResult = await pool.query(
        'SELECT * FROM recoltes WHERE id = $1',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Récolte non trouvée',
          code: 'RECOLTE_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        `UPDATE recoltes SET 
          parcelle_id = $1, arbre_id = $2, date_recolte = $3, poids_grammes = $4,
          qualite = $5, calibre = $6, maturite = $7, profondeur_cm = $8, 
          exposition = $9, conditions_meteo = $10, temperature_sol = $11, 
          caveur = $12, chien = $13, notes = $14 
        WHERE id = $15 
        RETURNING *`,
        [
          emptyToNull(parcelle_id), 
          emptyToNull(arbre_id), 
          date_recolte, 
          poids_grammes, 
          emptyToNull(qualite), 
          emptyToNull(calibre), 
          emptyToNull(maturite), 
          emptyToNull(profondeur_cm), 
          emptyToNull(exposition), 
          emptyToNull(conditions_meteo), 
          emptyToNull(temperature_sol), 
          emptyToNull(caveur), 
          emptyToNull(chien), 
          emptyToNull(notes), 
          id
        ]
      );
      
      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'recolte', parseInt(id), oldData, newData);
      }

      res.json(newData);
    } catch (err) {
      console.error('Erreur mise à jour récolte:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour de la récolte',
        code: 'UPDATE_RECOLTE_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/recoltes/:id - Supprimer une récolte
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Récupérer les données pour audit trail
      const oldDataResult = await pool.query(
        'SELECT * FROM recoltes WHERE id = $1',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Récolte non trouvée',
          code: 'RECOLTE_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        'DELETE FROM recoltes WHERE id = $1 RETURNING *', 
        [id]
      );
      
      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'delete', 'recolte', parseInt(id), oldData, null);
      }
      
      res.json({ 
        message: 'Récolte supprimée',
        code: 'RECOLTE_DELETED',
        recolte: result.rows[0] 
      });
    } catch (err) {
      console.error('Erreur suppression récolte:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la suppression de la récolte',
        code: 'DELETE_RECOLTE_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
