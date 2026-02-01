const express = require('express');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // ==========================================
  // ROUTES FOURNISSEURS
  // ==========================================

  // GET /api/fournisseurs - Liste des fournisseurs
  router.get('/fournisseurs', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          id, nom, raison_sociale, email, telephone, adresse,
          code_postal, ville, pays, zone_production, certifications,
          statut, contact_principal, telephone_contact,
          delai_livraison_jours, conditions_paiement, notes,
          created_at, updated_at
        FROM fournisseurs_truffes 
        WHERE deleted_at IS NULL 
        ORDER BY nom ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Erreur récupération fournisseurs:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // GET /api/fournisseurs/:id - Détails d'un fournisseur
  router.get('/fournisseurs/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(`
        SELECT * FROM fournisseurs_truffes 
        WHERE id = $1 AND deleted_at IS NULL
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fournisseur introuvable' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('❌ Erreur récupération fournisseur:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/fournisseurs - Créer un fournisseur
  router.post('/fournisseurs', requireWriteAccess, async (req, res) => {
    const {
      nom, raison_sociale, email, telephone, adresse,
      code_postal, ville, pays, zone_production, certifications,
      statut, contact_principal, telephone_contact,
      delai_livraison_jours, conditions_paiement, notes
    } = req.body;

    try {
      const result = await pool.query(`
        INSERT INTO fournisseurs_truffes (
          nom, raison_sociale, email, telephone, adresse,
          code_postal, ville, pays, zone_production, certifications,
          statut, contact_principal, telephone_contact,
          delai_livraison_jours, conditions_paiement, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        nom, raison_sociale, email, telephone, adresse,
        code_postal, ville, pays || 'France', zone_production, certifications,
        statut || 'Actif', contact_principal, telephone_contact,
        delai_livraison_jours, conditions_paiement, notes
      ]);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('❌ Erreur création fournisseur:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/fournisseurs/:id - Modifier un fournisseur
  router.put('/fournisseurs/:id', requireWriteAccess, async (req, res) => {
    const { id } = req.params;
    const {
      nom, raison_sociale, email, telephone, adresse,
      code_postal, ville, pays, zone_production, certifications,
      statut, contact_principal, telephone_contact,
      delai_livraison_jours, conditions_paiement, notes
    } = req.body;

    try {
      const result = await pool.query(`
        UPDATE fournisseurs_truffes 
        SET nom = $1, raison_sociale = $2, email = $3, telephone = $4,
            adresse = $5, code_postal = $6, ville = $7, pays = $8,
            zone_production = $9, certifications = $10, statut = $11,
            contact_principal = $12, telephone_contact = $13,
            delai_livraison_jours = $14, conditions_paiement = $15,
            notes = $16, updated_at = CURRENT_TIMESTAMP
        WHERE id = $17 AND deleted_at IS NULL
        RETURNING *
      `, [
        nom, raison_sociale, email, telephone, adresse,
        code_postal, ville, pays, zone_production, certifications,
        statut, contact_principal, telephone_contact,
        delai_livraison_jours, conditions_paiement, notes, id
      ]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fournisseur introuvable' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('❌ Erreur modification fournisseur:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/fournisseurs/:id - Supprimer (soft delete)
  router.delete('/fournisseurs/:id', requireWriteAccess, async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(`
        UPDATE fournisseurs_truffes 
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fournisseur introuvable' });
      }
      res.json({ message: 'Fournisseur supprimé avec succès' });
    } catch (error) {
      console.error('❌ Erreur suppression fournisseur:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // ROUTES COMMANDES ACHATS
  // ==========================================

  // GET /api/commandes-achats - Liste des commandes d'achat
  router.get('/commandes-achats', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          c.*,
          f.nom as fournisseur_nom,
          COUNT(l.id) as nombre_lignes,
          COALESCE(SUM(l.quantite_kg), 0) as quantite_totale_kg
        FROM commandes_achat_truffes c
        LEFT JOIN fournisseurs_truffes f ON c.fournisseur_id = f.id
        LEFT JOIN lignes_commande_achat l ON c.id = l.commande_id
        GROUP BY c.id, f.nom
        ORDER BY c.date_commande DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Erreur récupération commandes achats:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // GET /api/commandes-achats/:id - Détails d'une commande
  router.get('/commandes-achats/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const commandeResult = await pool.query(`
        SELECT c.*, f.nom as fournisseur_nom, f.email as fournisseur_email
        FROM commandes_achat_truffes c
        JOIN fournisseurs_truffes f ON c.fournisseur_id = f.id
        WHERE c.id = $1
      `, [id]);

      if (commandeResult.rows.length === 0) {
        return res.status(404).json({ error: 'Commande introuvable' });
      }

      const lignesResult = await pool.query(`
        SELECT * FROM lignes_commande_achat
        WHERE commande_id = $1
        ORDER BY id ASC
      `, [id]);

      res.json({
        commande: commandeResult.rows[0],
        lignes: lignesResult.rows
      });
    } catch (error) {
      console.error('❌ Erreur récupération détails commande:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/commandes-achats - Créer une commande
  router.post('/commandes-achats', requireWriteAccess, async (req, res) => {
    console.log('📦 Données reçues:', JSON.stringify(req.body, null, 2));

    // Extraire les données avec support de plusieurs formats
    let fournisseur_id = req.body.fournisseur_id || req.body.fournisseurId;
    let date_commande = req.body.date_commande || req.body.dateCommande;
    let date_livraison_prevue = req.body.date_livraison_prevue || req.body.dateLivraisonPrevue;
    let lignes = req.body.lignes || req.body.items || [];
    let notes = req.body.notes;

    // Validation
    if (!fournisseur_id) {
      return res.status(400).json({ error: 'Fournisseur manquant' });
    }

    if (!date_commande) {
      return res.status(400).json({ error: 'Date de commande manquante' });
    }

    if (!Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ 
        error: 'Aucune ligne de commande fournie',
        received: { lignes, items: req.body.items }
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Calculer le montant total avec gestion des noms de propriétés
      const montantTotal = lignes.reduce((sum, l) => {
        const quantite = parseFloat(l.quantite_kg || l.quantiteKg || 0);
        const prix = parseFloat(l.prix_achat_kg || l.prixAchatKg || 0);
        return sum + (quantite * prix);
      }, 0);

      // Générer un numéro de commande unique
      const numeroCommande = `ACH-${Date.now()}`;

      // Créer la commande
      const commandeResult = await client.query(`
        INSERT INTO commandes_achat_truffes (
          fournisseur_id, numero_commande, date_commande, 
          date_livraison_prevue, montant_total, statut, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        fournisseur_id, numeroCommande, date_commande,
        date_livraison_prevue, montantTotal, 'En attente', notes
      ]);

      const commandeId = commandeResult.rows[0].id;
      console.log(`✅ Commande créée: ${commandeId}`);

      // Créer les lignes de commande
      for (const ligne of lignes) {
        const calibre_mm = ligne.calibre_mm || ligne.calibreMm;
        const qualite = ligne.qualite;
        const maturite = ligne.maturite;
        const quantite_kg = ligne.quantite_kg || ligne.quantiteKg;
        const prix_achat_kg = ligne.prix_achat_kg || ligne.prixAchatKg;
        const notes_ligne = ligne.notes || null;

        await client.query(`
          INSERT INTO lignes_commande_achat (
            commande_id, calibre_mm, qualite, maturite, quantite_kg, prix_achat_kg, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          commandeId, calibre_mm, qualite, 
          maturite, quantite_kg, prix_achat_kg, notes_ligne
        ]);
      }

      await client.query('COMMIT');
      console.log(`✅ ${lignes.length} ligne(s) ajoutée(s)`);

      res.status(201).json({
        commande: commandeResult.rows[0],
        message: `Commande créée avec succès. ${lignes.length} ligne(s) ajoutée(s).`,
        numeroCommande
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erreur création commande:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // ==========================================
  // ROUTES STOCK
  // ==========================================

  // GET /api/stock-disponible - Stock disponible
  router.get('/stock-disponible', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM vstocktruffesdisponible
        ORDER BY calibremm DESC, qualite, maturite
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Erreur récupération stock:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // GET /api/stock-disponible/details - Détails complets du stock
  router.get('/stock-disponible/details', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          s.*,
          c.numero_commande,
          c.date_commande,
          f.nom as fournisseur_nom
        FROM stocks_truffes_achetees s
        LEFT JOIN lignes_commande_achat l ON s.ligne_commande_id = l.id
        LEFT JOIN commandes_achat_truffes c ON l.commande_id = c.id
        LEFT JOIN fournisseurs_truffes f ON c.fournisseur_id = f.id
        WHERE s.quantite_kg_stock > 0
          AND (s.date_limite_consommation IS NULL OR s.date_limite_consommation > CURRENT_DATE)
        ORDER BY s.date_achat DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Erreur récupération détails stock:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // ==========================================
  // ROUTES MARGES
  // ==========================================

  // GET /api/marge-globale - Analyse des marges globales
  router.get('/marge-globale', async (req, res) => {
    try {
      // Utiliser la vue existante pour les marges par calibre
      const margeCalibre = await pool.query(`
        SELECT * FROM vanalysemargeparcalibre
        ORDER BY calibremm DESC
      `);

      // Calculer les totaux globaux
      const margeGlobale = await pool.query(`
        SELECT 
          COUNT(*) as nombre_transactions,
          SUM(quantite_kg) as quantite_totale_kg,
          AVG(prix_achat_kg) as prix_achat_moyen,
          AVG(prix_vente_kg) as prix_vente_moyen,
          AVG(marge_kg) as marge_moyenne_kg,
          AVG(pourcentage_marge) as pourcentage_marge_moyen,
          SUM(quantite_kg * marge_kg) as marge_totale
        FROM analyse_marge_truffes
        WHERE date_vente IS NOT NULL
      `);

      res.json({
        global: margeGlobale.rows[0],
        parCalibre: margeCalibre.rows
      });
    } catch (error) {
      console.error('❌ Erreur récupération marges:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // GET /api/marge-globale/details - Détails des marges par transaction
  router.get('/marge-globale/details', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM analyse_marge_truffes
        WHERE date_vente IS NOT NULL
        ORDER BY date_achat DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Erreur récupération détails marges:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  return router;
};
