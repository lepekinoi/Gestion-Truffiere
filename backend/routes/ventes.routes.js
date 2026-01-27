// backend/routes/ventes.routes.js
const express = require('express');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/ventes - Liste des ventes avec filtres
  router.get('/', async (req, res) => {
    try {
      const { client_id, recolte_id } = req.query;
      
      let query = `
        SELECT v.*, 
               c.type as client_type, 
               c.nom as client_nom, 
               c.prenom as client_prenom, 
               c.raison_sociale,
               r.date_recolte, 
               r.poids_grammes as recolte_poids, 
               a.numero as arbre_numero
        FROM ventes v
        LEFT JOIN clients c ON v.client_id = c.id
        LEFT JOIN recoltes r ON v.recolte_id = r.id
        LEFT JOIN arbres a ON r.arbre_id = a.id
      `;
      
      const conditions = [];
      const params = [];
      let idx = 1;
      
      if (client_id) { 
        conditions.push(`v.client_id = $${idx++}`); 
        params.push(client_id); 
      }
      if (recolte_id) { 
        conditions.push(`v.recolte_id = $${idx++}`); 
        params.push(recolte_id); 
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY v.date_vente DESC';
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
    }
  });

  // POST /api/ventes - Créer une vente
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { 
        client_id, recolte_id, commande_id, date_vente, quantite_grammes, 
        prix_unitaire_kg, mode_paiement, statut, numero_facture, notes 
      } = req.body;
      
      const montant_total = quantite_grammes && prix_unitaire_kg 
        ? (parseFloat(quantite_grammes) / 1000) * parseFloat(prix_unitaire_kg) 
        : 0;
      
      const result = await pool.query(
        `INSERT INTO ventes (
          client_id, recolte_id, commande_id, date_vente, quantite_grammes, 
          prix_unitaire_kg, montant_total, mode_paiement, statut, 
          numero_facture, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING *`,
        [
          client_id, 
          recolte_id || null, 
          commande_id || null, 
          date_vente, 
          quantite_grammes, 
          prix_unitaire_kg || null, 
          montant_total, 
          mode_paiement, 
          statut || 'En attente', 
          numero_facture, 
          notes
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la création' });
    }
  });

  // PUT /api/ventes/:id - Modifier une vente
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        client_id, recolte_id, commande_id, date_vente, quantite_grammes, 
        prix_unitaire_kg, mode_paiement, statut, numero_facture, notes 
      } = req.body;
      
      const montant_total = quantite_grammes && prix_unitaire_kg 
        ? (parseFloat(quantite_grammes) / 1000) * parseFloat(prix_unitaire_kg) 
        : 0;
      
      const result = await pool.query(
        `UPDATE ventes SET 
          client_id = $1, recolte_id = $2, commande_id = $3, date_vente = $4, 
          quantite_grammes = $5, prix_unitaire_kg = $6, montant_total = $7, 
          mode_paiement = $8, statut = $9, numero_facture = $10, notes = $11
        WHERE id = $12 
        RETURNING *`,
        [
          client_id, 
          recolte_id || null, 
          commande_id || null, 
          date_vente, 
          quantite_grammes, 
          prix_unitaire_kg || null, 
          montant_total, 
          mode_paiement, 
          statut, 
          numero_facture, 
          notes, 
          id
        ]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Vente non trouvée' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
  });

  // DELETE /api/ventes/:id - Supprimer une vente
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'DELETE FROM ventes WHERE id = $1 RETURNING *', 
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Vente non trouvée' });
      }
      res.json({ message: 'Vente supprimée' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
    }
  });

  return router;
};
