// backend/routes/parametres.routes.js
const express = require('express');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/parametres - Liste tous les paramètres
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM parametres ORDER BY cle');
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
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
        return res.status(404).json({ error: 'Paramètre non trouvé' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
    }
  });

  // POST /api/parametres - Créer un paramètre
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { cle, valeur, description } = req.body;
      
      if (!cle || !cle.trim()) {
        return res.status(400).json({ error: 'La clé est obligatoire' });
      }
      
      // Vérifier si le paramètre existe déjà
      const existing = await pool.query(
        'SELECT id FROM parametres WHERE cle = $1', 
        [cle.trim()]
      );
      
      if (existing.rows.length > 0) {
        // Mettre à jour si existe
        const result = await pool.query(
          `UPDATE parametres 
           SET valeur = $1, description = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE cle = $3 
           RETURNING *`,
          [valeur, description, cle.trim()]
        );
        return res.json(result.rows[0]);
      }
      
      // Créer nouveau
      const result = await pool.query(
        'INSERT INTO parametres (cle, valeur, description) VALUES ($1, $2, $3) RETURNING *',
        [cle.trim(), valeur, description]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Erreur création paramètre:', err);
      res.status(500).json({ error: 'Erreur lors de la création du paramètre' });
    }
  });

  // PUT /api/parametres/:cle - Mettre à jour un paramètre par clé
  router.put('/:cle', requireWriteAccess, async (req, res) => {
    try {
      const { cle } = req.params;
      const { valeur } = req.body;
      
      const result = await pool.query(
        'UPDATE parametres SET valeur = $1 WHERE cle = $2 RETURNING *',
        [valeur, cle]
      );
      
      if (result.rows.length === 0) {
        const insertResult = await pool.query(
          'INSERT INTO parametres (cle, valeur) VALUES ($1, $2) RETURNING *',
          [cle, valeur]
        );
        return res.json(insertResult.rows[0]);
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
  });

  // PUT /api/parametres/:id(\\d+) - Mettre à jour un paramètre par ID
  router.put('/:id(\\d+)', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { cle, valeur, description } = req.body;
      
      const result = await pool.query(
        `UPDATE parametres 
         SET cle = COALESCE($1, cle), 
             valeur = COALESCE($2, valeur), 
             description = $3, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 
         RETURNING *`,
        [cle, valeur, description, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Paramètre non trouvé' });
      }
      
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erreur mise à jour paramètre:', err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
  });

  // DELETE /api/parametres/:id(\\d+) - Supprimer un paramètre par ID
  router.delete('/:id(\\d+)', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        'DELETE FROM parametres WHERE id = $1 RETURNING *', 
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Paramètre non trouvé' });
      }
      
      res.json({ message: 'Paramètre supprimé', parametre: result.rows[0] });
    } catch (err) {
      console.error('Erreur suppression paramètre:', err);
      res.status(500).json({ error: 'Erreur lors de la suppression' });
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
           ON CONFLICT (cle) DO UPDATE SET valeur = $2`,
          [cle, valeur]
        );
      }
      
      res.json({ message: 'Paramètres réinitialisés' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
    }
  });

  return router;
};
