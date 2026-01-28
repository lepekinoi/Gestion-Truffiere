// backend/routes/parametres.routes.js
const express = require('express');
const { emptyToNull, logAuditTrail } = require('../utils');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/parametres - Liste tous les paramètres
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM parametres ORDER BY cle');
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération paramètres:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des paramètres',
        code: 'LIST_PARAMETRES_ERROR'
      });
    }
  });

  // GET /api/parametres/:cle - Récupérer un paramètre par clé
  router.get('/:cle', async (req, res) => {
    try {
      const { cle } = req.params;
      const result = await pool.query(
        'SELECT * FROM parametres WHERE cle = $1', 
        [cle]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Paramètre non trouvé',
          code: 'PARAMETRE_NOT_FOUND'
        });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erreur récupération paramètre:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération du paramètre',
        code: 'GET_PARAMETRE_ERROR'
      });
    }
  });

  // POST /api/parametres - Créer un paramètre (ou update si existe)
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { cle, valeur, description } = req.body;
      
      if (!cle || !cle.trim()) {
        return res.status(400).json({ 
          error: 'La clé est obligatoire',
          code: 'CLE_REQUIRED'
        });
      }
      
      // Vérifier si le paramètre existe déjà
      const existing = await pool.query(
        'SELECT * FROM parametres WHERE cle = $1', 
        [cle.trim()]
      );
      
      if (existing.rows.length > 0) {
        // Mettre à jour si existe
        const oldData = existing.rows[0];
        const result = await pool.query(
          `UPDATE parametres 
           SET valeur = $1, description = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE cle = $3 
           RETURNING *`,
          [valeur, emptyToNull(description), cle.trim()]
        );

        const newData = result.rows[0];

        // Audit trail
        if (req.user && req.user.id) {
          await logAuditTrail(pool, req.user.id, 'update', 'parametre', newData.id, oldData, newData);
        }

        return res.json(newData);
      }
      
      // Créer nouveau
      const result = await pool.query(
        'INSERT INTO parametres (cle, valeur, description) VALUES ($1, $2, $3) RETURNING *',
        [cle.trim(), valeur, emptyToNull(description)]
      );

      const newParametre = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create', 'parametre', newParametre.id, null, newParametre);
      }

      res.status(201).json(newParametre);
    } catch (err) {
      console.error('Erreur création paramètre:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la création du paramètre',
        code: 'CREATE_PARAMETRE_ERROR',
        details: err.message
      });
    }
  });

  // PUT /api/parametres/:cle - Mettre à jour un paramètre par clé (upsert)
  router.put('/:cle', requireWriteAccess, async (req, res) => {
    try {
      const { cle } = req.params;
      const { valeur } = req.body;
      
      // Vérifier si existe
      const existing = await pool.query(
        'SELECT * FROM parametres WHERE cle = $1',
        [cle]
      );

      if (existing.rows.length === 0) {
        // Créer si n'existe pas
        const insertResult = await pool.query(
          'INSERT INTO parametres (cle, valeur) VALUES ($1, $2) RETURNING *',
          [cle, valeur]
        );

        const newParametre = insertResult.rows[0];

        // Audit trail
        if (req.user && req.user.id) {
          await logAuditTrail(pool, req.user.id, 'create', 'parametre', newParametre.id, null, newParametre);
        }

        return res.json(newParametre);
      }

      // Update si existe
      const oldData = existing.rows[0];
      const result = await pool.query(
        'UPDATE parametres SET valeur = $1, updated_at = CURRENT_TIMESTAMP WHERE cle = $2 RETURNING *',
        [valeur, cle]
      );

      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'parametre', newData.id, oldData, newData);
      }

      res.json(newData);
    } catch (err) {
      console.error('Erreur mise à jour paramètre:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour du paramètre',
        code: 'UPDATE_PARAMETRE_ERROR',
        details: err.message
      });
    }
  });

  // PUT /api/parametres/:id(\\d+) - Mettre à jour un paramètre par ID
  router.put('/:id(\\d+)', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { cle, valeur, description } = req.body;
      
      // Récupérer anciennes valeurs
      const oldDataResult = await pool.query(
        'SELECT * FROM parametres WHERE id = $1',
        [id]
      );

      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Paramètre non trouvé',
          code: 'PARAMETRE_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        `UPDATE parametres 
         SET cle = COALESCE($1, cle), 
             valeur = COALESCE($2, valeur), 
             description = $3, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 
         RETURNING *`,
        [emptyToNull(cle), emptyToNull(valeur), emptyToNull(description), id]
      );
      
      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'parametre', parseInt(id), oldData, newData);
      }
      
      res.json(newData);
    } catch (err) {
      console.error('Erreur mise à jour paramètre:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour du paramètre',
        code: 'UPDATE_PARAMETRE_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/parametres/:id(\\d+) - Supprimer un paramètre par ID
  router.delete('/:id(\\d+)', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Récupérer les données
      const oldDataResult = await pool.query(
        'SELECT * FROM parametres WHERE id = $1',
        [id]
      );

      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Paramètre non trouvé',
          code: 'PARAMETRE_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        'DELETE FROM parametres WHERE id = $1 RETURNING *', 
        [id]
      );
      
      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'delete', 'parametre', parseInt(id), oldData, null);
      }

      res.json({ 
        message: 'Paramètre supprimé',
        code: 'PARAMETRE_DELETED',
        parametre: result.rows[0] 
      });
    } catch (err) {
      console.error('Erreur suppression paramètre:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la suppression du paramètre',
        code: 'DELETE_PARAMETRE_ERROR',
        details: err.message
      });
    }
  });

  // POST /api/parametres/reset - Réinitialiser aux valeurs par défaut
  router.post('/reset', requireWriteAccess, async (req, res) => {
    try {
      const defaults = {
        'colonnes_affichees_parcelles': '["nom", "surface_ha", "type_sol", "ph_sol", "date_creation"]',
        'colonnes_affichees_arbres': '["numero", "espece", "variete_truffe", "parcelle_nom", "etat_sanitaire", "date_plantation", "circonference_cm"]',
        'colonnes_affichees_interventions': '["date_prevue", "type_nom", "parcelle_nom", "arbre_numero", "statut", "personnel", "cout"]',
        'colonnes_affichees_recoltes': '["date_recolte", "parcelle_nom", "arbre_numero", "poids_grammes", "qualite", "calibre", "caveur"]',
        'colonnes_affichees_clients': '["nom", "type", "email", "telephone", "ville"]',
        'colonnes_affichees_ventes': '["date_vente", "client_nom", "quantite_grammes", "prix_unitaire_kg", "montant_total", "statut"]'
      };
      
      for (const [cle, valeur] of Object.entries(defaults)) {
        await pool.query(
          `INSERT INTO parametres (cle, valeur) 
           VALUES ($1, $2) 
           ON CONFLICT (cle) DO UPDATE SET valeur = $2, updated_at = CURRENT_TIMESTAMP`,
          [cle, valeur]
        );
      }
      
      // Audit trail (reset operation)
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'reset', 'parametres', null, null, { defaults_count: Object.keys(defaults).length });
      }

      res.json({ 
        message: 'Paramètres réinitialisés',
        code: 'PARAMETRES_RESET',
        count: Object.keys(defaults).length
      });
    } catch (err) {
      console.error('Erreur reset paramètres:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la réinitialisation des paramètres',
        code: 'RESET_PARAMETRES_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
