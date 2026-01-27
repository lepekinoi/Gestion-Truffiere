// backend/routes/clients.routes.js
const express = require('express');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/clients - Liste des clients
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT * FROM clients ORDER BY nom, raison_sociale'
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
    }
  });

  // GET /api/clients/:id/stats - Statistiques d'un client
  router.get('/:id/stats', async (req, res) => {
    try {
      const { id } = req.params;
      
      const commandesResult = await pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(montant_total), 0) as total 
         FROM commandes 
         WHERE client_id = $1`,
        [id]
      );
      
      const ventesResult = await pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(montant_total), 0) as total 
         FROM ventes 
         WHERE client_id = $1`,
        [id]
      );
      
      res.json({
        commandes: { 
          count: parseInt(commandesResult.rows[0].count), 
          total: parseFloat(commandesResult.rows[0].total) 
        },
        ventes: { 
          count: parseInt(ventesResult.rows[0].count), 
          total: parseFloat(ventesResult.rows[0].total) 
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
    }
  });

  // GET /api/clients/stats/by-type - Statistiques par type de client
  router.get('/stats/by-type', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT c.type, COUNT(DISTINCT c.id) as nb_clients,
               COALESCE(SUM(cmd.montant_total), 0) as total_commandes,
               COALESCE(SUM(v.montant_total), 0) as total_ventes
        FROM clients c
        LEFT JOIN commandes cmd ON c.id = cmd.client_id
        LEFT JOIN ventes v ON c.id = v.client_id
        GROUP BY c.type
      `);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
    }
  });

  // POST /api/clients - Créer un client
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { 
        type, nom, prenom, raison_sociale, email, telephone, 
        adresse, code_postal, ville, pays, siret, notes 
      } = req.body;
      
      const result = await pool.query(
        `INSERT INTO clients (
          type, nom, prenom, raison_sociale, email, telephone, 
          adresse, code_postal, ville, pays, siret, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
        RETURNING *`,
        [
          type || 'Particulier', 
          nom, 
          prenom, 
          raison_sociale, 
          email, 
          telephone, 
          adresse, 
          code_postal, 
          ville, 
          pays || 'France', 
          siret, 
          notes
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la création' });
    }
  });

  // PUT /api/clients/:id - Modifier un client
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        type, nom, prenom, raison_sociale, email, telephone, 
        adresse, code_postal, ville, pays, siret, notes 
      } = req.body;
      
      const result = await pool.query(
        `UPDATE clients SET 
          type = $1, nom = $2, prenom = $3, raison_sociale = $4, email = $5,
          telephone = $6, adresse = $7, code_postal = $8, ville = $9, 
          pays = $10, siret = $11, notes = $12
        WHERE id = $13 
        RETURNING *`,
        [
          type, nom, prenom, raison_sociale, email, telephone, 
          adresse, code_postal, ville, pays, siret, notes, id
        ]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
  });

  // DELETE /api/clients/:id - Supprimer un client
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'DELETE FROM clients WHERE id = $1 RETURNING *', 
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }
      res.json({ message: 'Client supprimé' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
    }
  });

  return router;
};
