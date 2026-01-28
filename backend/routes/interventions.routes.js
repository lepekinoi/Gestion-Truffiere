// backend/routes/interventions.routes.js
const express = require('express');
const { emptyToNull, logAuditTrail } = require('../utils');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/interventions - Liste des interventions
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT i.*, t.nom as type_nom, p.nom as parcelle_nom, a.numero as arbre_numero
        FROM interventions i
        LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
        LEFT JOIN parcelles p ON i.parcelle_id = p.id
        LEFT JOIN arbres a ON i.arbre_id = a.id
        ORDER BY i.date_prevue DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération interventions:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des interventions',
        code: 'LIST_INTERVENTIONS_ERROR'
      });
    }
  });

  // GET /api/interventions/check-doublon - Vérifier si intervention existe déjà
  router.get('/check-doublon', async (req, res) => {
    try {
      const { arbre_id, type_intervention_id, date_prevue, exclude_id } = req.query;
      
      let query = `
        SELECT COUNT(*) as count 
        FROM interventions 
        WHERE arbre_id = $1 AND type_intervention_id = $2 AND date_prevue = $3
      `;
      const params = [arbre_id, type_intervention_id, date_prevue];
      
      if (exclude_id) {
        query += ' AND id != $4';
        params.push(exclude_id);
      }
      
      const result = await pool.query(query, params);
      res.json({ exists: parseInt(result.rows[0].count) > 0 });
    } catch (err) {
      console.error('Erreur check doublon:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la vérification',
        code: 'CHECK_DOUBLON_ERROR'
      });
    }
  });

  // GET /api/interventions/stats - Statistiques des interventions par type et période
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
      
      // Statistiques par type d'intervention
      const statsByType = await pool.query(`
        SELECT 
          t.nom as type_intervention,
          t.couleur,
          COUNT(i.id) as nombre,
          COALESCE(SUM(i.cout), 0) as cout_total,
          COALESCE(AVG(i.duree_minutes), 0) as duree_moyenne
        FROM interventions i
        JOIN types_intervention t ON i.type_intervention_id = t.id
        ${whereClause}
        GROUP BY t.id, t.nom, t.couleur
        ORDER BY nombre DESC
      `, params);
      
      // Total général
      const totaux = await pool.query(`
        SELECT 
          COUNT(*) as total_interventions,
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
      res.status(500).json({ 
        error: 'Erreur lors du calcul des statistiques',
        code: 'STATS_ERROR'
      });
    }
  });

  // GET /api/interventions/stats/eau - Consommation d'eau par période
  router.get('/stats/eau', async (req, res) => {
    try {
      const { date_debut, date_fin, parcelle_id } = req.query;
      
      let whereClause = `
        WHERE i.type_intervention_id = (
          SELECT id FROM types_intervention WHERE nom = 'Irrigation' LIMIT 1
        )
      `;
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
        SELECT 
          p.nom as parcelle,
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
      res.status(500).json({ 
        error: 'Erreur lors du calcul des statistiques d\'eau',
        code: 'STATS_EAU_ERROR'
      });
    }
  });

  // GET /api/interventions/stats/traitements - Historique des traitements phyto (traçabilité)
  router.get('/stats/traitements', async (req, res) => {
    try {
      const { date_debut, date_fin, parcelle_id } = req.query;
      
      let whereClause = `
        WHERE i.type_intervention_id = (
          SELECT id FROM types_intervention WHERE nom = 'Traitement' LIMIT 1
        )
      `;
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
        SELECT 
          i.id,
          i.date_realisee,
          p.nom as parcelle,
          a.numero as arbre,
          id.nom_commercial,
          id.matiere_active,
          id.numero_amm,
          id.dose_produit_ha,
          id.surface_traitee_ha,
          id.volume_bouillie_l,
          id.methode_application,
          id.cible_traitement,
          id.delai_avant_recolte_jours,
          i.personnel,
          i.notes
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
      res.status(500).json({ 
        error: 'Erreur lors du calcul des statistiques de traitement',
        code: 'STATS_TRAITEMENTS_ERROR'
      });
    }
  });

  // GET /api/interventions/export - Interventions complètes avec détails (pour export)
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
        SELECT 
          i.*,
          t.nom as type_nom,
          p.nom as parcelle_nom,
          a.numero as arbre_numero,
          id.*
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
      res.status(500).json({ 
        error: 'Erreur lors de l\'export',
        code: 'EXPORT_ERROR'
      });
    }
  });

  // POST /api/interventions - Créer une intervention (avec détails optionnels)
  router.post('/', requireWriteAccess, async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { 
        type_intervention_id,
        parcelle_id,
        arbre_id,
        date_prevue,
        date_realisee,
        duree_minutes,
        personnel,
        description,
        cout,
        statut,
        meteo,
        notes,
        // Champs de détails
        volume_eau_m3,
        volume_eau_par_arbre_l,
        methode_irrigation,
        source_eau,
        debit_l_h,
        frequence_irrigation,
        humidite_sol_avant,
        humidite_sol_apres,
        pression_bar,
        categorie_traitement,
        nom_commercial,
        matiere_active,
        numero_amm,
        dose_produit_ha,
        dose_produit_arbre,
        concentration,
        volume_bouillie_l,
        surface_traitee_ha,
        methode_application,
        cible_traitement,
        delai_avant_recolte_jours,
        conditions_application,
        equipement_protection,
        zone_non_traitee_m,
        fabricant
      } = req.body;
      
      console.log('📥 Création intervention (transaction):', { 
        type_intervention_id, parcelle_id, arbre_id, date_prevue, statut 
      });
      
      // ÉTAPE 1 : créer l'intervention principale
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
      console.log('✅ Intervention créée, ID:', interventionId);

      // ÉTAPE 2 : créer une ligne dans intervention_details SI des champs de détail sont fournis
      const detailsRaw = {
        volume_eau_m3,
        volume_eau_par_arbre_l,
        methode_irrigation,
        source_eau,
        debit_l_h,
        frequence_irrigation,
        humidite_sol_avant,
        humidite_sol_apres,
        pression_bar,
        categorie_traitement,
        nom_commercial,
        matiere_active,
        numero_amm,
        dose_produit_ha,
        dose_produit_arbre,
        concentration,
        volume_bouillie_l,
        surface_traitee_ha,
        methode_application,
        cible_traitement,
        delai_avant_recolte_jours,
        conditions_application,
        equipement_protection,
        zone_non_traitee_m,
        fabricant
      };

      // Filtrer pour ne garder que les champs réellement renseignés
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

        console.log('📝 Insertion intervention_details:', { columns });

        await client.query(
          `INSERT INTO intervention_details (${columns.join(', ')})
           VALUES (${placeholders.join(', ')})`,
          values
        );
      } else {
        console.log('ℹ️ Aucun détail spécifique fourni');
      }

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create', 'intervention', interventionId, null, intervention);
      }

      await client.query('COMMIT');
      res.status(201).json(intervention);

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Erreur création intervention (transaction):', err);
      res.status(500).json({ 
        error: 'Erreur lors de la création de l\'intervention',
        code: 'CREATE_INTERVENTION_ERROR',
        details: err.message 
      });
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
      
      // Récupérer anciennes valeurs pour audit trail
      const oldDataResult = await pool.query(
        'SELECT * FROM interventions WHERE id = $1',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Intervention non trouvée',
          code: 'INTERVENTION_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        `UPDATE interventions SET 
          type_intervention_id = $1, parcelle_id = $2, arbre_id = $3, date_prevue = $4, 
          date_realisee = $5, duree_minutes = $6, personnel = $7, description = $8, 
          cout = $9, statut = $10, meteo = $11, notes = $12 
        WHERE id = $13 
        RETURNING *`,
        [
          type_intervention_id, 
          emptyToNull(parcelle_id), 
          emptyToNull(arbre_id), 
          date_prevue, 
          emptyToNull(date_realisee), 
          emptyToNull(duree_minutes), 
          personnel, 
          description, 
          emptyToNull(cout), 
          statut, 
          meteo, 
          notes, 
          id
        ]
      );
      
      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'intervention', parseInt(id), oldData, newData);
      }
      
      res.json(newData);
    } catch (err) {
      console.error('Erreur mise à jour intervention:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour de l\'intervention',
        code: 'UPDATE_INTERVENTION_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/interventions/:id - Supprimer une intervention
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Récupérer les données pour audit trail
      const oldDataResult = await pool.query(
        'SELECT * FROM interventions WHERE id = $1',
        [id]
      );
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Intervention non trouvée',
          code: 'INTERVENTION_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query(
        'DELETE FROM interventions WHERE id = $1 RETURNING *', 
        [id]
      );
      
      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'delete', 'intervention', parseInt(id), oldData, null);
      }
      
      res.json({ 
        message: 'Intervention supprimée',
        code: 'INTERVENTION_DELETED'
      });
    } catch (err) {
      console.error('Erreur suppression intervention:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la suppression de l\'intervention',
        code: 'DELETE_INTERVENTION_ERROR',
        details: err.message
      });
    }
  });

  // ==================== ROUTES INTERVENTION DETAILS ====================

  // GET /api/interventions/:id/details - Récupérer les détails d'une intervention
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
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des détails',
        code: 'GET_DETAILS_ERROR'
      });
    }
  });

  // POST /api/interventions/:id/details - Créer ou mettre à jour les détails
  router.post('/:id/details', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const details = req.body;
      
      // Vérifier que l'intervention existe
      const interventionCheck = await pool.query(
        'SELECT id FROM interventions WHERE id = $1', 
        [id]
      );
      if (interventionCheck.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Intervention non trouvée',
          code: 'INTERVENTION_NOT_FOUND'
        });
      }
      
      // Vérifier si des détails existent déjà
      const existingDetails = await pool.query(
        'SELECT id FROM intervention_details WHERE intervention_id = $1',
        [id]
      );
      
      // Construire dynamiquement la requête selon les champs fournis
      const fields = Object.keys(details).filter(
        key => details[key] !== undefined && details[key] !== ''
      );
      
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
          `UPDATE intervention_details 
           SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP 
           WHERE intervention_id = $${values.length} 
           RETURNING *`,
          values
        );
      } else {
        // INSERT
        const columns = ['intervention_id', ...fields];
        const placeholders = columns.map((_, index) => `$${index + 1}`);
        const values = [id, ...fields.map(field => details[field] === '' ? null : details[field])];
        
        result = await pool.query(
          `INSERT INTO intervention_details (${columns.join(', ')}) 
           VALUES (${placeholders.join(', ')}) 
           RETURNING *`,
          values
        );
      }
      
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erreur sauvegarde détails intervention:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la sauvegarde des détails',
        code: 'SAVE_DETAILS_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/interventions/:id/details - Supprimer les détails d'une intervention
  router.delete('/:id/details', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query(
        'DELETE FROM intervention_details WHERE intervention_id = $1', 
        [id]
      );
      res.json({ 
        message: 'Détails supprimés',
        code: 'DETAILS_DELETED'
      });
    } catch (err) {
      console.error('Erreur suppression détails intervention:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la suppression des détails',
        code: 'DELETE_DETAILS_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
