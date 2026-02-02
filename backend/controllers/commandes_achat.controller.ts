// ============================================================================
// Backend - Contrôleur Commandes d'Achat de Truffes
// Gestion des commandes et lignes d'achat
// ============================================================================

import { Request, Response } from 'express';
import pool from '../database';

export class CommandeAchatController {

  // GET /api/v1/commandes-achat
  async getAllCommandes(req: Request, res: Response) {
    try {
      const { page = 1, perPage = 20, fournisseur_id, statut, date_from, date_to } = req.query;
      const offset = (Number(page) - 1) * Number(perPage);

      let query = `
        SELECT 
          c.id,
          c.numero_commande,
          f.nom as fournisseur_nom,
          c.date_commande,
          c.date_livraison_prevue,
          c.date_livraison_reelle,
          c.montant_total,
          c.statut,
          COUNT(l.id) as nb_lignes
        FROM commandes_achat_truffes c
        JOIN fournisseurs_truffes f ON c.fournisseur_id = f.id
        LEFT JOIN lignes_commande_achat l ON c.id = l.commande_id
        WHERE 1=1`;

      const params: any[] = [];
      let paramCount = 1;

      if (fournisseur_id) {
        query += ` AND c.fournisseur_id = $${paramCount}`;
        params.push(fournisseur_id);
        paramCount++;
      }

      if (statut) {
        query += ` AND c.statut = $${paramCount}`;
        params.push(statut);
        paramCount++;
      }

      if (date_from) {
        query += ` AND c.date_commande >= $${paramCount}`;
        params.push(date_from);
        paramCount++;
      }

      if (date_to) {
        query += ` AND c.date_commande <= $${paramCount}`;
        params.push(date_to);
        paramCount++;
      }

      // Count
      const countQuery = query.replace(/SELECT[\s\S]*FROM/, 'SELECT COUNT(*) as total FROM');
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get results
      query += ` GROUP BY c.id, f.nom ORDER BY c.date_commande DESC LIMIT ${Number(perPage)} OFFSET ${offset}`;
      const result = await pool.query(query, params);

      res.json({
        data: result.rows,
        pagination: {
          page: Number(page),
          perPage: Number(perPage),
          total,
          totalPages: Math.ceil(total / Number(perPage))
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/v1/commandes-achat
  async createCommande(req: Request, res: Response) {
    try {
      const {
        fournisseur_id,
        numero_commande,
        date_livraison_prevue,
        notes,
        lignes
      } = req.body;

      if (!fournisseur_id || !numero_commande) {
        return res.status(400).json({ error: 'Fournisseur et numéro de commande requis' });
      }

      // Start transaction
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Create commande
        const commandeResult = await client.query(`
          INSERT INTO commandes_achat_truffes 
          (fournisseur_id, numero_commande, date_livraison_prevue, notes, statut)
          VALUES ($1, $2, $3, $4, 'En attente')
          RETURNING *
        `, [fournisseur_id, numero_commande, date_livraison_prevue, notes]);

        const commande = commandeResult.rows[0];
        const commande_id = commande.id;

        // Add lignes
        let montant_total = 0;
        for (const ligne of lignes || []) {
          const montant = ligne.quantite_kg * ligne.prix_achat_kg;
          montant_total += montant;

          await client.query(`
            INSERT INTO lignes_commande_achat 
            (commande_id, calibre_mm, qualite, maturite, quantite_kg, prix_achat_kg, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            commande_id,
            ligne.calibre_mm,
            ligne.qualite,
            ligne.maturite,
            ligne.quantite_kg,
            ligne.prix_achat_kg,
            ligne.notes
          ]);
        }

        // Update montant total
        await client.query(
          'UPDATE commandes_achat_truffes SET montant_total = $1 WHERE id = $2',
          [montant_total, commande_id]
        );

        await client.query('COMMIT');

        // Get complete commande
        const result = await pool.query(`
          SELECT c.*, f.nom as fournisseur_nom
          FROM commandes_achat_truffes c
          JOIN fournisseurs_truffes f ON c.fournisseur_id = f.id
          WHERE c.id = $1
        `, [commande_id]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(400).json({ error: 'Ce numéro de commande existe déjà' });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }

  // GET /api/v1/commandes-achat/:id
  async getCommande(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT 
          c.*,
          f.nom as fournisseur_nom,
          f.email as fournisseur_email,
          f.telephone as fournisseur_telephone,
          json_agg(
            json_build_object(
              'id', l.id,
              'calibre_mm', l.calibre_mm,
              'qualite', l.qualite,
              'maturite', l.maturite,
              'quantite_kg', l.quantite_kg,
              'prix_achat_kg', l.prix_achat_kg,
              'montant_ligne', l.montant_ligne
            )
          ) as lignes
        FROM commandes_achat_truffes c
        JOIN fournisseurs_truffes f ON c.fournisseur_id = f.id
        LEFT JOIN lignes_commande_achat l ON c.id = l.commande_id
        WHERE c.id = $1
        GROUP BY c.id, f.id
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/v1/commandes-achat/:id/confirmer
  async confirmerCommande(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        UPDATE commandes_achat_truffes 
        SET statut = 'Confirmée', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Commande non trouvée' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/v1/commandes-achat/:id/receptionner
  async receptionnerCommande(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { date_livraison, lignes } = req.body;

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Update commande
        await client.query(`
          UPDATE commandes_achat_truffes 
          SET statut = 'Réceptionnée', date_livraison_reelle = $1, updated_at = NOW()
          WHERE id = $2
        `, [date_livraison, id]);

        // Add reception & create stock
        for (const ligne of lignes || []) {
          // Add reception
          await client.query(`
            INSERT INTO reception_achats 
            (commande_id, date_reception, quantite_reçue_kg, controle_qualite, observations)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            id,
            date_livraison,
            ligne.quantite_recue,
            ligne.statut || 'Acceptée',
            ligne.observations
          ]);

          // Create stock
          await client.query(`
            INSERT INTO stocks_truffes_achetees 
            (ligne_commande_id, calibre_mm, qualite, maturite, quantite_kg_stock, 
             conservation, localisation_storage, date_achat, prix_achat_kg)
            SELECT 
              l.id, l.calibre_mm, l.qualite, l.maturite, $2,
              $3, $4, $5, l.prix_achat_kg
            FROM lignes_commande_achat l
            WHERE l.id = $1
          `, [
            ligne.ligne_id,
            ligne.quantite_recue,
            ligne.conservation || 'Frais',
            ligne.localisation || 'Chambre A',
            date_livraison
          ]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Réception enregistrée' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new CommandeAchatController();