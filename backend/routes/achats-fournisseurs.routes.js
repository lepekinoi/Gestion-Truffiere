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
          id, nom, raisonsociale, email, telephone, adresse,
          codepostal, ville, pays, zoneproduction, certifications,
          statut, contactprincipal, telephonecontact,
          delailivraisonjours, conditionspaiement, notes,
          createdat, updatedat
        FROM fournisseurstruffes 
        WHERE deletedat IS NULL 
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
        SELECT * FROM fournisseurstruffes 
        WHERE id = $1 AND deletedat IS NULL
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
      nom, raisonsociale, email, telephone, adresse,
      codepostal, ville, pays, zoneproduction, certifications,
      statut, contactprincipal, telephonecontact,
      delailivraisonjours, conditionspaiement, notes
    } = req.body;

    try {
      const result = await pool.query(`
        INSERT INTO fournisseurstruffes (
          nom, raisonsociale, email, telephone, adresse,
          codepostal, ville, pays, zoneproduction, certifications,
          statut, contactprincipal, telephonecontact,
          delailivraisonjours, conditionspaiement, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        nom, raisonsociale, email, telephone, adresse,
        codepostal, ville, pays || 'France', zoneproduction, certifications,
        statut || 'Actif', contactprincipal, telephonecontact,
        delailivraisonjours, conditionspaiement, notes
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
      nom, raisonsociale, email, telephone, adresse,
      codepostal, ville, pays, zoneproduction, certifications,
      statut, contactprincipal, telephonecontact,
      delailivraisonjours, conditionspaiement, notes
    } = req.body;

    try {
      const result = await pool.query(`
        UPDATE fournisseurstruffes 
        SET nom = $1, raisonsociale = $2, email = $3, telephone = $4,
            adresse = $5, codepostal = $6, ville = $7, pays = $8,
            zoneproduction = $9, certifications = $10, statut = $11,
            contactprincipal = $12, telephonecontact = $13,
            delailivraisonjours = $14, conditionspaiement = $15,
            notes = $16, updatedat = CURRENT_TIMESTAMP
        WHERE id = $17 AND deletedat IS NULL
        RETURNING *
      `, [
        nom, raisonsociale, email, telephone, adresse,
        codepostal, ville, pays, zoneproduction, certifications,
        statut, contactprincipal, telephonecontact,
        delailivraisonjours, conditionspaiement, notes, id
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
        UPDATE fournisseurstruffes 
        SET deletedat = CURRENT_TIMESTAMP
        WHERE id = $1 AND deletedat IS NULL
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
          COALESCE(SUM(l.quantitekg), 0) as quantite_totale_kg
        FROM commandesachattruffes c
        LEFT JOIN fournisseurstruffes f ON c.fournisseurid = f.id
        LEFT JOIN lignescommandeachat l ON c.id = l.commandeid
        GROUP BY c.id, f.nom
        ORDER BY c.datecommande DESC
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
        FROM commandesachattruffes c
        JOIN fournisseurstruffes f ON c.fournisseurid = f.id
        WHERE c.id = $1
      `, [id]);

      if (commandeResult.rows.length === 0) {
        return res.status(404).json({ error: 'Commande introuvable' });
      }

      const lignesResult = await pool.query(`
        SELECT * FROM lignescommandeachat
        WHERE commandeid = $1
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
    const {
      fournisseurid,
      datecommande,
      datelivraisonprevue,
      lignes,
      notes
    } = req.body;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Calculer le montant total
      const montantTotal = lignes.reduce((sum, l) => 
        sum + (parseFloat(l.quantitekg) * parseFloat(l.prixachatkg)), 0
      );

      // Générer un numéro de commande unique
      const numeroCommande = `ACH-${Date.now()}`;

      // Créer la commande
      const commandeResult = await client.query(`
        INSERT INTO commandesachattruffes (
          fournisseurid, numerocommande, datecommande, 
          datelivraisonprevue, montanttotal, statut, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        fournisseurid, numeroCommande, datecommande,
        datelivraisonprevue, montantTotal, 'En attente', notes
      ]);

      const commandeId = commandeResult.rows[0].id;

      // Créer les lignes de commande
      for (const ligne of lignes) {
        await client.query(`
          INSERT INTO lignescommandeachat (
            commandeid, calibremm, qualite, maturite, quantitekg, prixachatkg, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          commandeId, ligne.calibremm, ligne.qualite, 
          ligne.maturite, ligne.quantitekg, ligne.prixachatkg, ligne.notes || null
        ]);
      }

      await client.query('COMMIT');

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
          c.numerocommande,
          c.datecommande,
          f.nom as fournisseur_nom
        FROM stockstruffesachetees s
        LEFT JOIN lignescommandeachat l ON s.lignecommandeid = l.id
        LEFT JOIN commandesachattruffes c ON l.commandeid = c.id
        LEFT JOIN fournisseurstruffes f ON c.fournisseurid = f.id
        WHERE s.quantitekgstock > 0
          AND (s.datelimiteconsommation IS NULL OR s.datelimiteconsommation > CURRENT_DATE)
        ORDER BY s.dateachat DESC
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
          SUM(quantitekg) as quantite_totale_kg,
          AVG(prixachatkg) as prix_achat_moyen,
          AVG(prixventekg) as prix_vente_moyen,
          AVG(margekg) as marge_moyenne_kg,
          AVG(pourcentagemarge) as pourcentage_marge_moyen,
          SUM(quantitekg * margekg) as marge_totale
        FROM analysemargetruffes
        WHERE datevente IS NOT NULL
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
        SELECT * FROM analysemargetruffes
        WHERE datevente IS NOT NULL
        ORDER BY dateachat DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('❌ Erreur récupération détails marges:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
  });

  return router;
};
