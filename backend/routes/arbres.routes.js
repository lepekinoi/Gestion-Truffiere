// backend/routes/arbres.routes.js
const express = require('express');
const { emptyToNull, logAuditTrail, logSecurityEvent } = require('../utils');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/arbres - Liste des arbres (avec option includeDeleted)
  router.get('/', async (req, res) => {
    try {
      const { includeDeleted } = req.query;
      let query = `
        SELECT a.*, p.nom as parcelle_nom
        FROM arbres a
        LEFT JOIN parcelles p ON a.parcelle_id = p.id
      `;
      
      if (includeDeleted !== 'true') {
        query += ' WHERE a.deleted_at IS NULL';
      }
      
      query += ' ORDER BY a.numero';
      
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération arbres:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des arbres',
        code: 'LIST_ARBRES_ERROR'
      });
    }
  });

  // GET /api/arbres/corbeille - Arbres supprimés (soft delete)
  router.get('/corbeille', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT a.*, p.nom as parcelle_nom
        FROM arbres a
        LEFT JOIN parcelles p ON a.parcelle_id = p.id
        WHERE a.deleted_at IS NOT NULL
        ORDER BY a.deleted_at DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération corbeille:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération de la corbeille',
        code: 'GET_CORBEILLE_ERROR'
      });
    }
  });

  // POST /api/arbres - Créer un arbre
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { 
        parcelle_id, numero, espece, variete_truffe, date_plantation, 
        porte_greffe, rendement_estimé, circonference_cm, hauteur_m, 
        latitude, longitude, notes, etat_sanitaire 
      } = req.body;
      
      const result = await pool.query(
        `INSERT INTO arbres (
          parcelle_id, numero, espece, variete_truffe, date_plantation, 
          porte_greffe, rendement_estimé, circonference_cm, hauteur_m, 
          latitude, longitude, notes, etat_sanitaire
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
        RETURNING *`,
        [
          emptyToNull(parcelle_id),
          numero,
          espece,
          emptyToNull(variete_truffe),
          emptyToNull(date_plantation),
          emptyToNull(porte_greffe),
          emptyToNull(rendement_estimé),
          emptyToNull(circonference_cm),
          emptyToNull(hauteur_m),
          emptyToNull(latitude),
          emptyToNull(longitude),
          emptyToNull(notes),
          emptyToNull(etat_sanitaire) || 'bon'
        ]
      );

      const newArbre = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create', 'arbre', newArbre.id, null, newArbre);
      }

      res.status(201).json(newArbre);
    } catch (err) {
      console.error('Erreur création arbre:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la création de l\'arbre',
        code: 'CREATE_ARBRE_ERROR',
        details: err.message 
      });
    }
  });

  // PUT /api/arbres/:id - Modifier un arbre
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        parcelle_id, numero, espece, variete_truffe, date_plantation, 
        porte_greffe, rendement_estimé, circonference_cm, hauteur_m, 
        date_derniere_taille, latitude, longitude, notes, etat_sanitaire 
      } = req.body;
      
      // Récupérer anciennes valeurs pour audit trail ET pour préserver les coordonnées
      const oldDataResult = await pool.query(
        'SELECT * FROM arbres WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Arbre non trouvé',
          code: 'ARBRE_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      // ✅ FIX : Si latitude/longitude ne sont pas fournis ou sont null/vides,
      // utiliser les valeurs existantes
      const finalLatitude = (latitude !== undefined && latitude !== null && latitude !== '') 
        ? latitude 
        : oldData.latitude;
      const finalLongitude = (longitude !== undefined && longitude !== null && longitude !== '') 
        ? longitude 
        : oldData.longitude;
      
      const result = await pool.query(
        `UPDATE arbres SET 
          parcelle_id = $1, numero = $2, espece = $3, variete_truffe = $4, 
          date_plantation = $5, porte_greffe = $6, rendement_estimé = $7, 
          circonference_cm = $8, hauteur_m = $9, date_derniere_taille = $10, 
          latitude = $11, longitude = $12, notes = $13, etat_sanitaire = $14
        WHERE id = $15 AND deleted_at IS NULL 
        RETURNING *`,
        [
          emptyToNull(parcelle_id),
          numero,
          espece,
          emptyToNull(variete_truffe),
          emptyToNull(date_plantation),
          emptyToNull(porte_greffe),
          emptyToNull(rendement_estimé),
          emptyToNull(circonference_cm),
          emptyToNull(hauteur_m),
          emptyToNull(date_derniere_taille),
          finalLatitude,   // ✅ Utilise la valeur existante si non fournie
          finalLongitude,  // ✅ Utilise la valeur existante si non fournie
          emptyToNull(notes),
          emptyToNull(etat_sanitaire),
          id
        ]
      );
      
      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'arbre', parseInt(id), oldData, newData);
      }
      
      res.json(newData);
    } catch (err) {
      console.error('Erreur modification arbre:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour de l\'arbre',
        code: 'UPDATE_ARBRE_ERROR',
        details: err.message 
      });
    }
  });

  // POST /api/arbres/corbeille/:id/restaurer - Restaurer un arbre
  router.post('/corbeille/:id/restaurer', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'UPDATE arbres SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Arbre non trouvé dans la corbeille',
          code: 'ARBRE_NOT_IN_TRASH'
        });
      }

      const restoredArbre = result.rows[0];

      // Security event
      if (req.user && req.user.id) {
        await logSecurityEvent(pool, req.user.id, 'arbre_restored', {
          arbreId: parseInt(id),
          arbreNumero: restoredArbre.numero,
          restoredBy: req.user.id
        });
      }

      res.json({ 
        message: 'Arbre restauré', 
        arbre: restoredArbre 
      });
    } catch (err) {
      console.error('Erreur restauration arbre:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la restauration de l\'arbre',
        code: 'RESTORE_ARBRE_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/arbres/corbeille/:id - Suppression définitive d'un arbre
  router.delete('/corbeille/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Récupérer les données pour audit trail
      const oldDataResult = await pool.query(
        'SELECT * FROM arbres WHERE id = $1 AND deleted_at IS NOT NULL',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Arbre non trouvé dans la corbeille',
          code: 'ARBRE_NOT_IN_TRASH'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        'DELETE FROM arbres WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
        [id]
      );
      
      // Audit trail (suppression définitive)
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'delete_permanent', 'arbre', parseInt(id), oldData, null);
      }

      res.json({ 
        message: 'Arbre supprimé définitivement', 
        arbre: result.rows[0] 
      });
    } catch (err) {
      console.error('Erreur suppression définitive arbre:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la suppression définitive de l\'arbre',
        code: 'DELETE_PERMANENT_ARBRE_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/arbres/corbeille - Vider la corbeille
  router.delete('/corbeille', requireWriteAccess, async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Récupérer les IDs des arbres à supprimer
      const treesToDelete = await client.query(
        'SELECT id FROM arbres WHERE deleted_at IS NOT NULL'
      );
      const treeIds = treesToDelete.rows.map(row => row.id);
      
      if (treeIds.length === 0) {
        await client.query('COMMIT');
        return res.json({ message: 'Corbeille vide', count: 0 });
      }
      
      // Supprimer les références en cascade
      await client.query('DELETE FROM interventions WHERE arbre_id = ANY($1)', [treeIds]);
      await client.query('DELETE FROM recoltes WHERE arbre_id = ANY($1)', [treeIds]);
      
      // Enfin, supprimer les arbres
      const result = await client.query('DELETE FROM arbres WHERE deleted_at IS NOT NULL RETURNING id');
      
      await client.query('COMMIT');

      // Security event
      if (req.user && req.user.id) {
        await logSecurityEvent(pool, req.user.id, 'trash_emptied', {
          entity: 'arbres',
          count: result.rows.length,
          treeIds: treeIds
        });
      }

      res.json({ 
        message: 'Corbeille vidée', 
        count: result.rows.length 
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erreur vidage corbeille:', err);
      res.status(500).json({ 
        error: 'Erreur lors du vidage de la corbeille',
        code: 'EMPTY_TRASH_ERROR',
        details: err.message 
      });
    } finally {
      client.release();
    }
  });

  // DELETE /api/arbres/:id - Soft delete (mise à la corbeille)
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Récupérer les données pour audit trail
      const oldDataResult = await pool.query(
        'SELECT * FROM arbres WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Arbre non trouvé',
          code: 'ARBRE_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        'UPDATE arbres SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
        [id]
      );
      
      // Audit trail (soft delete)
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'soft_delete', 'arbre', parseInt(id), oldData, result.rows[0]);
      }

      res.json({ 
        message: 'Arbre mis à la corbeille', 
        arbre: result.rows[0] 
      });
    } catch (err) {
      console.error('Erreur soft delete arbre:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à la corbeille de l\'arbre',
        code: 'SOFT_DELETE_ARBRE_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
