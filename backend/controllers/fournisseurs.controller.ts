// ============================================================================
// Backend - Contrôleur Fournisseurs de Truffes
// Gestion complète des fournisseurs trufficulteurs
// ============================================================================

import { Request, Response } from 'express';
import pool from '../database';

export class FournisseurTruffesController {
  
  // GET /api/v1/fournisseurs-truffes
  async getAllFournisseurs(req: Request, res: Response) {
    try {
      const { page = 1, perPage = 20, zone_production, statut, search } = req.query;
      const offset = (Number(page) - 1) * Number(perPage);

      let query = 'SELECT * FROM fournisseurs_truffes WHERE deleted_at IS NULL';
      const params: any[] = [];
      let paramCount = 1;

      if (zone_production) {
        query += ` AND zone_production = $${paramCount}`;
        params.push(zone_production);
        paramCount++;
      }

      if (statut) {
        query += ` AND statut = $${paramCount}`;
        params.push(statut);
        paramCount++;
      }

      if (search) {
        query += ` AND nom ILIKE $${paramCount}`;
        params.push(`%${search}%`);
        paramCount++;
      }

      // Count total
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM fournisseurs_truffes WHERE deleted_at IS NULL ${
          zone_production ? `AND zone_production = $1` : ''
        }`,
        zone_production ? [zone_production] : []
      );
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      query += ` ORDER BY nom ASC LIMIT ${Number(perPage)} OFFSET ${offset}`;
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

  // POST /api/v1/fournisseurs-truffes
  async createFournisseur(req: Request, res: Response) {
    try {
      const {
        nom,
        raison_sociale,
        email,
        telephone,
        adresse,
        code_postal,
        ville,
        pays = 'France',
        zone_production,
        certifications,
        statut = 'Actif',
        contact_principal,
        telephone_contact,
        delai_livraison_jours,
        conditions_paiement,
        notes
      } = req.body;

      // Validation
      if (!nom) {
        return res.status(400).json({ error: 'Nom requis' });
      }

      const query = `
        INSERT INTO fournisseurs_truffes 
        (nom, raison_sociale, email, telephone, adresse, code_postal, 
         ville, pays, zone_production, certifications, statut, 
         contact_principal, telephone_contact, delai_livraison_jours, 
         conditions_paiement, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`;

      const values = [
        nom, raison_sociale, email, telephone, adresse, code_postal,
        ville, pays, zone_production, certifications, statut,
        contact_principal, telephone_contact, delai_livraison_jours,
        conditions_paiement, notes
      ];

      const result = await pool.query(query, values);
      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(400).json({ error: 'Ce fournisseur existe déjà' });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }

  // GET /api/v1/fournisseurs-truffes/:id
  async getFournisseur(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Get fournisseur
      const fournisseur = await pool.query(
        'SELECT * FROM fournisseurs_truffes WHERE id = $1 AND deleted_at IS NULL',
        [id]
      );

      if (fournisseur.rows.length === 0) {
        return res.status(404).json({ error: 'Fournisseur non trouvé' });
      }

      // Get contacts
      const contacts = await pool.query(
        'SELECT * FROM contacts_fournisseurs_truffes WHERE fournisseur_id = $1 ORDER BY est_principal DESC',
        [id]
      );

      // Get statistiques
      const stats = await pool.query(`
        SELECT 
          COUNT(DISTINCT c.id) as nb_commandes,
          SUM(c.montant_total) as montant_total,
          AVG(e.note_globale) as note_moyenne
        FROM commandes_achat_truffes c
        LEFT JOIN evaluations_fournisseurs_truffes e ON c.fournisseur_id = e.fournisseur_id
        WHERE c.fournisseur_id = $1 AND c.statut != 'Annulée'
      `, [id]);

      res.json({
        ...fournisseur.rows[0],
        contacts: contacts.rows,
        statistiques: stats.rows[0]
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/v1/fournisseurs-truffes/:id
  async updateFournisseur(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      Object.entries(data).forEach(([key, value]) => {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      });

      fields.push(`updated_at = $${paramCount}`);
      values.push(new Date());
      values.push(id);

      const query = `
        UPDATE fournisseurs_truffes 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount + 1} AND deleted_at IS NULL
        RETURNING *`;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fournisseur non trouvé' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/v1/fournisseurs-truffes/:id (soft delete)
  async deleteFournisseur(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'UPDATE fournisseurs_truffes SET deleted_at = NOW() WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fournisseur non trouvé' });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/v1/fournisseurs-truffes/:id/contacts
  async getContacts(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'SELECT * FROM contacts_fournisseurs_truffes WHERE fournisseur_id = $1 ORDER BY est_principal DESC, nom ASC',
        [id]
      );

      res.json({ data: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/v1/fournisseurs-truffes/:id/contacts
  async addContact(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { nom, titre_poste, email, telephone, est_principal = false, notes } = req.body;

      if (!nom) {
        return res.status(400).json({ error: 'Nom du contact requis' });
      }

      const query = `
        INSERT INTO contacts_fournisseurs_truffes 
        (fournisseur_id, nom, titre_poste, email, telephone, est_principal, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`;

      const result = await pool.query(query, [
        id, nom, titre_poste, email, telephone, est_principal, notes
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/v1/analytics/fournisseurs-performance
  async getPerformance(req: Request, res: Response) {
    try {
      const result = await pool.query(`
        SELECT * FROM v_performance_fournisseurs_truffes
        ORDER BY note_globale_moyenne DESC NULLS LAST
      `);

      res.json({ data: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new FournisseurTruffesController();