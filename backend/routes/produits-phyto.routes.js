// backend/routes/produits-phyto.routes.js
const express = require('express');

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
      res.status(500).json({ error: 'Erreur lors de la récupération' });
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
          nom_commercial, matiere_active, numero_amm, categorie, fabricant,
          dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio || false, 
          phrase_risque, conseils_utilisation
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Erreur création produit phyto:', err);
      res.status(500).json({ error: 'Erreur lors de la création' });
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
      
      const result = await pool.query(
        `UPDATE produits_phyto SET 
         nom_commercial = $1, matiere_active = $2, numero_amm = $3, categorie = $4,
         fabricant = $5, dose_recommandee_ha = $6, dar_jours = $7, znt_metres = $8,
         utilisable_bio = $9, phrase_risque = $10, conseils_utilisation = $11, actif = $12
         WHERE id = $13 
         RETURNING *`,
        [
          nom_commercial, matiere_active, numero_amm, categorie, fabricant,
          dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio, phrase_risque, 
          conseils_utilisation, actif !== false, id
        ]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Produit non trouvé' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erreur modification produit phyto:', err);
      res.status(500).json({ error: 'Erreur lors de la modification' });
    }
  });

  // DELETE /api/produits-phyto/:id - Désactiver un produit (soft delete)
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query(
        'UPDATE produits_phyto SET actif = false WHERE id = $1', 
        [id]
      );
      res.json({ message: 'Produit désactivé' });
    } catch (err) {
      console.error('Erreur désactivation produit phyto:', err);
      res.status(500).json({ error: 'Erreur lors de la désactivation' });
    }
  });

  return router;
};
