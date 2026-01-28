// backend/routes/especes.routes.js
// Routes pour la gestion des espèces d'arbres - Référentiel
const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  // GET /api/especes - Récupérer toutes les espèces avec filtres
  router.get('/', async (req, res) => {
    try {
      const { actif, principal, groupe, search } = req.query;
      
      let query = 'SELECT * FROM especes_arbres WHERE 1=1';
      const params = [];
      let idx = 1;
      
      // Filtre actif
      if (actif !== undefined) {
        const isActive = actif === 'true' || actif === '1';
        query += ` AND actif = $${idx}`;
        params.push(isActive);
        idx++;
      }
      
      // Filtre espèces principales
      if (principal !== undefined) {
        const isPrincipal = principal === 'true' || principal === '1';
        query += ` AND est_espece_principale = $${idx}`;
        params.push(isPrincipal);
        idx++;
      }
      
      // Filtre par groupe
      if (groupe) {
        query += ` AND groupe_principal = $${idx}`;
        params.push(groupe);
        idx++;
      }
      
      // Recherche textuelle
      if (search) {
        const searchTerm = `%${search}%`;
        query += ` AND (nom ILIKE $${idx} OR code ILIKE $${idx} OR nom_scientifique ILIKE $${idx})`;
        params.push(searchTerm);
        idx++;
      }
      
      // Tri par ordre d'affichage
      query += ' ORDER BY ordre_affichage ASC, nom ASC';
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error('Erreur récupération espèces:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des espèces',
        code: 'LIST_ESPECES_ERROR',
        details: err.message
      });
    }
  });

  // GET /api/especes/:id - Récupérer une espèce spécifique
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validation simple
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          error: 'ID d\'espèce invalide',
          code: 'INVALID_ESPECE_ID'
        });
      }
      
      const result = await pool.query(
        'SELECT * FROM especes_arbres WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Espèce non trouvée',
          code: 'ESPECE_NOT_FOUND'
        });
      }
      
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erreur récupération espèce:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération de l\'espèce',
        code: 'GET_ESPECE_ERROR',
        details: err.message
      });
    }
  });

  // GET /api/especes/groupes/list - Récupérer les groupes uniques
  router.get('/groupes/list', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT DISTINCT groupe_principal FROM especes_arbres WHERE actif = true ORDER BY groupe_principal'
      );
      
      const groupes = result.rows.map(row => row.groupe_principal);
      res.json(groupes);
    } catch (err) {
      console.error('Erreur récupération groupes espèces:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des groupes',
        code: 'LIST_GROUPES_ESPECES_ERROR',
        details: err.message
      });
    }
  });

  // GET /api/especes/stats/overview - Statistiques sur les espèces
  router.get('/stats/overview', async (req, res) => {
    try {
      // Totaux généraux
      const totauxResult = await pool.query(`
        SELECT 
          COUNT(*) as total_especes,
          COUNT(*) FILTER (WHERE est_espece_principale = true) as especes_principales,
          COUNT(*) FILTER (WHERE actif = true) as especes_actives
        FROM especes_arbres
      `);
      
      // Statistiques par groupe
      const parGroupeResult = await pool.query(`
        SELECT 
          ea.groupe_principal,
          COUNT(DISTINCT ea.id) as especes_count,
          COUNT(a.id) as arbres_count
        FROM especes_arbres ea
        LEFT JOIN arbres a ON a.espece = ea.nom AND a.deleted_at IS NULL
        WHERE ea.actif = true
        GROUP BY ea.groupe_principal
        ORDER BY especes_count DESC
      `);
      
      const stats = {
        ...totauxResult.rows[0],
        par_groupe: parGroupeResult.rows
      };
      
      res.json(stats);
    } catch (err) {
      console.error('Erreur stats espèces:', err);
      res.status(500).json({ 
        error: 'Erreur lors du calcul des statistiques',
        code: 'STATS_ESPECES_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
