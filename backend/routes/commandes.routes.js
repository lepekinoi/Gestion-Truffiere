// backend/routes/commandes.routes.js
const express = require('express');
const { emptyToNull, logAuditTrail } = require('../utils');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/commandes - Liste des commandes
  router.get('/', async (req, res) => {
    try {
      const { client_id } = req.query;
      
      let query = `
        SELECT c.*, 
               cl.type as client_type, 
               cl.nom as client_nom, 
               cl.prenom as client_prenom, 
               cl.raison_sociale
        FROM commandes c
        LEFT JOIN clients cl ON c.client_id = cl.id
      `;
      
      if (client_id) {
        query += ' WHERE c.client_id = $1 ORDER BY c.date_commande DESC';
        const result = await pool.query(query, [client_id]);
        return res.json(result.rows);
      }
      
      query += ' ORDER BY c.date_commande DESC';
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération commandes:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des commandes',
        code: 'LIST_COMMANDES_ERROR'
      });
    }
  });

  // GET /api/commandes/:id - Détails d'une commande
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(`
        SELECT c.*, 
               cl.type as client_type, 
               cl.nom as client_nom, 
               cl.prenom as client_prenom, 
               cl.raison_sociale, 
               cl.email, 
               cl.telephone, 
               cl.adresse, 
               cl.code_postal, 
               cl.ville
        FROM commandes c
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE c.id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Commande non trouvée',
          code: 'COMMANDE_NOT_FOUND'
        });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erreur récupération commande:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération de la commande',
        code: 'GET_COMMANDE_ERROR'
      });
    }
  });

  // POST /api/commandes - Créer une commande
  router.post('/', requireWriteAccess, async (req, res) => {
    try {
      const { 
        client_id, date_commande, date_livraison_demandee, poids_grammes, 
        calibre, qualite, maturite, prix_unitaire_kg, statut, notes 
      } = req.body;
      
      // Générer numéro de commande
      const year = new Date().getFullYear();
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM commandes WHERE EXTRACT(YEAR FROM date_commande) = $1', 
        [year]
      );
      const count = parseInt(countResult.rows[0].count) + 1;
      const numero_commande = `CMD-${year}-${String(count).padStart(4, '0')}`;
      
      const poidsGrammesVal = emptyToNull(poids_grammes);
      const prixUnitaireKgVal = emptyToNull(prix_unitaire_kg);
      
      const montant_total = poidsGrammesVal && prixUnitaireKgVal 
        ? (parseFloat(poidsGrammesVal) / 1000) * parseFloat(prixUnitaireKgVal) 
        : null;
      
      const result = await pool.query(
        `INSERT INTO commandes (
          client_id, numero_commande, date_commande, date_livraison_demandee, 
          poids_grammes, calibre, qualite, maturite, prix_unitaire_kg, 
          montant_total, statut, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
        RETURNING *`,
        [
          emptyToNull(client_id), 
          numero_commande, 
          date_commande, 
          emptyToNull(date_livraison_demandee), 
          poidsGrammesVal, 
          emptyToNull(calibre), 
          emptyToNull(qualite), 
          emptyToNull(maturite), 
          prixUnitaireKgVal, 
          montant_total, 
          statut || 'En attente', 
          emptyToNull(notes)
        ]
      );

      const newCommande = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create', 'commande', newCommande.id, null, newCommande);
      }

      res.status(201).json(newCommande);
    } catch (err) {
      console.error('Erreur création commande:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la création de la commande',
        code: 'CREATE_COMMANDE_ERROR',
        details: err.message
      });
    }
  });

  // PUT /api/commandes/:id - Modifier une commande
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        client_id, date_commande, date_livraison_demandee, poids_grammes, 
        calibre, qualite, maturite, prix_unitaire_kg, statut, notes 
      } = req.body;
      
      // Récupérer anciennes valeurs pour audit trail
      const oldDataResult = await pool.query(
        'SELECT * FROM commandes WHERE id = $1',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Commande non trouvée',
          code: 'COMMANDE_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const poidsGrammesVal = emptyToNull(poids_grammes);
      const prixUnitaireKgVal = emptyToNull(prix_unitaire_kg);
      
      const montant_total = poidsGrammesVal && prixUnitaireKgVal 
        ? (parseFloat(poidsGrammesVal) / 1000) * parseFloat(prixUnitaireKgVal) 
        : null;
      
      const result = await pool.query(
        `UPDATE commandes SET 
          client_id = $1, date_commande = $2, date_livraison_demandee = $3, 
          poids_grammes = $4, calibre = $5, qualite = $6, maturite = $7, 
          prix_unitaire_kg = $8, montant_total = $9, statut = $10, notes = $11 
        WHERE id = $12 
        RETURNING *`,
        [
          emptyToNull(client_id), 
          date_commande, 
          emptyToNull(date_livraison_demandee), 
          poidsGrammesVal, 
          emptyToNull(calibre), 
          emptyToNull(qualite), 
          emptyToNull(maturite), 
          prixUnitaireKgVal, 
          montant_total, 
          statut, 
          emptyToNull(notes), 
          id
        ]
      );
      
      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'commande', parseInt(id), oldData, newData);
      }

      res.json(newData);
    } catch (err) {
      console.error('Erreur mise à jour commande:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour de la commande',
        code: 'UPDATE_COMMANDE_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/commandes/:id - Supprimer une commande
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Récupérer les données pour audit trail
      const oldDataResult = await pool.query(
        'SELECT * FROM commandes WHERE id = $1',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Commande non trouvée',
          code: 'COMMANDE_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        'DELETE FROM commandes WHERE id = $1 RETURNING *', 
        [id]
      );
      
      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'delete', 'commande', parseInt(id), oldData, null);
      }
      
      res.json({ 
        message: 'Commande supprimée',
        code: 'COMMANDE_DELETED'
      });
    } catch (err) {
      console.error('Erreur suppression commande:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la suppression de la commande',
        code: 'DELETE_COMMANDE_ERROR',
        details: err.message
      });
    }
  });

  // POST /api/commandes/:id/creer-vente - Créer une vente depuis une commande
  router.post('/:id/creer-vente', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      const commandeResult = await pool.query(
        'SELECT * FROM commandes WHERE id = $1', 
        [id]
      );
      
      if (commandeResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Commande non trouvée',
          code: 'COMMANDE_NOT_FOUND'
        });
      }
      
      const commande = commandeResult.rows[0];
      
      const venteExistante = await pool.query(
        'SELECT id FROM ventes WHERE commande_id = $1', 
        [id]
      );
      
      if (venteExistante.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Une vente existe déjà pour cette commande',
          code: 'VENTE_ALREADY_EXISTS'
        });
      }
      
      // Générer numéro de facture
      const year = new Date().getFullYear();
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM ventes WHERE numero_facture LIKE $1', 
        [`FACT-${year}%`]
      );
      const count = parseInt(countResult.rows[0].count) + 1;
      const numero_facture = `FACT-${year}-${String(count).padStart(3, '0')}`;
      
      const venteResult = await pool.query(
        `INSERT INTO ventes (
          client_id, commande_id, date_vente, quantite_grammes, 
          prix_unitaire_kg, montant_total, mode_paiement, statut, 
          numero_facture, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *`,
        [
          commande.client_id, 
          commande.id, 
          new Date().toISOString().split('T')[0], 
          commande.poids_grammes, 
          commande.prix_unitaire_kg, 
          commande.montant_total, 
          '', 
          'En attente', 
          numero_facture, 
          `Vente créée depuis commande ${commande.numero_commande}`
        ]
      );
      
      const newVente = venteResult.rows[0];

      // Audit trail pour la vente créée
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create_from_commande', 'vente', newVente.id, null, newVente);
      }

      res.status(201).json(newVente);
    } catch (err) {
      console.error('Erreur création vente depuis commande:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la création de la vente',
        code: 'CREATE_VENTE_FROM_COMMANDE_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
