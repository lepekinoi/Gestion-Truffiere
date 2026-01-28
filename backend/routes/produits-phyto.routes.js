// backend/routes/produits-phyto.routes.js
const express = require('express');
const { emptyToNull, logAuditTrail } = require('../utils');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/produits-phyto - Liste des produits phytosanitaires
  router.get('/', async (req, res) => {
    try {
      const { categorie, bio_only } = req.query;
      let query = 'SELECT * FROM produits_phyto WHERE actif = true';
      const params = [];
      
      if (categorie) {
        params.push(categorie);
        query += ` AND categorie = $${params.length}`;
      }
      
      if (bio_only === 'true') {
        query += ' AND utilisable_bio = true';
      }
      
      query += ' ORDER BY nom_commercial';
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération produits phyto:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des produits phytosanitaires',
        code: 'LIST_PRODUITS_PHYTO_ERROR'
      });
    }
  });

  // POST /api/produits-phyto - Ajouter un produit phytosanitaire
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { 
        nom_commercial, matiere_active, numero_amm, categorie, 
        fabricant, dose_recommandee_ha, dar_jours, znt_metres, 
        utilisable_bio, phrase_risque, conseils_utilisation 
      } = req.body;
      
      const result = await pool.query(
        `INSERT INTO produits_phyto 
         (nom_commercial, matiere_active, numero_amm, categorie, fabricant, 
          dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio, 
          phrase_risque, conseils_utilisation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING *`,
        [
          nom_commercial, 
          matiere_active, 
          emptyToNull(numero_amm), 
          categorie, 
          emptyToNull(fabricant),
          emptyToNull(dose_recommandee_ha), 
          emptyToNull(dar_jours), 
          emptyToNull(znt_metres), 
          utilisable_bio || false, 
          emptyToNull(phrase_risque), 
          emptyToNull(conseils_utilisation)
        ]
      );

      const newProduit = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create', 'produit_phyto', newProduit.id, null, newProduit);
      }

      res.status(201).json(newProduit);
    } catch (err) {
      console.error('Erreur création produit phyto:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la création du produit phytosanitaire',
        code: 'CREATE_PRODUIT_PHYTO_ERROR',
        details: err.message
      });
    }
  });

  // PUT /api/produits-phyto/:id - Modifier un produit phytosanitaire
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        nom_commercial, matiere_active, numero_amm, categorie, 
        fabricant, dose_recommandee_ha, dar_jours, znt_metres, 
        utilisable_bio, phrase_risque, conseils_utilisation, actif
      } = req.body;
      
      // Récupérer anciennes valeurs
      const oldDataResult = await pool.query(
        'SELECT * FROM produits_phyto WHERE id = $1',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Produit phytosanitaire non trouvé',
          code: 'PRODUIT_PHYTO_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        `UPDATE produits_phyto SET 
         nom_commercial = $1, matiere_active = $2, numero_amm = $3, categorie = $4,
         fabricant = $5, dose_recommandee_ha = $6, dar_jours = $7, znt_metres = $8,
         utilisable_bio = $9, phrase_risque = $10, conseils_utilisation = $11, actif = $12
         WHERE id = $13 
         RETURNING *`,
        [
          nom_commercial, 
          matiere_active, 
          emptyToNull(numero_amm), 
          categorie, 
          emptyToNull(fabricant),
          emptyToNull(dose_recommandee_ha), 
          emptyToNull(dar_jours), 
          emptyToNull(znt_metres), 
          utilisable_bio, 
          emptyToNull(phrase_risque), 
          emptyToNull(conseils_utilisation), 
          actif !== false, 
          id
        ]
      );
      
      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'produit_phyto', parseInt(id), oldData, newData);
      }

      res.json(newData);
    } catch (err) {
      console.error('Erreur modification produit phyto:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la modification du produit phytosanitaire',
        code: 'UPDATE_PRODUIT_PHYTO_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/produits-phyto/:id - Désactiver un produit (soft delete)
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Récupérer les données
      const oldDataResult = await pool.query(
        'SELECT * FROM produits_phyto WHERE id = $1',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Produit phytosanitaire non trouvé',
          code: 'PRODUIT_PHYTO_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      await pool.query(
        'UPDATE produits_phyto SET actif = false WHERE id = $1', 
        [id]
      );

      // Audit trail (soft delete)
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'soft_delete', 'produit_phyto', parseInt(id), oldData, { ...oldData, actif: false });
      }

      res.json({ 
        message: 'Produit phytosanitaire désactivé',
        code: 'PRODUIT_PHYTO_DEACTIVATED'
      });
    } catch (err) {
      console.error('Erreur désactivation produit phyto:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la désactivation du produit phytosanitaire',
        code: 'DEACTIVATE_PRODUIT_PHYTO_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
