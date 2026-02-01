// backend/routes/parcelles.routes.js
const express = require('express');
const { emptyToNull, logAuditTrail } = require('../utils');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

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
          id: p.id, 
          nom: p.nom, 
          surface_ha: p.surface_ha, 
          type_sol: p.type_sol,
          ph_sol: p.ph_sol, 
          notes: p.notes,
          date_creation: p.date_creation, 
          coordinates: coordinates
        };
      });
      
      res.json(parcelles);
    } catch (err) {
      console.error('Erreur récupération parcelles:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des parcelles',
        code: 'LIST_PARCELLES_ERROR'
      });
    }
  });

  // GET /api/parcelles/:id - Détail d'une parcelle
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM parcelles WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Parcelle non trouvée',
          code: 'PARCELLE_NOT_FOUND'
        });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erreur récupération parcelle:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération de la parcelle',
        code: 'GET_PARCELLE_ERROR'
      });
    }
  });

  // POST /api/parcelles - Créer une parcelle
  router.post('/', requireWriteAccess, async (req, res) => {
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
            emptyToNull(type_sol),
            ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null,
            emptyToNull(notes),
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
            emptyToNull(type_sol),
            ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null,
            emptyToNull(notes)
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
          emptyToNull(type_sol),
          ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null,
          emptyToNull(notes)
        ];
      }

      console.log('🔵 Exécution SQL:', { query: query.substring(0, 80) + '...', params });

      const result = await pool.query(query, params);
      const newParcelle = result.rows[0];

      console.log('✅ Parcelle créée, ID:', newParcelle.id);

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'create', 'parcelle', newParcelle.id, null, newParcelle);
      }

      res.status(201).json(newParcelle);

    } catch (err) {
      console.error('═══════════════════════════════════════');
      console.error('❌ ERREUR POST /api/parcelles');
      console.error('Message:', err.message);
      console.error('Code:', err.code);
      console.error('Detail:', err.detail);
      console.error('═══════════════════════════════════════');

      res.status(500).json({ 
        error: 'Erreur lors de la création de la parcelle',
        code: 'CREATE_PARCELLE_ERROR',
        details: err.message
      });
    }
  });

  // PUT /api/parcelles/:id - Modifier une parcelle
  router.put('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      const { nom, surface_ha, type_sol, ph_sol, notes, coordinates, deleteGeometry } = req.body;
      
      // Récupérer anciennes valeurs pour audit trail
      const oldDataResult = await pool.query('SELECT * FROM parcelles WHERE id = $1', [id]);
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Parcelle non trouvée',
          code: 'PARCELLE_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      let query, params;
      
      if (deleteGeometry === true) {
        query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
                 notes = $5, geometrie = NULL WHERE id = $6 RETURNING *`;
        params = [
          nom, 
          surface_ha, 
          emptyToNull(type_sol), 
          ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null, 
          emptyToNull(notes), 
          id
        ];
      } else if (coordinates && coordinates.length > 0) {
        const coordsString = coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(', ');
        const polygonWKT = `POLYGON((${coordsString}, ${coordinates[0][1]} ${coordinates[0][0]}))`;
        
        query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
                 notes = $5, geometrie = ST_GeomFromText($6, 4326) WHERE id = $7 RETURNING *`;
        params = [
          nom, 
          surface_ha, 
          emptyToNull(type_sol), 
          ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null, 
          emptyToNull(notes), 
          polygonWKT, 
          id
        ];
      } else {
        query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
                 notes = $5 WHERE id = $6 RETURNING *`;
        params = [
          nom, 
          surface_ha, 
          emptyToNull(type_sol), 
          ph_sol && ph_sol !== '' ? parseFloat(ph_sol) : null, 
          emptyToNull(notes), 
          id
        ];
      }
      
      const result = await pool.query(query, params);
      const newData = result.rows[0];

      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'update', 'parcelle', parseInt(id), oldData, newData);
      }

      // ✅ CORRECTION : Récupérer avec transformation GeoJSON (comme GET /)
      const geoResult = await pool.query(`
        SELECT id, nom, surface_ha, type_sol, ph_sol, notes, date_creation,
               ST_AsGeoJSON(geometrie) as geojson
        FROM parcelles WHERE id = $1
      `, [id]);
      
      const p = geoResult.rows[0];
      let coords = [];
      if (p.geojson) {
        try {
          const geo = JSON.parse(p.geojson);
          if (geo.type === 'Polygon' && geo.coordinates && geo.coordinates[0]) {
            coords = geo.coordinates[0].map(coord => [coord[1], coord[0]]);
            if (coords.length > 0) coords.pop();
          }
        } catch (e) {
          console.error('Erreur parsing GeoJSON:', e);
        }
      }
      
      const formattedData = {
        id: p.id,
        nom: p.nom,
        surface_ha: p.surface_ha,
        type_sol: p.type_sol,
        ph_sol: p.ph_sol,
        notes: p.notes,
        date_creation: p.date_creation,
        coordinates: coords
      };
      
      res.json(formattedData);

    } catch (err) {
      console.error('Erreur mise à jour parcelle:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour de la parcelle',
        code: 'UPDATE_PARCELLE_ERROR',
        details: err.message
      });
    }
  });

  // DELETE /api/parcelles/:id - Supprimer une parcelle
  router.delete('/:id', requireWriteAccess, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Récupérer les données pour audit trail
      const oldDataResult = await pool.query('SELECT * FROM parcelles WHERE id = $1', [id]);
      if (oldDataResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Parcelle non trouvée',
          code: 'PARCELLE_NOT_FOUND'
        });
      }
      const oldData = oldDataResult.rows[0];
      
      const result = await pool.query('DELETE FROM parcelles WHERE id = $1 RETURNING *', [id]);
      
      // Audit trail
      if (req.user && req.user.id) {
        await logAuditTrail(pool, req.user.id, 'delete', 'parcelle', parseInt(id), oldData, null);
      }

      res.json({ 
        message: 'Parcelle supprimée',
        code: 'PARCELLE_DELETED'
      });
    } catch (err) {
      console.error('Erreur suppression parcelle:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la suppression de la parcelle',
        code: 'DELETE_PARCELLE_ERROR',
        details: err.message
      });
    }
  });

  return router;
};
