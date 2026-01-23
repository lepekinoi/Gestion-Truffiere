// ====================================================================
// routes/commerces.routes.js - Routes pour clients, ventes et commandes
// ====================================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware  } = require('../middleware/auth');

// ==================== ROUTES CLIENTS ====================

// GET /api/clients - Liste des clients
router.get('/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY nom, raison_sociale');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/clients/:id/stats - Statistiques d'un client
router.get('/clients/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const commandesResult = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(montant_total), 0) as total FROM commandes WHERE client_id = $1',
      [id]
    );

    const ventesResult = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(montant_total), 0) as total FROM ventes WHERE client_id = $1',
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

// GET /api/clients/stats/by-type - Stats par type de client
router.get('/clients/stats/by-type', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.type,
        COUNT(DISTINCT c.id) as nb_clients,
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
router.post('/clients', authMiddleware, async (req, res) => {
  try {
    const {
      type, nom, prenom, raison_sociale, email, telephone,
      adresse, code_postal, ville, pays, siret, notes
    } = req.body;

    const result = await pool.query(
      `INSERT INTO clients 
       (type, nom, prenom, raison_sociale, email, telephone, adresse, 
        code_postal, ville, pays, siret, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        type || 'Particulier', nom, prenom, raison_sociale, email, telephone,
        adresse, code_postal, ville, pays || 'France', siret, notes
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/clients/:id - Modifier un client
router.put('/clients/:id', authMiddleware, async (req, res) => {
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
      [type, nom, prenom, raison_sociale, email, telephone, adresse,
       code_postal, ville, pays, siret, notes, id]
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
router.delete('/clients/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }
    res.json({ message: 'Client supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES VENTES ====================

// GET /api/ventes - Liste des ventes
router.get('/ventes', async (req, res) => {
  try {
    const { client_id, recolte_id } = req.query;

    let query = `
      SELECT v.*,
        c.type as client_type, c.nom as client_nom, c.prenom as client_prenom, c.raison_sociale,
        r.date_recolte, r.poids_grammes as recolte_poids,
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
router.post('/ventes', authMiddleware, async (req, res) => {
  try {
    const {
      client_id, recolte_id, commande_id, date_vente, quantite_grammes,
      prix_unitaire_kg, mode_paiement, statut, numero_facture, notes
    } = req.body;

    const montant_total = quantite_grammes && prix_unitaire_kg
      ? (parseFloat(quantite_grammes) / 1000) * parseFloat(prix_unitaire_kg)
      : 0;

    const result = await pool.query(
      `INSERT INTO ventes 
       (client_id, recolte_id, commande_id, date_vente, quantite_grammes,
        prix_unitaire_kg, montant_total, mode_paiement, statut, numero_facture, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [client_id, recolte_id || null, commande_id || null, date_vente,
       quantite_grammes, prix_unitaire_kg || null, montant_total,
       mode_paiement, statut || 'En attente', numero_facture, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/ventes/:id - Modifier une vente
router.put('/ventes/:id', authMiddleware, async (req, res) => {
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
      [client_id, recolte_id || null, commande_id || null, date_vente,
       quantite_grammes, prix_unitaire_kg || null, montant_total,
       mode_paiement, statut, numero_facture, notes, id]
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
router.delete('/ventes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM ventes WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }
    res.json({ message: 'Vente supprimée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES COMMANDES ====================

// GET /api/commandes - Liste des commandes
router.get('/commandes', async (req, res) => {
  try {
    const { client_id } = req.query;

    let query = `
      SELECT c.*,
        cl.type as client_type, cl.nom as client_nom,
        cl.prenom as client_prenom, cl.raison_sociale
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
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/commandes/:id - Détail d'une commande
router.get('/commandes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*,
        cl.type as client_type, cl.nom as client_nom, cl.prenom as client_prenom,
        cl.raison_sociale, cl.email, cl.telephone, cl.adresse,
        cl.code_postal, cl.ville
      FROM commandes c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});


// POST /api/commandes - Créer une commande
    const result = await pool.query(
      `INSERT INTO commandes 
       (client_id, numero_commande, date_commande, date_livraison_demandee,
        poids_grammes, calibre, qualite, maturite, prix_unitaire_kg,
        montant_total, statut, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [client_id || null, numero_commande, date_commande,
       date_livraison_demandee || null, poidsGrammesVal,
       calibre || null, qualite || null, maturite || null,
       prixUnitaireKgVal, montant_total, statut || 'En attente', notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/commandes/:id - Modifier une commande
router.put('/commandes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      client_id, date_commande, date_livraison_demandee, poids_grammes,
      calibre, qualite, maturite, prix_unitaire_kg, statut, notes
    } = req.body;

    const poidsGrammesVal = poids_grammes === '' || poids_grammes === null || poids_grammes === undefined ? null : poids_grammes;
    const prixUnitaireKgVal = prix_unitaire_kg === '' || prix_unitaire_kg === null || prix_unitaire_kg === undefined ? null : prix_unitaire_kg;

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
      [client_id || null, date_commande, date_livraison_demandee || null,
       poidsGrammesVal, calibre || null, qualite || null, maturite || null,
       prixUnitaireKgVal, montant_total, statut, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// DELETE /api/commandes/:id - Supprimer une commande
router.delete('/commandes/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM commandes WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }
    res.json({ message: 'Commande supprimée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// POST /api/commandes/:id/creer-vente - Créer une vente depuis une commande
router.post('/commandes/:id/creer-vente', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const commandeResult = await pool.query('SELECT * FROM commandes WHERE id = $1', [id]);
    if (commandeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const commande = commandeResult.rows[0];

    // Vérifier si vente existe déjà
    const venteExistante = await pool.query('SELECT id FROM ventes WHERE commande_id = $1', [id]);
    if (venteExistante.rows.length > 0) {
      return res.status(400).json({ error: 'Une vente existe déjà pour cette commande' });
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
      `INSERT INTO ventes 
       (client_id, commande_id, date_vente, quantite_grammes, prix_unitaire_kg,
        montant_total, mode_paiement, statut, numero_facture, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [commande.client_id, commande.id, new Date().toISOString().split('T')[0],
       commande.poids_grammes, commande.prix_unitaire_kg, commande.montant_total,
       '', 'En attente', numero_facture, `Vente créée depuis commande ${commande.numero_commande}`]
    );

    res.status(201).json(venteResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de la vente' });
  }
});

module.exports = router;
