const express = require('express');

// Export d'une fonction qui reçoit le pool en paramètre (comme les autres routes)
module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // ===== GESTION FOURNISSEURS =====

  // GET - Liste des fournisseurs
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM fournisseurstruffes 
        WHERE deletedat IS NULL 
        ORDER BY nom ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Erreur récupération fournisseurs:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // GET - Détails d'un fournisseur
  router.get('/:id', async (req, res) => {
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
      console.error('Erreur récupération fournisseur:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // POST - Créer un fournisseur
  router.post('/', requireWriteAccess, async (req, res) => {
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
      console.error('Erreur création fournisseur:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT - Modifier un fournisseur
  router.put('/:id', requireWriteAccess, async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    
    const updateFields = Object.keys(fields)
      .map((key, idx) => `${key} = $${idx + 1}`)
      .join(', ');
    const values = [...Object.values(fields), id];

    try {
      const result = await pool.query(`
        UPDATE fournisseurstruffes 
        SET ${updateFields}, updatedat = CURRENT_TIMESTAMP
        WHERE id = $${values.length} AND deletedat IS NULL
        RETURNING *
      `, values);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fournisseur introuvable' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Erreur modification fournisseur:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE - Supprimer (soft delete) un fournisseur
  router.delete('/:id', requireWriteAccess, async (req, res) => {
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
      console.error('Erreur suppression fournisseur:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== ACHATS DE TRUFFES =====

  // POST - Créer un achat (commande + stock + récolte virtuelle)
  router.post('/:id/achats', requireWriteAccess, async (req, res) => {
    const { id: fournisseurId } = req.params;
    const {
      dateachat,
      lignes, // Array: [{ calibremm, qualite, maturite, quantitekg, prixachatkg }]
      notes
    } = req.body;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Vérifier que le fournisseur existe
      const fournisseurCheck = await client.query(
        'SELECT nom FROM fournisseurstruffes WHERE id = $1 AND deletedat IS NULL',
        [fournisseurId]
      );
      
      if (fournisseurCheck.rows.length === 0) {
        throw new Error('Fournisseur introuvable');
      }
      
      const fournisseurNom = fournisseurCheck.rows[0].nom;

      // 2. Créer la commande d'achat
      const numeroCommande = `ACH-${Date.now()}`;
      const montantTotal = lignes.reduce((sum, l) => 
        sum + (parseFloat(l.quantitekg) * parseFloat(l.prixachatkg)), 0
      );

      const commandeResult = await client.query(`
        INSERT INTO commandesachattruffes (
          fournisseurid, numerocommande, datecommande, 
          datelivraisonreelle, montanttotal, statut, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        fournisseurId, numeroCommande, dateachat,
        dateachat, montantTotal, 'Réceptionné', notes
      ]);

      const commandeId = commandeResult.rows[0].id;

      // 3. Créer les lignes de commande + stock + récolte virtuelle
      for (const ligne of lignes) {
        // Ligne de commande
        const ligneResult = await client.query(`
          INSERT INTO lignescommandeachat (
            commandeid, calibremm, qualite, maturite, quantitekg, prixachatkg
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [
          commandeId, ligne.calibremm, ligne.qualite, 
          ligne.maturite, ligne.quantitekg, ligne.prixachatkg
        ]);

        const ligneId = ligneResult.rows[0].id;

        // Stock
        await client.query(`
          INSERT INTO stockstruffesachetees (
            lignecommandeid, calibremm, qualite, maturite,
            quantitekgstock, dateachat, prixachatkg,
            conservation, localisationstorage
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          ligneId, ligne.calibremm, ligne.qualite, ligne.maturite,
          ligne.quantitekg, dateachat, ligne.prixachatkg,
          'Frais', 'Stock Fournisseur'
        ]);

        // Récolte virtuelle pour traçabilité
        await client.query(`
          INSERT INTO recoltes (
            parcelleid, arbreid, daterecolte, poidsgrammes,
            qualite, calibre, maturite, caveur, notes
          ) VALUES (
            NULL, NULL, $1, $2, $3, $4, $5, $6, $7
          )
        `, [
          dateachat,
          parseFloat(ligne.quantitekg) * 1000, // conversion kg -> grammes
          ligne.qualite,
          `${ligne.calibremm}mm`,
          ligne.maturite,
          `Fournisseur: ${fournisseurNom}`,
          `Achat ${numeroCommande} - Stock ajouté via fournisseur`
        ]);
      }

      await client.query('COMMIT');

      res.status(201).json({
        commande: commandeResult.rows[0],
        message: `Achat créé avec succès. ${lignes.length} ligne(s) ajoutée(s) au stock.`,
        numeroCommande
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erreur création achat:', error);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });

  // GET - Historique des achats d'un fournisseur
  router.get('/:id/achats', async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(`
        SELECT 
          c.*,
          COUNT(l.id) as nombre_lignes,
          SUM(l.quantitekg) as quantite_totale_kg
        FROM commandesachattruffes c
        LEFT JOIN lignescommandeachat l ON c.id = l.commandeid
        WHERE c.fournisseurid = $1
        GROUP BY c.id
        ORDER BY c.datecommande DESC
      `, [id]);

      res.json(result.rows);
    } catch (error) {
      console.error('Erreur récupération achats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET - Détails d'une commande d'achat avec lignes
  router.get('/achats/:commandeId', async (req, res) => {
    const { commandeId } = req.params;

    try {
      const commandeResult = await pool.query(`
        SELECT c.*, f.nom as fournisseur_nom
        FROM commandesachattruffes c
        JOIN fournisseurstruffes f ON c.fournisseurid = f.id
        WHERE c.id = $1
      `, [commandeId]);

      if (commandeResult.rows.length === 0) {
        return res.status(404).json({ error: 'Commande introuvable' });
      }

      const lignesResult = await pool.query(`
        SELECT * FROM lignescommandeachat
        WHERE commandeid = $1
        ORDER BY id ASC
      `, [commandeId]);

      res.json({
        commande: commandeResult.rows[0],
        lignes: lignesResult.rows
      });
    } catch (error) {
      console.error('Erreur récupération détails achat:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};