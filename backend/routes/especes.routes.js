// ============================================================
// especes.routes.js - Routes pour la gestion des espèces d'arbres
// Référentiel pour la sélection dans les formulaires
// ============================================================

const express = require('express');
const router = express.Router();

// Les routes seront enregistrées dans server.js
// Ce fichier n'est qu'un module - les middlewares sont gérés au niveau du serveur

/**
 * GET /api/especes
 * Récupérer toutes les espèces d'arbres
 * 
 * Query parameters:
 * - actif (boolean): filtrer par statut actif/inactif
 * - principal (boolean): filtrer les espèces principales uniquement
 * - groupe (string): filtrer par groupe principal ("Chêne", "Charme", "Noisetier", etc.)
 * - search (string): recherche textuelle sur le nom ou code
 * 
 * Réponse:
 * [
 *   {
 *     id: 1,
 *     nom: "Chêne pubescent",
 *     code: "P",
 *     nom_scientifique: "Quercus pubescens",
 *     description: "Chêne résistant à la sécheresse...",
 *     groupe_principal: "Chêne",
 *     est_espece_principale: true,
 *     ordre_affichage: 1,
 *     actif: true,
 *     created_at: "2026-01-25T00:00:00Z",
 *     updated_at: "2026-01-25T00:00:00Z"
 *   },
 *   ...
 * ]
 */
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
    
    const result = await req.pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur GET /api/especes:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des espèces',
      details: err.message
    });
  }
});

/**
 * GET /api/especes/:id
 * Récupérer une espèce spécifique
 * 
 * Paramètres:
 * - id (integer): ID de l'espèce
 * 
 * Réponse:
 * {
 *   id: 1,
 *   nom: "Chêne pubescent",
 *   code: "P",
 *   nom_scientifique: "Quercus pubescens",
 *   description: "...",
 *   groupe_principal: "Chêne",
 *   est_espece_principale: true,
 *   ordre_affichage: 1,
 *   actif: true,
 *   notes: "...",
 *   created_at: "...",
 *   updated_at: "..."
 * }
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validation simple
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        error: 'ID d\'espèce invalide',
        code: 'INVALID_ID'
      });
    }
    
    const result = await req.pool.query(
      'SELECT * FROM especes_arbres WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Espèce non trouvée',
        code: 'NOT_FOUND'
      });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur GET /api/especes/:id:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération',
      details: err.message
    });
  }
});

/**
 * GET /api/especes-groupes
 * Récupérer les groupes uniques d'espèces (pour filtres/sélection)
 * 
 * Réponse:
 * [
 *   "Chêne",
 *   "Charme",
 *   "Noisetier",
 *   "Tilleul",
 *   "Châtaignier",
 *   "Érable"
 * ]
 */
router.get('/groupes/list', async (req, res) => {
  try {
    const result = await req.pool.query(
      'SELECT DISTINCT groupe_principal FROM especes_arbres WHERE actif = true ORDER BY groupe_principal'
    );
    
    const groupes = result.rows.map(row => row.groupe_principal);
    res.json(groupes);
  } catch (err) {
    console.error('Erreur GET /api/especes-groupes:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des groupes',
      details: err.message
    });
  }
});

/**
 * GET /api/especes/stats
 * Statistiques sur les espèces (nombre d'arbres par espèce, etc.)
 * 
 * Réponse:
 * {
 *   total_especes: 12,
 *   especes_principales: 4,
 *   especes_actives: 12,
 *   par_groupe: [
 *     { groupe: "Chêne", count: 5, arbres: 42 },
 *     { groupe: "Charme", count: 2, arbres: 15 },
 *     ...
 *   ]
 * }
 */
router.get('/stats/overview', async (req, res) => {
  try {
    // Totaux généraux
    const totauxResult = await req.pool.query(`
      SELECT 
        COUNT(*) as total_especes,
        COUNT(*) FILTER (WHERE est_espece_principale = true) as especes_principales,
        COUNT(*) FILTER (WHERE actif = true) as especes_actives
      FROM especes_arbres
    `);
    
    // Statistiques par groupe
    const parGroupeResult = await req.pool.query(`
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
    console.error('Erreur GET /api/especes/stats:', err);
    res.status(500).json({ 
      error: 'Erreur lors du calcul des statistiques',
      details: err.message
    });
  }
});

module.exports = router;
