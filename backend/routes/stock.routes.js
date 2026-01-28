// backend/routes/stock.routes.js
const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/stock - Calcul du stock automatique (Récoltes - Ventes payées)
  router.get('/', async (req, res) => {
    try {
      // Total récolté
      const totalRecolte = await pool.query(`
        SELECT COALESCE(SUM(poids_grammes), 0) as total_grammes
        FROM recoltes
      `);

      // Total vendu (uniquement ventes payées)
      const totalVendu = await pool.query(`
        SELECT COALESCE(SUM(quantite_grammes), 0) as total_grammes
        FROM ventes
        WHERE statut = 'Payée'
      `);

      // Détail par qualité et calibre
      const detailsStock = await pool.query(`
        WITH recoltes_agg AS (
          SELECT 
            COALESCE(qualite, 'Non spécifié') as qualite,
            COALESCE(calibre, 'Non spécifié') as calibre,
            SUM(poids_grammes) as total_recolte
          FROM recoltes
          GROUP BY COALESCE(qualite, 'Non spécifié'), COALESCE(calibre, 'Non spécifié')
        ),
        ventes_agg AS (
          SELECT 
            COALESCE(r.qualite, 'Non spécifié') as qualite,
            COALESCE(r.calibre, 'Non spécifié') as calibre,
            SUM(v.quantite_grammes) as total_vendu
          FROM ventes v
          LEFT JOIN recoltes r ON v.recolte_id = r.id
          WHERE v.statut = 'Payée'
          GROUP BY COALESCE(r.qualite, 'Non spécifié'), COALESCE(r.calibre, 'Non spécifié')
        )
        SELECT 
          COALESCE(ra.qualite, va.qualite) as qualite,
          COALESCE(ra.calibre, va.calibre) as calibre,
          COALESCE(ra.total_recolte, 0) as recolte_grammes,
          COALESCE(va.total_vendu, 0) as vendu_grammes,
          COALESCE(ra.total_recolte, 0) - COALESCE(va.total_vendu, 0) as disponible_grammes
        FROM recoltes_agg ra
        FULL OUTER JOIN ventes_agg va ON ra.qualite = va.qualite AND ra.calibre = va.calibre
        ORDER BY qualite, calibre
      `);

      // Stock par saison (année de récolte)
      const stockParSaison = await pool.query(`
        WITH recoltes_saison AS (
          SELECT 
            CASE 
              WHEN EXTRACT(MONTH FROM date_recolte) >= 11 THEN 
                EXTRACT(YEAR FROM date_recolte)::text || '-' || (EXTRACT(YEAR FROM date_recolte) + 1)::text
              ELSE 
                (EXTRACT(YEAR FROM date_recolte) - 1)::text || '-' || EXTRACT(YEAR FROM date_recolte)::text
            END as saison,
            SUM(poids_grammes) as total_recolte
          FROM recoltes
          GROUP BY saison
        ),
        ventes_saison AS (
          SELECT 
            CASE 
              WHEN EXTRACT(MONTH FROM r.date_recolte) >= 11 THEN 
                EXTRACT(YEAR FROM r.date_recolte)::text || '-' || (EXTRACT(YEAR FROM r.date_recolte) + 1)::text
              ELSE 
                (EXTRACT(YEAR FROM r.date_recolte) - 1)::text || EXTRACT(YEAR FROM r.date_recolte)::text
            END as saison,
            SUM(v.quantite_grammes) as total_vendu
          FROM ventes v
          JOIN recoltes r ON v.recolte_id = r.id
          WHERE v.statut = 'Payée'
          GROUP BY saison
        )
        SELECT 
          COALESCE(rs.saison, vs.saison) as saison,
          COALESCE(rs.total_recolte, 0) as recolte_grammes,
          COALESCE(vs.total_vendu, 0) as vendu_grammes,
          COALESCE(rs.total_recolte, 0) - COALESCE(vs.total_vendu, 0) as disponible_grammes
        FROM recoltes_saison rs
        FULL OUTER JOIN ventes_saison vs ON rs.saison = vs.saison
        ORDER BY saison DESC
      `);

      // Prix moyen au kg pour estimation de valeur
      const prixMoyen = await pool.query(`
        SELECT COALESCE(AVG(prix_unitaire_kg), 800) as prix_moyen_kg
        FROM ventes
        WHERE statut = 'Payée' AND date_vente >= NOW() - INTERVAL '1 year'
      `);

      const stockDisponible = parseFloat(totalRecolte.rows[0].total_grammes) - parseFloat(totalVendu.rows[0].total_grammes);
      const prixMoyenKg = parseFloat(prixMoyen.rows[0].prix_moyen_kg);
      const valeurEstimee = (stockDisponible / 1000) * prixMoyenKg;
      const tauxUtilisation = parseFloat(totalRecolte.rows[0].total_grammes) > 0 
        ? (parseFloat(totalVendu.rows[0].total_grammes) / parseFloat(totalRecolte.rows[0].total_grammes)) * 100 
        : 0;

      res.json({
        stock_disponible_grammes: stockDisponible,
        total_recolte_grammes: parseFloat(totalRecolte.rows[0].total_grammes),
        total_vendu_grammes: parseFloat(totalVendu.rows[0].total_grammes),
        taux_utilisation: tauxUtilisation,
        prix_moyen_kg: prixMoyenKg,
        valeur_estimee: valeurEstimee,
        details_stock: detailsStock.rows.map(d => ({
          qualite: d.qualite,
          calibre: d.calibre,
          recolte_grammes: parseFloat(d.recolte_grammes),
          vendu_grammes: parseFloat(d.vendu_grammes),
          disponible_grammes: parseFloat(d.disponible_grammes)
        })),
        stock_par_saison: stockParSaison.rows.map(s => ({
          saison: s.saison,
          recolte_grammes: parseFloat(s.recolte_grammes),
          vendu_grammes: parseFloat(s.vendu_grammes),
          disponible_grammes: parseFloat(s.disponible_grammes)
        })),
        generated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erreur calcul stock:', err);
      res.status(500).json({ 
        error: 'Erreur lors du calcul du stock',
        code: 'STOCK_CALCULATION_ERROR',
        details: err.message
      });
    }
  });

  // GET /api/stock/recolte/:id - Stock disponible pour une récolte spécifique
  router.get('/recolte/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const recolte = await pool.query(
        'SELECT poids_grammes FROM recoltes WHERE id = $1',
        [id]
      );

      if (recolte.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Récolte non trouvée',
          code: 'RECOLTE_NOT_FOUND'
        });
      }

      const vendu = await pool.query(`
        SELECT COALESCE(SUM(quantite_grammes), 0) as total_vendu
        FROM ventes
        WHERE recolte_id = $1 AND statut = 'Payée'
      `, [id]);

      const poidsRecolte = parseFloat(recolte.rows[0].poids_grammes);
      const poidsVendu = parseFloat(vendu.rows[0].total_vendu);

      res.json({
        recolte_id: parseInt(id),
        poids_recolte: poidsRecolte,
        poids_vendu: poidsVendu,
        stock_disponible: poidsRecolte - poidsVendu
      });
    } catch (err) {
      console.error('Erreur stock récolte:', err);
      res.status(500).json({ 
        error: 'Erreur lors du calcul du stock de la récolte',
        code: 'RECOLTE_STOCK_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
