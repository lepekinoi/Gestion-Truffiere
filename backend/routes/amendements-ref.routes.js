// backend/routes/amendements-ref.routes.js
const express = require('express');
const { emptyToNull, logAuditTrail } = require('../utils');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/amendements-ref - Liste des amendements
  router.get('/', async (req, res) => {
    try {
      const { type, bio_only } = req.query;
      let query = 'SELECT * FROM amendements_ref WHERE actif = true';
      const params = [];
      
      if (type) {
        params.push(type);
        query += ` AND type_amendement = $${params.length}`;
      }
      
      if (bio_only === 'true') {
        query += ' AND utilisable_bio = true';
      }
      
      query += ' ORDER BY nom';
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération amendements:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des amendements',
        code: 'LIST_AMENDEMENTS_ERROR'
      });
    }
  });

  // POST /api/amendements-ref - Ajouter un amendement
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { 
        nom, type_amendement, composition, dose_recommandee_ha, 
        utilisable_bio, effet_principal, precautions 
      } = req.body;
      
      const result = await pool.query(
        `INSERT INTO amendements_ref 
         (nom, type_amendement, composition, dose_recommandee_ha, 
          utilisable_bio, effet_principal, precautions)
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [
          nom, 
          type_amendement, 
          emptyToNull(composition), 
          emptyToNull(dose_recommandee_ha), 
          utilisable_bio || false, 
          emptyToNull(effet_principal), 
          emptyToNull(precautions)
        ]
      );

      const newAmendement = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create', 'amendement_ref', newAmendement.id, null, newAmendement);
      }

      res.status(201).json(newAmendement);
    } catch (err) {
      console.error('Erreur création amendement:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la création de l\'amendement',
        code: 'CREATE_AMENDEMENT_ERROR',
        details: err.message
      });
    }
  });

  // PUT /api/amendements-ref/:id - Modifier un amendement
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        nom, type_amendement, composition, dose_recommandee_ha, 
        utilisable_bio, effet_principal, precautions, actif 
      } = req.body;
      
      // Récupérer anciennes valeurs
      const oldDataResult = await pool.query(
        'SELECT * FROM amendements_ref WHERE id = $1',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Amendement non trouvé',
          code: 'AMENDEMENT_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        `UPDATE amendements_ref SET 
         nom = $1, type_amendement = $2, composition = $3, 
         dose_recommandee_ha = $4, utilisable_bio = $5, 
         effet_principal = $6, precautions = $7, actif = $8
         WHERE id = $9 
         RETURNING *`,
        [
          nom, 
          type_amendement, 
          emptyToNull(composition), 
          emptyToNull(dose_recommandee_ha), 
          utilisable_bio, 
          emptyToNull(effet_principal), 
          emptyToNull(precautions), 
          actif !== false, 
          id
        ]
      );
      
      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'amendement_ref', parseInt(id), oldData, newData);
      }

      res.json(newData);
    } catch (err) {
      console.error('Erreur modification amendement:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la modification de l\'amendement',
        code: 'UPDATE_AMENDEMENT_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/amendements-ref/:id - Désactiver un amendement (soft delete)
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Récupérer les données
      const oldDataResult = await pool.query(
        'SELECT * FROM amendements_ref WHERE id = $1',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Amendement non trouvé',
          code: 'AMENDEMENT_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      await pool.query(
        'UPDATE amendements_ref SET actif = false WHERE id = $1', 
        [id]
      );

      // Audit trail (soft delete)
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'soft_delete', 'amendement_ref', parseInt(id), oldData, { ...oldData, actif: false });
      }

      res.json({ 
        message: 'Amendement désactivé',
        code: 'AMENDEMENT_DEACTIVATED'
      });
    } catch (err) {
      console.error('Erreur désactivation amendement:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la désactivation de l\'amendement',
        code: 'DEACTIVATE_AMENDEMENT_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
