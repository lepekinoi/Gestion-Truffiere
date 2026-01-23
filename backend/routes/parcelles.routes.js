// ============================================================
// parcelles.routes.js - Routes de gestion des parcelles
// Gestion des parcelles avec support PostGIS
// ============================================================

const express = require('express');

/**
 * Crée le router pour les parcelles
 * @param {Pool} pool - Instance de connexion PostgreSQL
 * @returns {Router} Router Express configuré
 */
const createParcellesRoutes = (pool) => {
  const router = express.Router();

  // ==================== FONCTIONS UTILITAIRES ====================
  
  /**
   * Convertir les valeurs vides en null pour PostgreSQL
   */
const emptyToNull = (value) => {
  if (value === '' || value === undefined || value === null) return null;
  return value;
};

  // ==================== MIDDLEWARE ====================
  
  /**
   * Middleware pour vérifier les permissions d'écriture
   */
  const authMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'readonly') {
      return res.status(403).json({ error: 'Accès en lecture seule', code: 'READONLY' });
    }
    next();
  };

  // ==================== ROUTES GET ====================
  
  // GET /api/parcelles - Liste toutes les parcelles avec géométrie
  router.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, nom, surface_ha, type_sol, ph_sol, notes, date_creation,
        ST_AsGeoJSON(geometrie) as geojson
        FROM parcelles ORDER BY nom
      `);
      
      const parcelles = result.rows.map(p => {
        let coordinates = [];
        if (p.geojson) {
          try {
            const geo = JSON.parse(p.geojson);
            if (geo.type === 'Polygon' && geo.coordinates && geo.coordinates[0]) {
              coordinates = geo.coordinates[0].map(coord => [coord[1], coord[0]]);
              if (coordinates.length > 0) coordinates.pop();
            }
          } catch (e) {
            console.error('Erreur parsing GeoJSON:', e);
          }
        }
        return {
          id: p.id, nom: p.nom, surface_ha: p.surface_ha, type_sol: p.type_sol,
          ph_sol: p.ph_sol, notes: p.notes,
          date_creation: p.date_creation, coordinates: coordinates
        };
      });
      
      res.json(parcelles);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la récupération des parcelles' });
    }
  });

  // GET /api/parcelles/:id - Récupère une parcelle par ID
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM parcelles WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Parcelle non trouvée' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur' });
    }
  });

  // ==================== ROUTES POST ====================
  
  // POST /api/parcelles - Crée une nouvelle parcelle
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const { nom, surface_ha, type_sol, ph_sol, notes, coordinates } = req.body;
      console.log('📥 POST /api/parcelles - Données reçues:', {
        nom,
        surface_ha,
        type_sol,
        ph_sol,
        notes,
        hasCoordinates: !!(coordinates && coordinates.length > 0)
      });
      
      // 🛡️ VALIDATION
      if (!nom || nom.trim() === '') {
        return res.status(400).json({ 
          error: 'Le nom est obligatoire',
          code: 'MISSING_NOM' 
        });
      }
      
      if (!surface_ha || isNaN(parseFloat(surface_ha))) {
        return res.status(400).json({ 
          error: 'La surface doit être un nombre valide',
          code: 'INVALID_SURFACE' 
        });
      }
      
      // Valider pH si fourni
      if (ph_sol !== null && ph_sol !== undefined && ph_sol !== '') {
        if (isNaN(parseFloat(ph_sol))) {
          return res.status(400).json({ 
            error: 'Le pH doit être un nombre valide',
            code: 'INVALID_PH' 
          });
        }
      }
      
      let query, params;
      
      // Avec coordonnées
      if (coordinates && coordinates.length > 0) {
        try {
          const coordsString = coordinates.map(coord => 
            `${coord[1]} ${coord[0]}`
          ).join(', ');
          
          const firstCoord = coordinates[0];
          const lastCoord = coordinates[coordinates.length - 1];
          const needsClosure = (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]);
          const polygonWKT = needsClosure 
            ? `POLYGON((${coordsString}, ${firstCoord[1]} ${firstCoord[0]}))`
            : `POLYGON((${coordsString}))`;
          
          query = `INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, notes, geometrie) 
            VALUES ($1, $2, $3, $4, $5, ST_GeomFromText($6, 4326)) 
            RETURNING *`;
          params = [
            nom.trim(),
            parseFloat(surface_ha),
            type_sol && type_sol.trim() !== '' ? type_sol.trim() : null,
            ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null,
            notes && notes.trim() !== '' ? notes.trim() : null,
            polygonWKT
          ];
        } catch (geoError) {
          console.error('⚠️ Erreur géométrie, création sans géométrie:', geoError.message);
          // Sans géométrie en cas d'erreur
          query = `INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, notes) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *`;
          params = [
            nom.trim(),
            parseFloat(surface_ha),
            type_sol && type_sol.trim() !== '' ? type_sol.trim() : null,
            ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null,
            notes && notes.trim() !== '' ? notes.trim() : null
          ];
        }
      } 
      // Sans coordonnées
      else {
        query = `INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, notes) 
          VALUES ($1, $2, $3, $4, $5) 
          RETURNING *`;
        params = [
          nom.trim(),
          parseFloat(surface_ha),
          type_sol && type_sol.trim() !== '' ? type_sol.trim() : null,
          ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null,
          notes && notes.trim() !== '' ? notes.trim() : null
        ];
      }
      
      console.log('🔵 Exécution SQL:', { query: query.substring(0, 80) + '...', params });
      const result = await pool.query(query, params);
      console.log('✅ Parcelle créée, ID:', result.rows[0].id);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('═══════════════════════════════════════');
      console.error('❌ ERREUR POST /api/parcelles');
      console.error('Message:', err.message);
      console.error('Code:', err.code);
      console.error('Detail:', err.detail);
      console.error('═══════════════════════════════════════');
      res.status(500).json({ 
        error: 'Erreur lors de la création',
        details: err.message,
        code: err.code
      });
    }
  });

  // ==================== ROUTES PUT ====================
  
  // PUT /api/parcelles/:id - Met à jour une parcelle
  router.put('/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { nom, surface_ha, type_sol, ph_sol, notes, coordinates, deleteGeometry } = req.body;
      
      let query, params;
      
      if (deleteGeometry === true) {
        query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
          notes = $5, geometrie = NULL WHERE id = $6 RETURNING *`;
        params = [nom, surface_ha, type_sol, ph_sol, notes, id];
      } else if (coordinates && coordinates.length > 0) {
        const coordsString = coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(', ');
        const polygonWKT = `POLYGON((${coordsString}, ${coordinates[0][1]} ${coordinates[0][0]}))`;
        
        query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
          notes = $5, geometrie = ST_GeomFromText($6, 4326) WHERE id = $7 RETURNING *`;
        params = [nom, surface_ha, type_sol, ph_sol, notes, polygonWKT, id];
      } else {
        query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
          notes = $5 WHERE id = $6 RETURNING *`;
        params = [nom, surface_ha, type_sol, ph_sol, notes, id];
      }
      
      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Parcelle non trouvée' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
  });

  // ==================== ROUTES DELETE ====================
  
  // DELETE /api/parcelles/:id - Supprime une parcelle
  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query('DELETE FROM parcelles WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Parcelle non trouvée' });
      }
      res.json({ message: 'Parcelle supprimée' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  });

  return router;
};

module.exports = createParcellesRoutes;
