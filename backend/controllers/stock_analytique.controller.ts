// ============================================================================
// Backend - Contrôleur Stock et Analytique des Achats
// Gestion du stock acheté et analyse des marges
// ============================================================================

import { Request, Response } from 'express';
import pool from '../database';

export class StockAchatController {

  // GET /api/v1/stock-truffes-achetees
  async getStock(req: Request, res: Response) {
    try {
      const { calibre_mm, qualite, maturite, conservation } = req.query;

      let query = 'SELECT * FROM stocks_truffes_achetees WHERE quantite_kg_stock > 0';
      const params: any[] = [];
      let paramCount = 1;

      if (calibre_mm) {
        query += ` AND calibre_mm = $${paramCount}`;
        params.push(calibre_mm);
        paramCount++;
      }

      if (qualite) {
        query += ` AND qualite = $${paramCount}`;
        params.push(qualite);
        paramCount++;
      }

      if (maturite) {
        query += ` AND maturite = $${paramCount}`;
        params.push(maturite);
        paramCount++;
      }

      if (conservation) {
        query += ` AND conservation = $${paramCount}`;
        params.push(conservation);
        paramCount++;
      }

      query += ' ORDER BY calibre_mm DESC, qualite, maturite';
      const result = await pool.query(query, params);

      res.json({ data: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/v1/stock-disponible (Vue)
  async getStockDisponible(req: Request, res: Response) {
    try {
      const result = await pool.query('SELECT * FROM v_stock_truffes_disponible');
      res.json({ data: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/v1/stock-alerte-limite
  async getStockAlerte(req: Request, res: Response) {
    try {
      const result = await pool.query(`
        SELECT 
          id, calibre_mm, qualite, maturite, 
          quantite_kg_stock, date_limite_consommation,
          EXTRACT(DAY FROM date_limite_consommation - CURRENT_DATE) as jours_avant_limite
        FROM stocks_truffes_achetees
        WHERE quantite_kg_stock > 0
          AND date_limite_consommation IS NOT NULL
          AND date_limite_consommation <= CURRENT_DATE + INTERVAL '7 days'
        ORDER BY date_limite_consommation ASC
      `);

      res.json({ data: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/v1/stock-truffes-achetees/:id
  async updateStock(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { quantite_kg_stock, conservation, localisation_storage } = req.body;

      const result = await pool.query(`
        UPDATE stocks_truffes_achetees 
        SET 
          quantite_kg_stock = COALESCE($1, quantite_kg_stock),
          conservation = COALESCE($2, conservation),
          localisation_storage = COALESCE($3, localisation_storage),
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [quantite_kg_stock, conservation, localisation_storage, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Stock non trouvé' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export class AnalytiqueController {

  // GET /api/v1/analytics/marge-globale
  async getMargeGlobale(req: Request, res: Response) {
    try {
      const { date_from, date_to } = req.query;

      let query = `
        SELECT 
          COUNT(*) as nb_transactions,
          SUM(quantite_kg) as quantite_totale_kg,
          AVG(prix_achat_kg) as prix_achat_moyen,
          AVG(prix_vente_kg) as prix_vente_moyen,
          AVG(marge_kg) as marge_moyenne_kg,
          SUM(marge_kg * quantite_kg) as marge_totale_euros,
          AVG(pourcentage_marge) as pourcentage_marge_moyen
        FROM analyse_marge_truffes
        WHERE date_vente IS NOT NULL`;

      const params: any[] = [];

      if (date_from) {
        query += ` AND date_vente >= $1`;
        params.push(date_from);
      }

      if (date_to) {
        query += ` AND date_vente <= $${params.length + 1}`;
        params.push(date_to);
      }

      const result = await pool.query(query, params);
      res.json(result.rows[0] || {});
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/v1/analytics/marge-par-calibre
  async getMargeParCalibre(req: Request, res: Response) {
    try {
      const result = await pool.query(`
        SELECT * FROM v_analyse_marge_par_calibre
      `);

      res.json({ data: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/v1/analytics/fournisseurs-rentabilite
  async getFournisseurRentabilite(req: Request, res: Response) {
    try {
      const result = await pool.query(`
        SELECT 
          f.id,
          f.nom,
          f.zone_production,
          COUNT(DISTINCT am.id) as nb_transactions,
          AVG(am.marge_kg) as marge_moyenne_kg,
          AVG(am.pourcentage_marge) as pourcentage_marge_moyen,
          SUM(am.marge_kg * am.quantite_kg) as marge_totale_euros
        FROM fournisseurs_truffes f
        LEFT JOIN commandes_achat_truffes c ON f.id = c.fournisseur_id
        LEFT JOIN lignes_commande_achat l ON c.id = l.commande_id
        LEFT JOIN stocks_truffes_achetees s ON l.id = s.ligne_commande_id
        LEFT JOIN analyse_marge_truffes am ON s.id = am.stock_achat_id
        WHERE f.deleted_at IS NULL AND am.date_vente IS NOT NULL
        GROUP BY f.id, f.nom, f.zone_production
        ORDER BY marge_totale_euros DESC NULLS LAST
      `);

      res.json({ data: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/v1/analytics/commandes-en-retard
  async getCommandesEnRetard(req: Request, res: Response) {
    try {
      const result = await pool.query(`
        SELECT 
          c.id,
          c.numero_commande,
          f.nom as fournisseur,
          c.date_livraison_prevue,
          CURRENT_DATE - c.date_livraison_prevue as jours_retard,
          c.statut
        FROM commandes_achat_truffes c
        JOIN fournisseurs_truffes f ON c.fournisseur_id = f.id
        WHERE c.statut NOT IN ('Réceptionnée', 'Annulée')
          AND c.date_livraison_prevue < CURRENT_DATE
        ORDER BY jours_retard DESC
      `);

      res.json({ data: result.rows });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/v1/analytics/stats-dashboard
  async getStatsDashboard(req: Request, res: Response) {
    try {
      // Commandes en attente
      const commandes = await pool.query(`
        SELECT COUNT(*) as total FROM commandes_achat_truffes 
        WHERE statut = 'En attente'
      `);

      // Stock total
      const stock = await pool.query(`
        SELECT SUM(quantite_kg_stock) as total_kg FROM stocks_truffes_achetees 
        WHERE quantite_kg_stock > 0
      `);

      // Marge mois en cours
      const marge = await pool.query(`
        SELECT 
          SUM(marge_kg * quantite_kg) as marge_euros,
          AVG(pourcentage_marge) as pourcentage_moyen
        FROM analyse_marge_truffes
        WHERE date_vente >= DATE_TRUNC('month', CURRENT_DATE)
          AND date_vente IS NOT NULL
      `);

      // Fournisseurs actifs
      const fournisseurs = await pool.query(`
        SELECT COUNT(*) as total FROM fournisseurs_truffes 
        WHERE statut = 'Actif' AND deleted_at IS NULL
      `);

      res.json({
        commandes_en_attente: parseInt(commandes.rows[0].total),
        stock_total_kg: parseFloat(stock.rows[0].total_kg) || 0,
        marge_mois_euros: parseFloat(marge.rows[0].marge_euros) || 0,
        pourcentage_marge: parseFloat(marge.rows[0].pourcentage_moyen) || 0,
        fournisseurs_actifs: parseInt(fournisseurs.rows[0].total)
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const stockController = new StockAchatController();
export const analytiqueController = new AnalytiqueController();