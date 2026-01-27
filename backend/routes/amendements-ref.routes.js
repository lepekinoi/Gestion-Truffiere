// backend/routes/amendements-ref.routes.js
const express = require('express');

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
      res.status(500).json({ error: 'Erreur lors de la récupération' });
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
          nom, type_amendement, composition, dose_recommandee_ha, 
          utilisable_bio || false, effet_principal, precautions
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Erreur création amendement:', err);
      res.status(500).json({ error: 'Erreur lors de la création' });
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
      
      const result = await pool.query(
        `UPDATE amendements_ref SET 
         nom = $1, type_amendement = $2, composition = $3, 
         dose_recommandee_ha = $4, utilisable_bio = $5, 
         effet_principal = $6, precautions = $7, actif = $8
         WHERE id = $9 
         RETURNING *`,
        [
          nom, type_amendement, composition, dose_recommandee_ha, 
          utilisable_bio, effet_principal, precautions, actif !== false, id
        ]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Amendement non trouvé' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erreur modification amendement:', err);
      res.status(500).json({ error: 'Erreur lors de la modification' });
    }
  });

  // DELETE /api/amendements-ref/:id - Désactiver un amendement (soft delete)
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query(
        'UPDATE amendements_ref SET actif = false WHERE id = $1', 
        [id]
      );
      res.json({ message: 'Amendement désactivé' });
    } catch (err) {
      console.error('Erreur désactivation amendement:', err);
      res.status(500).json({ error: 'Erreur lors de la désactivation' });
    }
  });

  return router;
};
