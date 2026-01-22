// ====================================================================
// routes/interventions.routes.js - Routes complètes pour les interventions
// ====================================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireWriteAccess } = require('../middleware/auth');

// Fonction utilitaire
const emptyToNull = (value) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  return value;
};

// ==================== ROUTES INTERVENTIONS ====================

// GET /api/interventions - Liste des interventions
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*,
        t.nom as type_nom,
        p.nom as parcelle_nom,
        a.numero as arbre_numero
      FROM interventions i
      LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
      LEFT JOIN parcelles p ON i.parcelle_id = p.id
      LEFT JOIN arbres a ON i.arbre_id = a.id
      ORDER BY i.date_prevue DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/interventions/check-doublon - Vérifier doublon
router.get('/check-doublon', async (req, res) => {
  try {
    const { arbre_id, type_intervention_id, date_prevue, exclude_id } = req.query;

    let query = `SELECT COUNT(*) as count FROM interventions 
                 WHERE arbre_id = $1 AND type_intervention_id = $2 AND date_prevue = $3`;
    const params = [arbre_id, type_intervention_id, date_prevue];

    if (exclude_id) {
      query += ' AND id != $4';
      params.push(exclude_id);
    }

    const result = await pool.query(query, params);
    res.json({ exists: parseInt(result.rows[0].count) > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// POST /api/interventions - Créer une intervention (avec détails optionnels)
router.post('/', requireWriteAccess, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee,
      duree_minutes, personnel, description, cout, statut, meteo, notes,
      // Détails d'irrigation
      volume_eau_m3, volume_eau_par_arbre_l, methode_irrigation, source_eau,
      debit_l_h, frequence_irrigation, humidite_sol_avant, humidite_sol_apres, pression_bar,
      // Détails de traitement
      categorie_traitement, nom_commercial, matiere_active, numero_amm,
      dose_produit_ha, dose_produit_arbre, concentration, volume_bouillie_l,
      surface_traitee_ha, methode_application, cible_traitement,
      delai_avant_recolte_jours, conditions_application, equipement_protection,
      zone_non_traitee_m, fabricant
    } = req.body;

    // Créer l'intervention principale
    const interventionResult = await client.query(
      `INSERT INTO interventions 
       (type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee,
        duree_minutes, personnel, description, cout, statut, meteo, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        emptyToNull(type_intervention_id),
        emptyToNull(parcelle_id),
        emptyToNull(arbre_id),
        date_prevue,
        emptyToNull(date_realisee),
        emptyToNull(duree_minutes),
        personnel || '',
        description || '',
        emptyToNull(cout),
        statut || 'Planifié',
        emptyToNull(meteo),
        emptyToNull(notes)
      ]
    );

    const intervention = interventionResult.rows[0];
    const interventionId = intervention.id;

    // Créer les détails si fournis
    const detailsRaw = {
      volume_eau_m3, volume_eau_par_arbre_l, methode_irrigation, source_eau,
      debit_l_h, frequence_irrigation, humidite_sol_avant, humidite_sol_apres,
      pression_bar, categorie_traitement, nom_commercial, matiere_active,
      numero_amm, dose_produit_ha, dose_produit_arbre, concentration,
      volume_bouillie_l, surface_traitee_ha, methode_application,
      cible_traitement, delai_avant_recolte_jours, conditions_application,
      equipement_protection, zone_non_traitee_m, fabricant
    };

    const detailFields = Object.entries(detailsRaw)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, value === '' ? null : value]);

    if (detailFields.length > 0) {
      const columns = ['intervention_id'];
      const values = [interventionId];
      const placeholders = ['$1'];
      let idx = 2;

      for (const [field, value] of detailFields) {
        columns.push(field);
        values.push(value);
        placeholders.push(`$${idx++}`);
      }

      await client.query(
        `INSERT INTO intervention_details (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
      );
    }

    await client.query('COMMIT');
    res.status(201).json(intervention);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur création intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'intervention', details: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/interventions/:id - Modifier une intervention
router.put('/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee,
      duree_minutes, personnel, description, cout, statut, meteo, notes
    } = req.body;

    const result = await pool.query(
      `UPDATE interventions SET
       type_intervention_id = $1, parcelle_id = $2, arbre_id = $3, date_prevue = $4,
       date_realisee = $5, duree_minutes = $6, personnel = $7, description = $8,
       cout = $9, statut = $10, meteo = $11, notes = $12
       WHERE id = $13
       RETURNING *`,
      [
        type_intervention_id, parcelle_id || null, arbre_id || null, date_prevue,
        date_realisee || null, duree_minutes || null, personnel, description,
        cout || null, statut, meteo, notes, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// DELETE /api/interventions/:id - Supprimer une intervention
router.delete('/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM interventions WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }
    res.json({ message: 'Intervention supprimée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ==================== ROUTES DÉTAILS INTERVENTIONS ====================

// GET /api/interventions/:id/details - Récupérer les détails
router.get('/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM intervention_details WHERE intervention_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur récupération détails intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
});

// POST /api/interventions/:id/details - Créer/Mettre à jour les détails
router.post('/:id/details', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const details = req.body;

    // Vérifier que l'intervention existe
    const interventionCheck = await pool.query('SELECT id FROM interventions WHERE id = $1', [id]);
    if (interventionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvée' });
    }

    // Vérifier si des détails existent déjà
    const existingDetails = await pool.query(
      'SELECT id FROM intervention_details WHERE intervention_id = $1',
      [id]
    );

    const fields = Object.keys(details).filter(key => details[key] !== undefined && details[key] !== '');

    if (fields.length === 0) {
      return res.json({ message: 'Aucun détail à enregistrer' });
    }

    let result;

    if (existingDetails.rows.length > 0) {
      // UPDATE
      const setClauses = fields.map((field, index) => `${field} = $${index + 1}`);
      const values = fields.map(field => details[field] === '' ? null : details[field]);
      values.push(id);

      result = await pool.query(
        `UPDATE intervention_details SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP 
         WHERE intervention_id = $${values.length} RETURNING *`,
        values
      );
    } else {
      // INSERT
      const columns = ['intervention_id', ...fields];
      const placeholders = columns.map((_, index) => `$${index + 1}`);
      const values = [id, ...fields.map(field => details[field] === '' ? null : details[field])];

      result = await pool.query(
        `INSERT INTO intervention_details (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur sauvegarde détails intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde des détails' });
  }
});

// DELETE /api/interventions/:id/details - Supprimer les détails
router.delete('/:id/details', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM intervention_details WHERE intervention_id = $1', [id]);
    res.json({ message: 'Détails supprimés' });
  } catch (err) {
    console.error('Erreur suppression détails intervention:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES PRODUITS PHYTO ====================

// GET /api/produits-phyto - Liste des produits phytosanitaires
router.get('/produits-phyto', async (req, res) => {
  try {
    const { categorie, bio_only } = req.query;

    let query = 'SELECT * FROM produits_phyto WHERE actif = true';
    const params = [];

    if (categorie) {
      params.push(categorie);
      query += ` AND categorie = $${params.length}`;
    }

    if (bio_only === 'true') {
      query += ' AND utilisable_bio = true';
    }

    query += ' ORDER BY nom_commercial';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération produits phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST /api/produits-phyto - Ajouter un produit phytosanitaire
router.post('/produits-phyto', requireWriteAccess, async (req, res) => {
  try {
    const {
      nom_commercial, matiere_active, numero_amm, categorie, fabricant,
      dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio,
      phrase_risque, conseils_utilisation
    } = req.body;

    const result = await pool.query(
      `INSERT INTO produits_phyto 
       (nom_commercial, matiere_active, numero_amm, categorie, fabricant,
        dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio,
        phrase_risque, conseils_utilisation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [nom_commercial, matiere_active, numero_amm, categorie, fabricant,
       dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio || false,
       phrase_risque, conseils_utilisation]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création produit phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/produits-phyto/:id - Modifier un produit phytosanitaire
router.put('/produits-phyto/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nom_commercial, matiere_active, numero_amm, categorie, fabricant,
      dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio,
      phrase_risque, conseils_utilisation, actif
    } = req.body;

    const result = await pool.query(
      `UPDATE produits_phyto SET
       nom_commercial = $1, matiere_active = $2, numero_amm = $3, categorie = $4,
       fabricant = $5, dose_recommandee_ha = $6, dar_jours = $7, znt_metres = $8,
       utilisable_bio = $9, phrase_risque = $10, conseils_utilisation = $11, actif = $12
       WHERE id = $13
       RETURNING *`,
      [nom_commercial, matiere_active, numero_amm, categorie, fabricant,
       dose_recommandee_ha, dar_jours, znt_metres, utilisable_bio,
       phrase_risque, conseils_utilisation, actif !== false, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur modification produit phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// DELETE /api/produits-phyto/:id - Désactiver un produit (soft delete)
router.delete('/produits-phyto/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE produits_phyto SET actif = false WHERE id = $1', [id]);
    res.json({ message: 'Produit désactivé' });
  } catch (err) {
    console.error('Erreur désactivation produit phyto:', err);
    res.status(500).json({ error: 'Erreur lors de la désactivation' });
  }
});

// ==================== ROUTES AMENDEMENTS ====================

// GET /api/amendements-ref - Liste des amendements
router.get('/amendements-ref', async (req, res) => {
  try {
    const { type, bio_only } = req.query;

    let query = 'SELECT * FROM amendements_ref WHERE actif = true';
    const params = [];

    if (type) {
      params.push(type);
      query += ` AND type_amendement = $${params.length}`;
    }

    if (bio_only === 'true') {
      query += ' AND utilisable_bio = true';
    }

    query += ' ORDER BY nom';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération amendements:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST /api/amendements-ref - Ajouter un amendement
router.post('/amendements-ref', requireWriteAccess, async (req, res) => {
  try {
    const {
      nom, type_amendement, composition, dose_recommandee_ha,
      utilisable_bio, effet_principal, precautions
    } = req.body;

    const result = await pool.query(
      `INSERT INTO amendements_ref 
       (nom, type_amendement, composition, dose_recommandee_ha,
        utilisable_bio, effet_principal, precautions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [nom, type_amendement, composition, dose_recommandee_ha,
       utilisable_bio || false, effet_principal, precautions]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création amendement:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// ==================== ROUTES STATISTIQUES INTERVENTIONS ====================

// GET /api/interventions/stats - Statistiques par type et période
router.get('/stats', async (req, res) => {
  try {
    const { date_debut, date_fin, parcelle_id } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (date_debut) {
      params.push(date_debut);
      whereClause += ` AND i.date_realisee >= $${params.length}`;
    }

    if (date_fin) {
      params.push(date_fin);
      whereClause += ` AND i.date_realisee <= $${params.length}`;
    }

    if (parcelle_id) {
      params.push(parcelle_id);
      whereClause += ` AND i.parcelle_id = $${params.length}`;
    }

    // Stats par type
    const statsByType = await pool.query(`
      SELECT t.nom as type_intervention, t.couleur,
        COUNT(i.id) as nombre,
        COALESCE(SUM(i.cout), 0) as cout_total,
        COALESCE(AVG(i.duree_minutes), 0) as duree_moyenne
      FROM interventions i
      JOIN types_intervention t ON i.type_intervention_id = t.id
      ${whereClause}
      GROUP BY t.id, t.nom, t.couleur
      ORDER BY nombre DESC
    `, params);

    // Totaux
    const totaux = await pool.query(`
      SELECT COUNT(*) as total_interventions,
        COALESCE(SUM(cout), 0) as cout_total,
        COALESCE(SUM(duree_minutes), 0) as duree_totale_minutes
      FROM interventions i
      ${whereClause}
    `, params);

    res.json({
      par_type: statsByType.rows,
      totaux: totaux.rows[0]
    });
  } catch (err) {
    console.error('Erreur statistiques interventions:', err);
    res.status(500).json({ error: 'Erreur lors du calcul des statistiques' });
  }
});

// GET /api/interventions/stats/eau - Consommation d'eau
router.get('/stats/eau', async (req, res) => {
  try {
    const { date_debut, date_fin, parcelle_id } = req.query;

    let whereClause = `WHERE i.type_intervention_id = (SELECT id FROM types_intervention WHERE nom = 'Irrigation' LIMIT 1)`;
    const params = [];

    if (date_debut) {
      params.push(date_debut);
      whereClause += ` AND i.date_realisee >= $${params.length}`;
    }

    if (date_fin) {
      params.push(date_fin);
      whereClause += ` AND i.date_realisee <= $${params.length}`;
    }

    if (parcelle_id) {
      params.push(parcelle_id);
      whereClause += ` AND i.parcelle_id = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT p.nom as parcelle,
        COUNT(i.id) as nb_irrigations,
        COALESCE(SUM(id.volume_eau_m3), 0) as volume_total_m3,
        COALESCE(AVG(id.volume_eau_m3), 0) as volume_moyen_m3,
        COALESCE(SUM(i.duree_minutes), 0) as duree_totale_minutes
      FROM interventions i
      LEFT JOIN intervention_details id ON i.id = id.intervention_id
      LEFT JOIN parcelles p ON i.parcelle_id = p.id
      ${whereClause}
      GROUP BY p.id, p.nom
      ORDER BY volume_total_m3 DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Erreur stats eau:', err);
    res.status(500).json({ error: 'Erreur lors du calcul' });
  }
});

// GET /api/interventions/stats/traitements - Historique traitements
router.get('/stats/traitements', async (req, res) => {
  try {
    const { date_debut, date_fin, parcelle_id } = req.query;

    let whereClause = `WHERE i.type_intervention_id = (SELECT id FROM types_intervention WHERE nom = 'Traitement' LIMIT 1)`;
    const params = [];

    if (date_debut) {
      params.push(date_debut);
      whereClause += ` AND i.date_realisee >= $${params.length}`;
    }

    if (date_fin) {
      params.push(date_fin);
      whereClause += ` AND i.date_realisee <= $${params.length}`;
    }

    if (parcelle_id) {
      params.push(parcelle_id);
      whereClause += ` AND i.parcelle_id = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT i.id, i.date_realisee, p.nom as parcelle, a.numero as arbre,
        id.nom_commercial, id.matiere_active, id.numero_amm, id.dose_produit_ha,
        id.surface_traitee_ha, id.volume_bouillie_l, id.methode_application,
        id.cible_traitement, id.delai_avant_recolte_jours, i.personnel, i.notes
      FROM interventions i
      LEFT JOIN intervention_details id ON i.id = id.intervention_id
      LEFT JOIN parcelles p ON i.parcelle_id = p.id
      LEFT JOIN arbres a ON i.arbre_id = a.id
      ${whereClause}
      ORDER BY i.date_realisee DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Erreur stats traitements:', err);
    res.status(500).json({ error: 'Erreur lors du calcul' });
  }
});

// GET /api/interventions/export - Export complet avec détails
router.get('/export', async (req, res) => {
  try {
    const { date_debut, date_fin, type_id, parcelle_id, statut } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (date_debut) {
      params.push(date_debut);
      whereClause += ` AND i.date_prevue >= $${params.length}`;
    }

    if (date_fin) {
      params.push(date_fin);
      whereClause += ` AND i.date_prevue <= $${params.length}`;
    }

    if (type_id) {
      params.push(type_id);
      whereClause += ` AND i.type_intervention_id = $${params.length}`;
    }

    if (parcelle_id) {
      params.push(parcelle_id);
      whereClause += ` AND i.parcelle_id = $${params.length}`;
    }

    if (statut) {
      params.push(statut);
      whereClause += ` AND i.statut = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT i.*, t.nom as type_nom, p.nom as parcelle_nom, a.numero as arbre_numero, id.*
      FROM interventions i
      LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
      LEFT JOIN parcelles p ON i.parcelle_id = p.id
      LEFT JOIN arbres a ON i.arbre_id = a.id
      LEFT JOIN intervention_details id ON i.id = id.intervention_id
      ${whereClause}
      ORDER BY i.date_prevue DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Erreur export interventions:', err);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

module.exports = router;
