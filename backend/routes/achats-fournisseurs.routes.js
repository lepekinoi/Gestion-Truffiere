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

  // GET /api/fournisseurs/:id/statistiques - Statistiques d'un fournisseur
  router.get('/fournisseurs/:id/statistiques', async (req, res) => {
    const { id } = req.params;
    try {
      const stats = await pool.query(`
        SELECT 
          COUNT(DISTINCT c.id) as nombre_commandes,
          COALESCE(SUM(c.montant_total), 0) as montant_total_achats,
          COALESCE(AVG(c.montant_total), 0) as montant_moyen_commande,
          COALESCE(AVG(e.note_globale), 0) as note_moyenne,
          COUNT(DISTINCT e.id) as nombre_evaluations,
          MAX(c.date_commande) as derniere_commande
        FROM fournisseurs_truffes f
        LEFT JOIN commandes_achat_truffes c ON f.id = c.fournisseur_id
        LEFT JOIN evaluations_fournisseurs_truffes e ON f.id = e.fournisseur_id
        WHERE f.id = $1
        GROUP BY f.id
      `, [id]);

      if (stats.rows.length === 0) {
        return res.status(404).json({ error: 'Fournisseur introuvable' });
      }

      res.json(stats.rows[0]);
    } catch (error) {
      console.error('❌ Erreur récupération statistiques fournisseur:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
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
  // ROUTES ÉVALUATIONS FOURNISSEURS
  // ==========================================

  // POST /api/fournisseurs/:id/evaluations - Créer une évaluation
  router.post('/fournisseurs/:id/evaluations', requireWriteAccess, async (req, res) => {
    const { id } = req.params;
    const { note_qualite, note_delai, note_prix, note_service, commentaires } = req.body;

    try {
      const result = await pool.query(`
        INSERT INTO evaluations_fournisseurs_truffes (
          fournisseur_id, note_qualite, note_delai, note_prix, note_service, commentaires
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [id, note_qualite, note_delai, note_prix, note_service, commentaires]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('❌ Erreur création évaluation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/fournisseurs/:id/evaluations - Liste des évaluations
  router.get('/fournisseurs/:id/evaluations', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(`
        SELECT * FROM evaluations_fournisseurs_truffes
        WHERE fournisseur_id = $1
        ORDER BY date_evaluation DESC
      `, [id]);

      res.json(result.rows);
    } catch (error) {
      console.error('❌ Erreur récupération évaluations:', error);
      res.status(500).json({ error: 'Erreur serveur' });
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

  // PUT /api/commandes-achats/:id/statut - Modifier le statut d'une commande
  router.put('/commandes-achats/:id/statut', requireWriteAccess, async (req, res) => {
    const { id } = req.params;
    const { statut, date_livraison_reelle } = req.body;

    try {
      const result = await pool.query(`
        UPDATE commandes_achat_truffes
        SET statut = $1,
            date_livraison_reelle = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [statut, date_livraison_reelle, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Commande introuvable' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('❌ Erreur mise à jour statut:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/commandes-achats/:id/reception - Réceptionner une commande
  router.post('/commandes-achats/:id/reception', requireWriteAccess, async (req, res) => {
    const { id } = req.params;
    const { date_reception, lignes_recues, conservation, localisation_storage } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Enregistrer la réception
      const receptionResult = await client.query(`
        INSERT INTO reception_achats (
          commande_id, date_reception, statut_reception, notes
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [id, date_reception, 'Acceptée', 'Réception complète']);

      // Créer les entrées de stock pour chaque ligne reçue
      for (const ligneRecue of lignes_recues) {
        const ligne_id = ligneRecue.ligne_id || ligneRecue.ligneId;
        const quantite_recue = ligneRecue.quantite_recue || ligneRecue.quantiteRecue;
        const date_limite = ligneRecue.date_limite_consommation || ligneRecue.dateLimiteConsommation;

        // Récupérer les infos de la ligne de commande
        const ligneInfo = await client.query(`
          SELECT * FROM lignes_commande_achat WHERE id = $1
        `, [ligne_id]);

        if (ligneInfo.rows.length > 0) {
          const ligne = ligneInfo.rows[0];

          // Créer l'entrée de stock
          await client.query(`
            INSERT INTO stocks_truffes_achetees (
              ligne_commande_id, calibre_mm, qualite, maturite,
              quantite_kg_stock, conservation, localisation_storage,
              date_achat, date_limite_consommation, prix_achat_kg
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            ligne_id, ligne.calibre_mm, ligne.qualite, ligne.maturite,
            quantite_recue, conservation || 'Frais', localisation_storage,
            date_reception, date_limite, ligne.prix_achat_kg
          ]);
        }
      }

      // Mettre à jour le statut de la commande
      await client.query(`
        UPDATE commandes_achat_truffes
        SET statut = 'Réceptionnée',
            date_livraison_reelle = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [date_reception, id]);

      await client.query('COMMIT');

      res.json({
        message: 'Réception enregistrée avec succès',
        reception: receptionResult.rows[0],
        lignes_traitees: lignes_recues.length
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erreur réception commande:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // ==========================================
  // ROUTES FACTURES ACHATS
  // ==========================================

  // GET /api/factures-achats - Liste des factures
  router.get('/factures-achats', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          f.*,
          fou.nom as fournisseur_nom,
          c.numero_commande
        FROM factures_achat_truffes f
        JOIN fournisseurs_truffes fou ON f.fournisseur_id = fou.id
        JOIN commandes_achat_truffes c ON f.commande_id = c.id
        ORDER BY f.date_facture DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Erreur récupération factures:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST /api/factures-achats - Créer une facture
  router.post('/factures-achats', requireWriteAccess, async (req, res) => {
    const {
      commande_id, numero_facture, date_facture, date_echeance,
      montant_ht, taux_tva, notes
    } = req.body;

    try {
      // Récupérer le fournisseur de la commande
      const commandeInfo = await pool.query(`
        SELECT fournisseur_id, montant_total 
        FROM commandes_achat_truffes 
        WHERE id = $1
      `, [commande_id]);

      if (commandeInfo.rows.length === 0) {
        return res.status(404).json({ error: 'Commande introuvable' });
      }

      const fournisseur_id = commandeInfo.rows[0].fournisseur_id;
      const montant_tva = (montant_ht * (taux_tva || 20)) / 100;
      const montant_ttc = montant_ht + montant_tva;

      const result = await pool.query(`
        INSERT INTO factures_achat_truffes (
          commande_id, fournisseur_id, numero_facture, date_facture,
          date_echeance, montant_ht, taux_tva, montant_tva, montant_ttc,
          statut_paiement, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        commande_id, fournisseur_id, numero_facture, date_facture,
        date_echeance, montant_ht, taux_tva || 20, montant_tva, montant_ttc,
        'En attente', notes
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('❌ Erreur création facture:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/factures-achats/:id/paiement - Enregistrer un paiement
  router.put('/factures-achats/:id/paiement', requireWriteAccess, async (req, res) => {
    const { id } = req.params;
    const { date_paiement, mode_paiement, reference_paiement } = req.body;

    try {
      const result = await pool.query(`
        UPDATE factures_achat_truffes
        SET statut_paiement = 'Payée',
            date_paiement = $1,
            mode_paiement = $2,
            reference_paiement = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `, [date_paiement, mode_paiement, reference_paiement, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Facture introuvable' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('❌ Erreur enregistrement paiement:', error);
      res.status(500).json({ error: error.message });
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

  // GET /api/stock-disponible/alertes - Alertes stock bas et dates limites
  router.get('/stock-disponible/alertes', async (req, res) => {
    try {
      const stockBas = await pool.query(`
        SELECT 
          calibre_mm AS calibremm,
          qualite,
          maturite,
          SUM(quantite_kg_stock) as quantite_totale,
          'Stock bas' as type_alerte
        FROM stocks_truffes_achetees
        WHERE quantite_kg_stock > 0
        GROUP BY calibre_mm, qualite, maturite
        HAVING SUM(quantite_kg_stock) < 5
        ORDER BY SUM(quantite_kg_stock) ASC
      `);

      const datesLimites = await pool.query(`
        SELECT 
          id,
          calibre_mm,
          qualite,
          maturite,
          quantite_kg_stock,
          date_limite_consommation,
          CURRENT_DATE - date_limite_consommation as jours_restants,
          'Date limite proche' as type_alerte
        FROM stocks_truffes_achetees
        WHERE quantite_kg_stock > 0
          AND date_limite_consommation IS NOT NULL
          AND date_limite_consommation <= CURRENT_DATE + INTERVAL '7 days'
        ORDER BY date_limite_consommation ASC
      `);

      res.json({
        stock_bas: stockBas.rows,
        dates_limites: datesLimites.rows,
        total_alertes: stockBas.rows.length + datesLimites.rows.length
      });
    } catch (error) {
      console.error('❌ Erreur récupération alertes:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  // ==========================================
  // ROUTES HISTORIQUE PRIX
  // ==========================================

  // GET /api/historique-prix - Évolution des prix d'achat
  router.get('/historique-prix', async (req, res) => {
    const { calibre_mm, qualite, maturite, date_debut, date_fin } = req.query;

    try {
      let query = `
        SELECT 
          l.calibre_mm,
          l.qualite,
          l.maturite,
          l.prix_achat_kg,
          c.date_commande,
          f.nom as fournisseur_nom,
          c.numero_commande
        FROM lignes_commande_achat l
        JOIN commandes_achat_truffes c ON l.commande_id = c.id
        JOIN fournisseurs_truffes f ON c.fournisseur_id = f.id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (calibre_mm) {
        query += ` AND l.calibre_mm = $${paramIndex++}`;
        params.push(calibre_mm);
      }

      if (qualite) {
        query += ` AND l.qualite = $${paramIndex++}`;
        params.push(qualite);
      }

      if (maturite) {
        query += ` AND l.maturite = $${paramIndex++}`;
        params.push(maturite);
      }

      if (date_debut) {
        query += ` AND c.date_commande >= $${paramIndex++}`;
        params.push(date_debut);
      }

      if (date_fin) {
        query += ` AND c.date_commande <= $${paramIndex++}`;
        params.push(date_fin);
      }

      query += ` ORDER BY c.date_commande DESC`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Erreur récupération historique prix:', error);
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
