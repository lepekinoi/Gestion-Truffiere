// backend/routes/dashboard.routes.js
const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/dashboard/full - Dashboard consolidé complet
  router.get('/full', async (req, res) => {
    try {
      const [
        parcellesStats, arbresCount, arbresParEtat, recoltesSaison, ventesMois,
        interventionsAVenir, commandesEnCours, commandesEnAttente, ventesEnAttente,
        dernieresRecoltes, prochainesInterventions, commandesRecentes,
        productionMensuelle, productionParParcelle
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) as count, COALESCE(SUM(surface_ha), 0) as surface FROM parcelles'),
        pool.query('SELECT COUNT(*) as count FROM arbres WHERE deleted_at IS NULL'),
        pool.query(`
          SELECT etat_sanitaire, COUNT(*) as count 
          FROM arbres 
          WHERE deleted_at IS NULL 
          GROUP BY etat_sanitaire
          ORDER BY CASE etat_sanitaire 
            WHEN 'Bon' THEN 1 
            WHEN 'Moyen' THEN 2 
            WHEN 'Mauvais' THEN 3 
            WHEN 'Mort' THEN 4 
            ELSE 5 
          END
        `),
        pool.query(`
          SELECT COALESCE(SUM(poids_grammes), 0) as total_grammes, COUNT(*) as count
          FROM recoltes 
          WHERE date_recolte >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '3 months'
        `),
        pool.query(`
          SELECT COALESCE(SUM(montant_total), 0) as chiffre_affaires, COUNT(*) as count
          FROM ventes 
          WHERE date_vente >= DATE_TRUNC('month', CURRENT_DATE)
        `),
        pool.query(`
          SELECT COUNT(*) as count 
          FROM interventions 
          WHERE date_prevue >= CURRENT_DATE AND statut = 'Planifié'
        `),
        pool.query(`
          SELECT COUNT(*) as count 
          FROM commandes 
          WHERE statut IN ('En attente', 'Confirmée', 'En préparation')
        `),
        pool.query(`
          SELECT COUNT(*) as count 
          FROM commandes 
          WHERE statut IN ('En attente', 'Confirmée')
        `),
        pool.query(`
          SELECT COUNT(*) as count 
          FROM ventes 
          WHERE statut = 'En attente'
        `),
        pool.query(`
          SELECT r.id, r.date_recolte, r.poids_grammes, r.qualite, r.calibre,
                 p.nom as parcelle_nom, a.numero as arbre_numero 
          FROM recoltes r
          LEFT JOIN parcelles p ON r.parcelle_id = p.id 
          LEFT JOIN arbres a ON r.arbre_id = a.id
          ORDER BY r.date_recolte DESC 
          LIMIT 5
        `),
        pool.query(`
          SELECT i.id, i.date_prevue, i.statut, i.description,
                 t.nom as type_nom, t.couleur as type_couleur, 
                 p.nom as parcelle_nom, a.numero as arbre_numero
          FROM interventions i 
          LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
          LEFT JOIN parcelles p ON i.parcelle_id = p.id 
          LEFT JOIN arbres a ON i.arbre_id = a.id
          WHERE i.date_prevue >= CURRENT_DATE AND i.statut = 'Planifié' 
          ORDER BY i.date_prevue ASC 
          LIMIT 5
        `),
        pool.query(`
          SELECT c.id, c.numero_commande, c.date_commande, c.date_livraison_demandee,
                 c.poids_grammes, c.montant_total, c.statut, cl.nom as client_nom
          FROM commandes c 
          LEFT JOIN clients cl ON c.client_id = cl.id
          WHERE c.statut NOT IN ('Annulée', 'Livrée') 
          ORDER BY c.date_commande DESC 
          LIMIT 5
        `),
        pool.query(`
          SELECT TO_CHAR(date_recolte, 'YYYY-MM') as mois, 
                 SUM(poids_grammes) as total_grammes,
                 COUNT(*) as nombre_recoltes 
          FROM recoltes
          WHERE date_recolte >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
          GROUP BY TO_CHAR(date_recolte, 'YYYY-MM') 
          ORDER BY mois
        `),
        pool.query(`
          SELECT p.nom as parcelle_nom, COALESCE(SUM(r.poids_grammes), 0) as total_grammes
          FROM parcelles p 
          LEFT JOIN recoltes r ON r.parcelle_id = p.id 
          GROUP BY p.id, p.nom
          HAVING COALESCE(SUM(r.poids_grammes), 0) > 0 
          ORDER BY total_grammes DESC 
          LIMIT 10
        `)
      ]);

      res.json({
        stats: {
          parcelles: { 
            count: parseInt(parcellesStats.rows[0].count), 
            surface: parseFloat(parcellesStats.rows[0].surface) || 0 
          },
          arbres: { 
            count: parseInt(arbresCount.rows[0].count), 
            parEtat: arbresParEtat.rows.map(r => ({ 
              etat_sanitaire: r.etat_sanitaire, 
              count: parseInt(r.count) 
            })) 
          },
          recoltes: { 
            totalGrammes: parseFloat(recoltesSaison.rows[0].total_grammes) || 0, 
            count: parseInt(recoltesSaison.rows[0].count) 
          },
          ventes: { 
            chiffreAffaires: parseFloat(ventesMois.rows[0].chiffre_affaires) || 0, 
            count: parseInt(ventesMois.rows[0].count) 
          },
          interventions: { 
            aVenir: parseInt(interventionsAVenir.rows[0].count) 
          },
          commandes: { 
            enCours: parseInt(commandesEnCours.rows[0].count) 
          }
        },
        alertes: { 
          commandesEnAttente: parseInt(commandesEnAttente.rows[0].count), 
          ventesEnAttente: parseInt(ventesEnAttente.rows[0].count) 
        },
        activites: { 
          dernieresRecoltes: dernieresRecoltes.rows, 
          prochainesInterventions: prochainesInterventions.rows, 
          commandesEnCours: commandesRecentes.rows 
        },
        graphiques: {
          productionMensuelle: productionMensuelle.rows.map(r => ({ 
            mois: r.mois, 
            totalGrammes: parseFloat(r.total_grammes) || 0, 
            nombreRecoltes: parseInt(r.nombre_recoltes) 
          })),
          productionParParcelle: productionParParcelle.rows.map(r => ({ 
            nom: r.parcelle_nom, 
            totalGrammes: parseFloat(r.total_grammes) || 0 
          }))
        },
        meta: { 
          generatedAt: new Date().toISOString(), 
          periode: { 
            recoltes: 'Saison en cours', 
            ventes: 'Mois en cours', 
            graphiqueMensuel: '12 derniers mois' 
          } 
        }
      });
    } catch (err) {
      console.error('Erreur dashboard/full:', err);
      res.status(500).json({ 
        error: 'Erreur', 
        details: process.env.NODE_ENV === 'development' ? err.message : undefined 
      });
    }
  });

  return router;
};
