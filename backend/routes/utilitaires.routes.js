// ====================================================================
// routes/utilitaires.routes.js - Routes utilitaires (stats, stock, recherche, paramètres)
// ====================================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireWriteAccess } = require('../middleware/auth');

// ==================== ROUTES STATISTIQUES DASHBOARD ====================

// GET /api/stats/dashboard - Statistiques principales
router.get('/stats/dashboard', async (req, res) => {
  try {
    const parcelles = await pool.query('SELECT COUNT(*) as count, SUM(surface_ha) as surface FROM parcelles');
    const arbres = await pool.query('SELECT COUNT(*) as count FROM arbres WHERE deleted_at IS NULL');
    const arbresParEtat = await pool.query('SELECT etat, COUNT(*) as count FROM arbres WHERE deleted_at IS NULL GROUP BY etat');
    
    const recoltesSaison = await pool.query(`
      SELECT SUM(poids_grammes) as total_grammes, COUNT(*) as count 
      FROM recoltes 
      WHERE date_recolte >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '3 months'
    `);
    
    const ventesMois = await pool.query(`
      SELECT SUM(montant_total) as chiffre_affaires, COUNT(*) as count 
      FROM ventes 
      WHERE date_vente >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    
    const interventionsAVenir = await pool.query(`
      SELECT COUNT(*) as count 
      FROM interventions 
      WHERE date_prevue >= CURRENT_DATE AND statut = 'Planifié'
    `);
    
    const commandesEnCours = await pool.query(`
      SELECT COUNT(*) as count 
      FROM commandes 
      WHERE statut IN ('En attente', 'Confirmée', 'En préparation')
    `);

    res.json({
      parcelles: {
        count: parseInt(parcelles.rows[0].count),
        surface: parseFloat(parcelles.rows[0].surface) || 0
      },
      arbres: {
        count: parseInt(arbres.rows[0].count),
        parEtat: arbresParEtat.rows
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/stats/recoltes-annuelles
router.get('/stats/recoltes-annuelles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT EXTRACT(YEAR FROM date_recolte) as annee,
        SUM(poids_grammes) as total_grammes,
        COUNT(*) as nombre_recoltes
      FROM recoltes
      GROUP BY EXTRACT(YEAR FROM date_recolte)
      ORDER BY annee DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/stats/recoltes-mensuelles
router.get('/stats/recoltes-mensuelles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT TO_CHAR(date_recolte, 'YYYY-MM') as mois,
        SUM(poids_grammes) as total_grammes,
        COUNT(*) as nombre_recoltes
      FROM recoltes
      WHERE date_recolte >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year'
      GROUP BY TO_CHAR(date_recolte, 'YYYY-MM')
      ORDER BY mois
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/dashboard/full - Dashboard consolidé complet
router.get('/dashboard/full', async (req, res) => {
  try {
    const [
      parcellesStats, arbresCount, arbresParEtat, recoltesSaison,
      ventesMois, interventionsAVenir, commandesEnCours,
      commandesEnAttente, ventesEnAttente, dernieresRecoltes,
      prochainesInterventions, commandesRecentes,
      productionMensuelle, productionParParcelle
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count, COALESCE(SUM(surface_ha), 0) as surface FROM parcelles'),
      pool.query('SELECT COUNT(*) as count FROM arbres WHERE deleted_at IS NULL'),
      pool.query(`SELECT etat, COUNT(*) as count FROM arbres WHERE deleted_at IS NULL GROUP BY etat`),
      pool.query(`SELECT COALESCE(SUM(poids_grammes), 0) as total_grammes, COUNT(*) as count FROM recoltes WHERE date_recolte >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '3 months'`),
      pool.query(`SELECT COALESCE(SUM(montant_total), 0) as chiffre_affaires, COUNT(*) as count FROM ventes WHERE date_vente >= DATE_TRUNC('month', CURRENT_DATE)`),
      pool.query(`SELECT COUNT(*) as count FROM interventions WHERE date_prevue >= CURRENT_DATE AND statut = 'Planifié'`),
      pool.query(`SELECT COUNT(*) as count FROM commandes WHERE statut IN ('En attente', 'Confirmée', 'En préparation')`),
      pool.query(`SELECT COUNT(*) as count FROM commandes WHERE statut IN ('En attente', 'Confirmée')`),
      pool.query(`SELECT COUNT(*) as count FROM ventes WHERE statut = 'En attente'`),
      pool.query(`SELECT r.id, r.date_recolte, r.poids_grammes, r.qualite, r.calibre, p.nom as parcelle_nom, a.numero as arbre_numero FROM recoltes r LEFT JOIN parcelles p ON r.parcelle_id = p.id LEFT JOIN arbres a ON r.arbre_id = a.id ORDER BY r.date_recolte DESC LIMIT 5`),
      pool.query(`SELECT i.id, i.date_prevue, i.statut, i.description, t.nom as type_nom, t.couleur as type_couleur, p.nom as parcelle_nom, a.numero as arbre_numero FROM interventions i LEFT JOIN types_intervention t ON i.type_intervention_id = t.id LEFT JOIN parcelles p ON i.parcelle_id = p.id LEFT JOIN arbres a ON i.arbre_id = a.id WHERE i.date_prevue >= CURRENT_DATE AND i.statut = 'Planifié' ORDER BY i.date_prevue ASC LIMIT 5`),
      pool.query(`SELECT c.id, c.numero_commande, c.date_commande, c.date_livraison_demandee, c.poids_grammes, c.montant_total, c.statut, cl.nom as client_nom FROM commandes c LEFT JOIN clients cl ON c.client_id = cl.id WHERE c.statut NOT IN ('Annulée', 'Livrée') ORDER BY c.date_commande DESC LIMIT 5`),
      pool.query(`SELECT TO_CHAR(date_recolte, 'YYYY-MM') as mois, SUM(poids_grammes) as total_grammes, COUNT(*) as nombre_recoltes FROM recoltes WHERE date_recolte >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months' GROUP BY TO_CHAR(date_recolte, 'YYYY-MM') ORDER BY mois`),
      pool.query(`SELECT p.nom as parcelle_nom, COALESCE(SUM(r.poids_grammes), 0) as total_grammes FROM parcelles p LEFT JOIN recoltes r ON r.parcelle_id = p.id GROUP BY p.id, p.nom HAVING COALESCE(SUM(r.poids_grammes), 0) > 0 ORDER BY total_grammes DESC LIMIT 10`)
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
            etat: r.etat,
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
    res.status(500).json({ error: 'Erreur', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// ==================== ROUTES STOCK ====================

// GET /api/stock - Calcul du stock automatique
router.get('/stock', async (req, res) => {
  try {
    const totalRecolte = await pool.query(`SELECT COALESCE(SUM(poids_grammes), 0) as total_grammes FROM recoltes`);
    const totalVendu = await pool.query(`SELECT COALESCE(SUM(quantite_grammes), 0) as total_grammes FROM ventes WHERE statut = 'Payée'`);

    const detailsStock = await pool.query(`
      WITH recoltes_agg AS (
        SELECT COALESCE(qualite, 'Non spécifié') as qualite,
          COALESCE(calibre, 'Non spécifié') as calibre,
          SUM(poids_grammes) as total_recolte
        FROM recoltes
        GROUP BY COALESCE(qualite, 'Non spécifié'), COALESCE(calibre, 'Non spécifié')
      ),
      ventes_agg AS (
        SELECT COALESCE(r.qualite, 'Non spécifié') as qualite,
          COALESCE(r.calibre, 'Non spécifié') as calibre,
          SUM(v.quantite_grammes) as total_vendu
        FROM ventes v
        LEFT JOIN recoltes r ON v.recolte_id = r.id
        WHERE v.statut = 'Payée'
        GROUP BY COALESCE(r.qualite, 'Non spécifié'), COALESCE(r.calibre, 'Non spécifié')
      )
      SELECT COALESCE(ra.qualite, va.qualite) as qualite,
        COALESCE(ra.calibre, va.calibre) as calibre,
        COALESCE(ra.total_recolte, 0) as recolte_grammes,
        COALESCE(va.total_vendu, 0) as vendu_grammes,
        COALESCE(ra.total_recolte, 0) - COALESCE(va.total_vendu, 0) as disponible_grammes
      FROM recoltes_agg ra
      FULL OUTER JOIN ventes_agg va ON ra.qualite = va.qualite AND ra.calibre = va.calibre
      ORDER BY qualite, calibre
    `);

    const stockParSaison = await pool.query(`
      WITH recoltes_saison AS (
        SELECT CASE
            WHEN EXTRACT(MONTH FROM date_recolte) >= 11 
            THEN EXTRACT(YEAR FROM date_recolte)::text || '-' || (EXTRACT(YEAR FROM date_recolte) + 1)::text
            ELSE (EXTRACT(YEAR FROM date_recolte) - 1)::text || '-' || EXTRACT(YEAR FROM date_recolte)::text
          END as saison,
          SUM(poids_grammes) as total_recolte
        FROM recoltes
        GROUP BY saison
      ),
      ventes_saison AS (
        SELECT CASE
            WHEN EXTRACT(MONTH FROM r.date_recolte) >= 11 
            THEN EXTRACT(YEAR FROM r.date_recolte)::text || '-' || (EXTRACT(YEAR FROM r.date_recolte) + 1)::text
            ELSE (EXTRACT(YEAR FROM r.date_recolte) - 1// ... (suite du query stockParSaison)
        )::text || EXTRACT(YEAR FROM r.date_recolte)::text
          END as saison,
          SUM(v.quantite_grammes) as total_vendu
        FROM ventes v
        JOIN recoltes r ON v.recolte_id = r.id
        WHERE v.statut = 'Payée'
        GROUP BY saison
      )
      SELECT COALESCE(rs.saison, vs.saison) as saison,
        COALESCE(rs.total_recolte, 0) as recolte_grammes,
        COALESCE(vs.total_vendu, 0) as vendu_grammes,
        COALESCE(rs.total_recolte, 0) - COALESCE(vs.total_vendu, 0) as disponible_grammes
      FROM recoltes_saison rs
      FULL OUTER JOIN ventes_saison vs ON rs.saison = vs.saison
      ORDER BY saison DESC
    `);

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
    res.status(500).json({ error: 'Erreur lors du calcul du stock' });
  }
});

// GET /api/stock/recolte/:id - Stock d'une récolte spécifique
router.get('/stock/recolte/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const recolte = await pool.query('SELECT poids_grammes FROM recoltes WHERE id = $1', [id]);
    if (recolte.rows.length === 0) {
      return res.status(404).json({ error: 'Récolte non trouvée' });
    }

    const vendu = await pool.query(
      `SELECT COALESCE(SUM(quantite_grammes), 0) as total_vendu 
       FROM ventes WHERE recolte_id = $1 AND statut = 'Payée'`,
      [id]
    );

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
    res.status(500).json({ error: 'Erreur lors du calcul du stock de la récolte' });
  }
});

// ==================== ROUTES RECHERCHE GLOBALE ====================

// GET /api/search/global - Recherche globale
router.get('/search/global', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q.toLowerCase()}%`;
    const results = [];

    // Recherche parcelles
    try {
      const parcelles = await pool.query(
        `SELECT id, nom, surface_ha, type_sol FROM parcelles 
         WHERE LOWER(COALESCE(nom, '')) LIKE $1 LIMIT 5`,
        [searchTerm]
      );
      if (parcelles.rows.length > 0) {
        results.push({
          category: 'parcelles',
          items: parcelles.rows.map(p => ({
            id: p.id,
            title: p.nom,
            subtitle: `${p.surface_ha} ha - ${p.type_sol || 'Type non défini'}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche parcelles:', e.message);
    }

    // Recherche arbres
    try {
      const arbres = await pool.query(
        `SELECT a.id, a.numero, a.espece, a.variete_truffe, a.etat, p.nom as parcelle_nom
         FROM arbres a LEFT JOIN parcelles p ON a.parcelle_id = p.id
         WHERE LOWER(COALESCE(a.numero, '')) LIKE $1 LIMIT 5`,
        [searchTerm]
      );
      if (arbres.rows.length > 0) {
        results.push({
          category: 'arbres',
          items: arbres.rows.map(a => ({
            id: a.id,
            title: `${a.numero} - ${a.espece}`,
            subtitle: `${a.parcelle_nom || 'Sans parcelle'} - ${a.etat}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche arbres:', e.message);
    }

    // Recherche clients
    try {
      const clients = await pool.query(
        `SELECT id, type, nom, prenom, raison_sociale, email, ville
         FROM clients
         WHERE LOWER(COALESCE(nom, '')) LIKE $1 OR LOWER(COALESCE(raison_sociale, '')) LIKE $1
         LIMIT 5`,
        [searchTerm]
      );
      if (clients.rows.length > 0) {
        results.push({
          category: 'clients',
          items: clients.rows.map(c => ({
            id: c.id,
            title: c.type === 'Professionnel' ? (c.raison_sociale || c.nom) : `${c.prenom || ''} ${c.nom}`.trim(),
            subtitle: `${c.type} - ${c.ville || 'Ville NC'}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche clients:', e.message);
    }

    res.json(results);
  } catch (err) {
    console.error('Erreur recherche globale:', err);
    res.status(500).json({ error: 'Erreur lors de la recherche' });
  }
});

// ==================== ROUTES PARAMÈTRES ====================

// GET /api/parametres - Liste des paramètres
router.get('/parametres', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parametres ORDER BY cle');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/parametres/:cle - Un paramètre par clé
router.get('/parametres/:cle', async (req, res) => {
  try {
    const { cle } = req.params;
    const result = await pool.query('SELECT * FROM parametres WHERE cle = $1', [cle]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paramètre non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// PUT /api/parametres/:cle - Mettre à jour ou créer un paramètre
router.put('/parametres/:cle', requireWriteAccess, async (req, res) => {
  try {
    const { cle } = req.params;
    const { valeur } = req.body;

    const result = await pool.query(
      'UPDATE parametres SET valeur = $1 WHERE cle = $2 RETURNING *',
      [valeur, cle]
    );

    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        'INSERT INTO parametres (cle, valeur) VALUES ($1, $2) RETURNING *',
        [cle, valeur]
      );
      return res.json(insertResult.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// POST /api/parametres/reset - Réinitialiser les paramètres par défaut
router.post('/parametres/reset', requireWriteAccess, async (req, res) => {
  try {
    const defaults = {
      'colonnes_affichees_parcelles': '["nom", "surface_ha", "type_sol", "ph_sol", "date_creation"]',
      'colonnes_affichees_arbres': '["numero", "espece", "variete_truffe", "parcelle_nom", "etat"]',
      'colonnes_affichees_interventions': '["date_prevue", "type_nom", "parcelle_nom", "statut"]',
      'colonnes_affichees_recoltes': '["date_recolte", "parcelle_nom", "poids_grammes", "qualite"]',
      'colonnes_affichees_clients': '["nom", "type", "email", "telephone", "ville"]',
      'colonnes_affichees_ventes': '["date_vente", "client_nom", "quantite_grammes", "montant_total"]'
    };

    for (const [cle, valeur] of Object.entries(defaults)) {
      await pool.query(
        'INSERT INTO parametres (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO UPDATE SET valeur = $2',
        [cle, valeur]
      );
    }

    res.json({ message: 'Paramètres réinitialisés' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES PRÉFÉRENCES UTILISATEUR ====================

// GET /api/preferences-utilisateur - Préférences d'un utilisateur
router.get('/preferences-utilisateur', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id || 'default';
    const result = await pool.query('SELECT * FROM preferences_utilisateur WHERE user_id = $1', [userId.toString()]);

    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        'INSERT INTO preferences_utilisateur (user_id, colonnes_affichees, colonnes_export) VALUES ($1, $2, $3) RETURNING *',
        [userId.toString(), '{}', '{}']
      );
      return res.json(insertResult.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// PUT /api/preferences-utilisateur - Mettre à jour les préférences
router.put('/preferences-utilisateur', requireWriteAccess, async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id || 'default';
    const { colonnes_affichees, colonnes_export } = req.body;

    const result = await pool.query(
      `INSERT INTO preferences_utilisateur (user_id, colonnes_affichees, colonnes_export)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET colonnes_affichees = $2, colonnes_export = $3
       RETURNING *`,
      [userId.toString(), JSON.stringify(colonnes_affichees || {}), JSON.stringify(colonnes_export || {})]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES FACTURES ====================

// GET /api/factures/:venteId - Données pour facture
router.get('/factures/:venteId', async (req, res) => {
  try {
    const { venteId } = req.params;

    const vente = await pool.query(`
      SELECT v.*, c.type as client_type, c.nom as client_nom, c.prenom as client_prenom,
        c.raison_sociale as client_raison_sociale, c.email as client_email, c.telephone as client_telephone,
        c.adresse as client_adresse, c.code_postal as client_code_postal, c.ville as client_ville,
        c.pays as client_pays, c.siret as client_siret, r.date_recolte, r.qualite as recolte_qualite,
        r.calibre as recolte_calibre, r.maturite as recolte_maturite, p.nom as parcelle_nom
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN recoltes r ON v.recolte
      LEFT JOIN recoltes r ON v.recolte_id = r.id
      LEFT JOIN parcelles p ON r.parcelle_id = p.id
      WHERE v.id = $1
    `, [venteId]);

    if (vente.rows.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    // Récupérer paramètres entreprise
    const parametres = await pool.query(`
      SELECT cle, valeur FROM parametres 
      WHERE cle IN ('entreprise_nom', 'entreprise_adresse', 'entreprise_code_postal',
        'entreprise_ville', 'entreprise_telephone', 'entreprise_email', 'entreprise_siret',
        'entreprise_tva', 'facture_mentions_legales', 'facture_conditions_paiement',
        'facture_iban', 'facture_bic')
    `);

    const params = {};
    parametres.rows.forEach(p => {
      params[p.cle] = p.valeur;
    });

    const venteData = vente.rows[0];

    // Générer numéro facture si manquant
    let numeroFacture = venteData.numero_facture;
    if (!numeroFacture) {
      const year = new Date(venteData.date_vente).getFullYear();
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM ventes 
         WHERE EXTRACT(YEAR FROM date_vente) = $1 AND numero_facture IS NOT NULL`,
        [year]
      );
      const count = parseInt(countResult.rows[0].count) + 1;
      numeroFacture = `FAC-${year}-${String(count).padStart(4, '0')}`;

      await pool.query(
        `UPDATE ventes SET numero_facture = $1 WHERE id = $2`,
        [numeroFacture, venteId]
      );
    }

    res.json({
      facture: {
        numero: numeroFacture,
        date_emission: new Date().toISOString(),
        date_vente: venteData.date_vente,
        quantite_grammes: venteData.quantite_grammes,
        prix_unitaire_kg: venteData.prix_unitaire_kg,
        montant_ht: venteData.montant_total,
        tva_taux: 5.5,
        tva_montant: venteData.montant_total * 0.055,
        montant_ttc: venteData.montant_total * 1.055,
        mode_paiement: venteData.mode_paiement,
        statut: venteData.statut,
        notes: venteData.notes
      },
      client: {
        type: venteData.client_type,
        nom: venteData.client_nom,
        prenom: venteData.client_prenom,
        raison_sociale: venteData.client_raison_sociale,
        email: venteData.client_email,
        telephone: venteData.client_telephone,
        adresse: venteData.client_adresse,
        code_postal: venteData.client_code_postal,
        ville: venteData.client_ville,
        pays: venteData.client_pays,
        siret: venteData.client_siret
      },
      produit: {
        description: 'Truffes fraîches',
        qualite: venteData.recolte_qualite,
        calibre: venteData.recolte_calibre,
        maturite: venteData.recolte_maturite,
        date_recolte: venteData.date_recolte,
        parcelle: venteData.parcelle_nom
      },
      entreprise: {
        nom: params.entreprise_nom || 'Truffière',
        adresse: params.entreprise_adresse || '',
        code_postal: params.entreprise_code_postal || '',
        ville: params.entreprise_ville || '',
        telephone: params.entreprise_telephone || '',
        email: params.entreprise_email || '',
        siret: params.entreprise_siret || '',
        tva_intra: params.entreprise_tva || '',
        iban: params.facture_iban || '',
        bic: params.facture_bic || '',
        mentions_legales: params.facture_mentions_legales || '',
        conditions_paiement: params.facture_conditions_paiement || 'Paiement à réception'
      }
    });
  } catch (err) {
    console.error('Erreur récupération facture:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des données de facture' });
  }
});

// POST /api/factures/generer-numero - Générer un numéro de facture
router.post('/factures/generer-numero', requireWriteAccess, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM ventes 
       WHERE EXTRACT(YEAR FROM date_vente) = $1 AND numero_facture IS NOT NULL`,
      [year]
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const numeroFacture = `FAC-${year}-${String(count).padStart(4, '0')}`;

    res.json({ numero_facture: numeroFacture });
  } catch (err) {
    console.error('Erreur génération numéro facture:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du numéro de facture' });
  }
});

module.exports = router;


