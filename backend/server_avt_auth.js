const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration de la base de donnees
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'truffiere',
  user: process.env.DB_USER || 'unstuffed1004',
  password: process.env.DB_PASSWORD || 'WeR87fFC8SN5IJUGz4w6Tl87t1Fm2840GepKl82Xe666J0D7hD',
});

// Test de connexion a la base de donnees
pool.connect((err, client, release) => {
  if (err) {
    console.error('Erreur de connexion a la base de donnees:', err.stack);
  } else {
    console.log('Connecte a la base de donnees PostgreSQL');
    release();
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes de base
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Truffiere fonctionnelle' });
});

// ==================== ROUTES HISTORIQUE ====================
app.get('/api/historique', async (req, res) => {
  try {
    const { table_name, start_date, end_date, action, limit = 500 } = req.query;
    
    let query = `
      SELECT h.*, 
             COALESCE(h.new_data->>'nom', h.new_data->>'numero', h.old_data->>'nom', h.old_data->>'numero', 'ID: ' || h.record_id::text) as item_name
      FROM historique h
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (table_name && table_name !== 'all') {
      query += ` AND h.table_name = $${paramIndex}`;
      params.push(table_name);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND h.timestamp >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND h.timestamp <= $${paramIndex}`;
      params.push(end_date + ' 23:59:59');
      paramIndex++;
    }
    
    if (action && action !== 'all') {
      query += ` AND h.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }
    
    query += ` ORDER BY h.timestamp DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation de l\'historique' });
  }
});

// Purge de l'historique
app.delete('/api/historique/purge', async (req, res) => {
  try {
    const { period, table_name, custom_date } = req.body;
    
    let deleteQuery = 'DELETE FROM historique WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    // Filtrer par pÃƒÂ©riode
    if (period === 'year') {
      deleteQuery += ` AND timestamp < NOW() - INTERVAL '1 year'`;
    } else if (period === 'month') {
      deleteQuery += ` AND timestamp < NOW() - INTERVAL '1 month'`;
    } else if (period === '6months') {
      deleteQuery += ` AND timestamp < NOW() - INTERVAL '6 months'`;
    } else if (period === 'custom' && custom_date) {
      deleteQuery += ` AND timestamp < $${paramIndex}`;
      params.push(custom_date);
      paramIndex++;
    }
    
    // Filtrer par table
    if (table_name && table_name !== 'all') {
      deleteQuery += ` AND table_name = $${paramIndex}`;
      params.push(table_name);
      paramIndex++;
    }
    
    deleteQuery += ' RETURNING id';
    
    const result = await pool.query(deleteQuery, params);
    res.json({ 
      message: 'Purge effectuee', 
      deleted_count: result.rows.length 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la purge de l\'historique' });
  }
});

// Stats de l'historique
app.get('/api/historique/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        table_name,
        action,
        COUNT(*) as count
      FROM historique
      GROUP BY table_name, action
      ORDER BY table_name, action
    `);
    
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM historique');
    const oldestResult = await pool.query('SELECT MIN(timestamp) as oldest FROM historique');
    
    res.json({
      stats: result.rows,
      total: parseInt(totalResult.rows[0].total),
      oldest: oldestResult.rows[0].oldest
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des stats' });
  }
});

// ==================== ROUTES CAVEURS ====================
app.get('/api/caveurs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM caveurs ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des caveurs' });
  }
});

app.post('/api/caveurs', async (req, res) => {
  try {
    const { nom } = req.body;
    const result = await pool.query(
      'INSERT INTO caveurs (nom) VALUES ($1) RETURNING *',
      [nom]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation du caveur' });
  }
});

app.put('/api/caveurs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom } = req.body;
    const result = await pool.query(
      'UPDATE caveurs SET nom = $1 WHERE id = $2 RETURNING *',
      [nom, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caveur non trouve' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour du caveur' });
  }
});

app.delete('/api/caveurs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM caveurs WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caveur non trouve' });
    }
    res.json({ message: 'Caveur supprime' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression du caveur' });
  }
});

// ==================== ROUTES CHIENS ====================
app.get('/api/chiens', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM chiens ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des chiens' });
  }
});

app.post('/api/chiens', async (req, res) => {
  try {
    const { nom, race } = req.body;
    const result = await pool.query(
      'INSERT INTO chiens (nom, race) VALUES ($1, $2) RETURNING *',
      [nom, race || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation du chien' });
  }
});

app.put('/api/chiens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, race } = req.body;
    const result = await pool.query(
      'UPDATE chiens SET nom = $1, race = $2 WHERE id = $3 RETURNING *',
      [nom, race || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chien non trouve' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour du chien' });
  }
});

app.delete('/api/chiens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM chiens WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chien non trouve' });
    }
    res.json({ message: 'Chien supprime' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression du chien' });
  }
});

// ==================== ROUTES PARCELLES ====================
app.get('/api/parcelles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nom, surface_ha, type_sol, ph_sol, exposition, notes, date_creation,
             ST_AsGeoJSON(geometrie) as geojson
      FROM parcelles 
      ORDER BY nom
    `);
    
    const parcelles = result.rows.map(p => {
      let coordinates = [];
      if (p.geojson) {
        try {
          const geo = JSON.parse(p.geojson);
          if (geo.type === 'Polygon' && geo.coordinates && geo.coordinates[0]) {
            coordinates = geo.coordinates[0].map(coord => [coord[1], coord[0]]);
            if (coordinates.length > 0) {
              coordinates.pop();
            }
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
        exposition: p.exposition,
        notes: p.notes,
        date_creation: p.date_creation,
        coordinates: coordinates
      };
    });
    
    res.json(parcelles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des parcelles' });
  }
});

app.get('/api/parcelles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM parcelles WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvee' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation de la parcelle' });
  }
});

app.post('/api/parcelles', async (req, res) => {
  try {
    const { nom, surface_ha, type_sol, ph_sol, exposition, notes, coordinates } = req.body;
    
    let query, params;
    
    if (coordinates && coordinates.length > 0) {
      const coordsString = coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(', ');
      const polygonWKT = `POLYGON((${coordsString}, ${coordinates[0][1]} ${coordinates[0][0]}))`;
      
      query = `INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, exposition, notes, geometrie) 
               VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromText($7, 4326)) RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, exposition, notes, polygonWKT];
    } else {
      query = 'INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, exposition, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
      params = [nom, surface_ha, type_sol, ph_sol, exposition, notes];
    }
    
    const result = await pool.query(query, params);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation de la parcelle' });
  }
});

app.put('/api/parcelles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, surface_ha, type_sol, ph_sol, exposition, notes, coordinates, deleteGeometry } = req.body;
    
    let query, params;
    
    if (deleteGeometry === true) {
      query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
               exposition = $5, notes = $6, geometrie = NULL 
               WHERE id = $7 RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, exposition, notes, id];
    }
    else if (coordinates && coordinates.length > 0) {
      const coordsString = coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(', ');
      const polygonWKT = `POLYGON((${coordsString}, ${coordinates[0][1]} ${coordinates[0][0]}))`;
      
      query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
               exposition = $5, notes = $6, geometrie = ST_GeomFromText($7, 4326) 
               WHERE id = $8 RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, exposition, notes, polygonWKT, id];
    } 
    else {
      query = `UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, 
               exposition = $5, notes = $6 WHERE id = $7 RETURNING *`;
      params = [nom, surface_ha, type_sol, ph_sol, exposition, notes, id];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvee' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour' });
  }
});

app.delete('/api/parcelles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM parcelles WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvee' });
    }
    res.json({ message: 'Parcelle supprimee' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES ARBRES ====================
app.get('/api/arbres', async (req, res) => {
  try {
    const { includeDeleted } = req.query;
    let query = `
      SELECT a.*, p.nom as parcelle_nom
      FROM arbres a
      LEFT JOIN parcelles p ON a.parcelle_id = p.id
    `;
    
    if (includeDeleted !== 'true') {
      query += ' WHERE a.deleted_at IS NULL';
    }
    
    query += ' ORDER BY a.numero';
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des arbres' });
  }
});

app.get('/api/arbres/corbeille', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, p.nom as parcelle_nom
      FROM arbres a
      LEFT JOIN parcelles p ON a.parcelle_id = p.id
      WHERE a.deleted_at IS NOT NULL
      ORDER BY a.deleted_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation de la corbeille' });
  }
});

app.post('/api/arbres', async (req, res) => {
  try {
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, latitude, longitude, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO arbres (parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, latitude, longitude, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [parcelle_id, numero, espece, variete_truffe, date_plantation, etat || 'Bon', circonference_cm, hauteur_m, latitude || null, longitude || null, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation de l\'arbre' });
  }
});

app.put('/api/arbres/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, date_derniere_taille, latitude, longitude, notes } = req.body;
    const result = await pool.query(
      `UPDATE arbres SET parcelle_id = $1, numero = $2, espece = $3, variete_truffe = $4, 
       date_plantation = $5, etat = $6, circonference_cm = $7, hauteur_m = $8, 
       date_derniere_taille = $9, latitude = $10, longitude = $11, notes = $12
       WHERE id = $13 AND deleted_at IS NULL RETURNING *`,
      [parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, date_derniere_taille, latitude || null, longitude || null, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouve' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour' });
  }
});

app.delete('/api/arbres/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE arbres SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouve' });
    }
    res.json({ message: 'Arbre mis a la corbeille', arbre: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'arbre' });
  }
});

app.post('/api/arbres/corbeille/:id/restaurer', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE arbres SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouve dans la corbeille' });
    }
    res.json({ message: 'Arbre restaure', arbre: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la restauration de l\'arbre' });
  }
});

app.delete('/api/arbres/corbeille/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM arbres WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouve dans la corbeille' });
    }
    res.json({ message: 'Arbre supprime definitivement', arbre: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression definitive' });
  }
});

app.delete('/api/arbres/corbeille', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM arbres WHERE deleted_at IS NOT NULL RETURNING id'
    );
    res.json({ 
      message: 'Corbeille videe', 
      count: result.rows.length 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du vidage de la corbeille' });
  }
});

// ==================== ROUTES TYPES INTERVENTION ====================
app.get('/api/types-intervention', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM types_intervention ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des types' });
  }
});

// ==================== ROUTES INTERVENTIONS ====================
app.get('/api/interventions', async (req, res) => {
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
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des interventions' });
  }
});

// VÃƒÂ©rifier les interventions en doublon
app.get('/api/interventions/check-doublon', async (req, res) => {
  try {
    const { arbre_id, type_intervention_id, date_prevue, exclude_id } = req.query;
    
    let query = `
      SELECT COUNT(*) as count FROM interventions 
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
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la verification' });
  }
});

app.post('/api/interventions', async (req, res) => {
  try {
    const { type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee, duree_minutes, personnel, description, cout, statut, meteo, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO interventions (type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee, duree_minutes, personnel, description, cout, statut, meteo, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [type_intervention_id, parcelle_id || null, arbre_id || null, date_prevue, date_realisee || null, duree_minutes || null, personnel, description, cout || null, statut || 'Planifie', meteo, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation de l\'intervention' });
  }
});

app.put('/api/interventions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type_intervention_id, parcelle_id, arbre_id, date_prevue, date_realisee, duree_minutes, personnel, description, cout, statut, meteo, notes } = req.body;
    const result = await pool.query(
      `UPDATE interventions SET type_intervention_id = $1, parcelle_id = $2, arbre_id = $3, date_prevue = $4, 
       date_realisee = $5, duree_minutes = $6, personnel = $7, description = $8, cout = $9, statut = $10,
       meteo = $11, notes = $12 WHERE id = $13 RETURNING *`,
      [type_intervention_id, parcelle_id || null, arbre_id || null, date_prevue, date_realisee || null, duree_minutes || null, personnel, description, cout || null, statut, meteo, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvee' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour' });
  }
});

app.delete('/api/interventions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM interventions WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention non trouvee' });
    }
    res.json({ message: 'Intervention supprimee' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES RECOLTES ====================
app.get('/api/recoltes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, p.nom as parcelle_nom, a.numero as arbre_numero
      FROM recoltes r
      LEFT JOIN parcelles p ON r.parcelle_id = p.id
      LEFT JOIN arbres a ON r.arbre_id = a.id
      ORDER BY r.date_recolte DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des recoltes' });
  }
});

app.post('/api/recoltes', async (req, res) => {
  try {
    const { 
      parcelle_id, 
      arbre_id, 
      date_recolte, 
      poids_grammes, 
      qualite, 
      calibre,
      maturite,
      profondeur_cm,
      conditions_meteo,
      temperature_sol,
      caveur,
      chien,
      notes 
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO recoltes (parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, profondeur_cm, conditions_meteo, temperature_sol, caveur, chien, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        parcelle_id || null, 
        arbre_id || null, 
        date_recolte, 
        poids_grammes, 
        qualite || null, 
        calibre || null,
        maturite || null,
        profondeur_cm || null,
        conditions_meteo || null,
        temperature_sol || null,
        caveur || null,
        chien || null,
        notes || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation de la recolte' });
  }
});

app.put('/api/recoltes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      parcelle_id, 
      arbre_id, 
      date_recolte, 
      poids_grammes, 
      qualite, 
      calibre,
      maturite,
      profondeur_cm,
      conditions_meteo,
      temperature_sol,
      caveur,
      chien,
      notes 
    } = req.body;
    
    const result = await pool.query(
      `UPDATE recoltes SET 
        parcelle_id = $1, 
        arbre_id = $2, 
        date_recolte = $3, 
        poids_grammes = $4,
        qualite = $5, 
        calibre = $6, 
        maturite = $7,
        profondeur_cm = $8,
        conditions_meteo = $9,
        temperature_sol = $10,
        caveur = $11,
        chien = $12,
        notes = $13 
       WHERE id = $14 RETURNING *`,
      [
        parcelle_id || null, 
        arbre_id || null, 
        date_recolte, 
        poids_grammes, 
        qualite || null, 
        calibre || null,
        maturite || null,
        profondeur_cm || null,
        conditions_meteo || null,
        temperature_sol || null,
        caveur || null,
        chien || null,
        notes || null, 
        id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recolte non trouvee' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour' });
  }
});

app.delete('/api/recoltes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM recoltes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recolte non trouvee' });
    }
    res.json({ message: 'Recolte supprimee', recolte: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES CLIENTS ====================
app.get('/api/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY nom, raison_sociale');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des clients' });
  }
});

// Stats client avec commandes et ventes
app.get('/api/clients/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    const commandesResult = await pool.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(montant_total), 0) as total
      FROM commandes WHERE client_id = $1
    `, [id]);
    
    const ventesResult = await pool.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(montant_total), 0) as total
      FROM ventes WHERE client_id = $1
    `, [id]);
    
    res.json({
      commandes: {
        count: parseInt(commandesResult.rows[0].count),
        total: parseFloat(commandesResult.rows[0].total)
      },
      ventes: {
        count: parseInt(ventesResult.rows[0].count),
        total: parseFloat(ventesResult.rows[0].total)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des stats client' });
  }
});

// Stats globales par type de client
app.get('/api/clients/stats/by-type', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.type,
        COUNT(DISTINCT c.id) as nb_clients,
        COALESCE(SUM(cmd.montant_total), 0) as total_commandes,
        COALESCE(SUM(v.montant_total), 0) as total_ventes
      FROM clients c
      LEFT JOIN commandes cmd ON c.id = cmd.client_id
      LEFT JOIN ventes v ON c.id = v.client_id
      GROUP BY c.type
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des stats' });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO clients (type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [type || 'Particulier', nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays || 'France', siret, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation du client' });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes } = req.body;
    const result = await pool.query(
      `UPDATE clients SET type = $1, nom = $2, prenom = $3, raison_sociale = $4, email = $5,
       telephone = $6, adresse = $7, code_postal = $8, ville = $9, pays = $10, siret = $11, notes = $12
       WHERE id = $13 RETURNING *`,
      [type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, pays, siret, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouve' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour' });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client non trouve' });
    }
    res.json({ message: 'Client supprime' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES VENTES ====================
app.get('/api/ventes', async (req, res) => {
  try {
    const { client_id, recolte_id } = req.query;
    
    let query = `
      SELECT v.*, 
             c.type as client_type, c.nom as client_nom, c.prenom as client_prenom, c.raison_sociale,
             r.date_recolte, r.poids_grammes as recolte_poids, a.numero as arbre_numero
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN recoltes r ON v.recolte_id = r.id
      LEFT JOIN arbres a ON r.arbre_id = a.id
    `;
    
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (client_id) {
      conditions.push(`v.client_id = $${paramIndex}`);
      params.push(client_id);
      paramIndex++;
    }
    
    if (recolte_id) {
      conditions.push(`v.recolte_id = $${paramIndex}`);
      params.push(recolte_id);
      paramIndex++;
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY v.date_vente DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des ventes' });
  }
});

app.post('/api/ventes', async (req, res) => {
  try {
    const { client_id, recolte_id, commande_id, date_vente, quantite_grammes, prix_unitaire_kg, mode_paiement, statut, numero_facture, notes } = req.body;
    
    // Calculer le montant total
    const montant_total = quantite_grammes && prix_unitaire_kg 
      ? (parseFloat(quantite_grammes) / 1000) * parseFloat(prix_unitaire_kg) 
      : 0;
    
    const result = await pool.query(
      `INSERT INTO ventes (client_id, recolte_id, commande_id, date_vente, quantite_grammes, prix_unitaire_kg, montant_total, mode_paiement, statut, numero_facture, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [client_id, recolte_id || null, commande_id || null, date_vente, quantite_grammes, prix_unitaire_kg || null, montant_total, mode_paiement, statut || 'En attente', numero_facture, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation de la vente' });
  }
});

app.put('/api/ventes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { client_id, recolte_id, commande_id, date_vente, quantite_grammes, prix_unitaire_kg, mode_paiement, statut, numero_facture, notes } = req.body;
    
    // Calculer le montant total
    const montant_total = quantite_grammes && prix_unitaire_kg 
      ? (parseFloat(quantite_grammes) / 1000) * parseFloat(prix_unitaire_kg) 
      : 0;
    
    const result = await pool.query(
      `UPDATE ventes SET client_id = $1, recolte_id = $2, commande_id = $3, date_vente = $4, quantite_grammes = $5,
       prix_unitaire_kg = $6, montant_total = $7, mode_paiement = $8, statut = $9, numero_facture = $10, notes = $11
       WHERE id = $12 RETURNING *`,
      [client_id, recolte_id || null, commande_id || null, date_vente, quantite_grammes, prix_unitaire_kg || null, montant_total, mode_paiement, statut, numero_facture, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvee' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour' });
  }
});

app.delete('/api/ventes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM ventes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvee' });
    }
    res.json({ message: 'Vente supprimee' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES COMMANDES ====================
app.get('/api/commandes', async (req, res) => {
  try {
    const { client_id } = req.query;
    
    let query = `
      SELECT c.*, 
             cl.type as client_type, cl.nom as client_nom, cl.prenom as client_prenom, cl.raison_sociale
      FROM commandes c
      LEFT JOIN clients cl ON c.client_id = cl.id
    `;
    
    if (client_id) {
      query += ' WHERE c.client_id = $1';
      query += ' ORDER BY c.date_commande DESC';
      const result = await pool.query(query, [client_id]);
      return res.json(result.rows);
    }
    
    query += ' ORDER BY c.date_commande DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des commandes' });
  }
});

app.get('/api/commandes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*, 
             cl.type as client_type, cl.nom as client_nom, cl.prenom as client_prenom, 
             cl.raison_sociale, cl.email, cl.telephone, cl.adresse, cl.code_postal, cl.ville
      FROM commandes c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvee' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation de la commande' });
  }
});

app.post('/api/commandes', async (req, res) => {
  try {
    const { client_id, date_commande, date_livraison_demandee, poids_grammes, calibre, qualite, maturite, prix_unitaire_kg, statut, notes } = req.body;
    
    // Generer un numero de commande unique
    const year = new Date().getFullYear();
    const countResult = await pool.query('SELECT COUNT(*) FROM commandes WHERE EXTRACT(YEAR FROM date_commande) = $1', [year]);
    const count = parseInt(countResult.rows[0].count) + 1;
    const numero_commande = `CMD-${year}-${String(count).padStart(4, '0')}`;
    
    // Convertir les valeurs vides en null pour les champs numÃ©riques
    const poidsGrammesVal = poids_grammes === '' || poids_grammes === null || poids_grammes === undefined ? null : poids_grammes;
    const prixUnitaireKgVal = prix_unitaire_kg === '' || prix_unitaire_kg === null || prix_unitaire_kg === undefined ? null : prix_unitaire_kg;
    
    // Calculer le montant total
    const montant_total = poidsGrammesVal && prixUnitaireKgVal 
      ? (parseFloat(poidsGrammesVal) / 1000) * parseFloat(prixUnitaireKgVal) 
      : null;
    
    const result = await pool.query(
      `INSERT INTO commandes (client_id, numero_commande, date_commande, date_livraison_demandee, poids_grammes, calibre, qualite, maturite, prix_unitaire_kg, montant_total, statut, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [client_id || null, numero_commande, date_commande, date_livraison_demandee || null, poidsGrammesVal, calibre || null, qualite || null, maturite || null, prixUnitaireKgVal, montant_total, statut || 'En attente', notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation de la commande' });
  }
});

app.put('/api/commandes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { client_id, date_commande, date_livraison_demandee, poids_grammes, calibre, qualite, maturite, prix_unitaire_kg, statut, notes } = req.body;
    
    // Convertir les valeurs vides en null pour les champs numÃ©riques
    const poidsGrammesVal = poids_grammes === '' || poids_grammes === null || poids_grammes === undefined ? null : poids_grammes;
    const prixUnitaireKgVal = prix_unitaire_kg === '' || prix_unitaire_kg === null || prix_unitaire_kg === undefined ? null : prix_unitaire_kg;
    
    // Calculer le montant total
    const montant_total = poidsGrammesVal && prixUnitaireKgVal 
      ? (parseFloat(poidsGrammesVal) / 1000) * parseFloat(prixUnitaireKgVal) 
      : null;
    
    const result = await pool.query(
      `UPDATE commandes SET client_id = $1, date_commande = $2, date_livraison_demandee = $3, 
       poids_grammes = $4, calibre = $5, qualite = $6, maturite = $7, prix_unitaire_kg = $8, 
       montant_total = $9, statut = $10, notes = $11
       WHERE id = $12 RETURNING *`,
      [client_id || null, date_commande, date_livraison_demandee || null, poidsGrammesVal, calibre || null, qualite || null, maturite || null, prixUnitaireKgVal, montant_total, statut, notes || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvee' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour de la commande' });
  }
});

app.delete('/api/commandes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM commandes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvee' });
    }
    res.json({ message: 'Commande supprimee' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Route pour crÃƒÂ©er une vente depuis une commande livrÃƒÂ©e
app.post('/api/commandes/:id/creer-vente', async (req, res) => {
  try {
    const { id } = req.params;
    
    // RÃƒÂ©cupÃƒÂ©rer la commande
    const commandeResult = await pool.query('SELECT * FROM commandes WHERE id = $1', [id]);
    if (commandeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvee' });
    }
    
    const commande = commandeResult.rows[0];
    
    // VÃƒÂ©rifier qu'une vente n'existe pas dÃƒÂ©jÃƒÂ  pour cette commande
    const venteExistante = await pool.query('SELECT id FROM ventes WHERE commande_id = $1', [id]);
    if (venteExistante.rows.length > 0) {
      return res.status(400).json({ error: 'Une vente existe deja pour cette commande' });
    }
    
    // GÃƒÂ©nÃƒÂ©rer un numÃƒÂ©ro de facture
    const year = new Date().getFullYear();
    const countResult = await pool.query('SELECT COUNT(*) FROM ventes WHERE numero_facture LIKE $1', [`FACT-${year}%`]);
    const count = parseInt(countResult.rows[0].count) + 1;
    const numero_facture = `FACT-${year}-${String(count).padStart(3, '0')}`;
    
    // CrÃƒÂ©er la vente
    const venteResult = await pool.query(
      `INSERT INTO ventes (client_id, commande_id, date_vente, quantite_grammes, prix_unitaire_kg, montant_total, mode_paiement, statut, numero_facture, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        commande.client_id,
        commande.id,
        new Date().toISOString().split('T')[0],
        commande.poids_grammes,
        commande.prix_unitaire_kg,
        commande.montant_total,
        '',
        'En attente',
        numero_facture,
        `Vente crÃƒÂ©ÃƒÂ©e depuis commande ${commande.numero_commande}`
      ]
    );
    
    res.status(201).json(venteResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la creation de la vente' });
  }
});

// ==================== ROUTES PARAMETRES GLOBAUX ====================
app.get('/api/parametres', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parametres ORDER BY cle');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des parametres' });
  }
});

app.get('/api/parametres/:cle', async (req, res) => {
  try {
    const { cle } = req.params;
    const result = await pool.query('SELECT * FROM parametres WHERE cle = $1', [cle]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parametre non trouve' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation du parametre' });
  }
});

app.put('/api/parametres/:cle', async (req, res) => {
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
    res.status(500).json({ error: 'Erreur lors de la mise a jour du parametre' });
  }
});

app.post('/api/parametres/reset', async (req, res) => {
  try {
    const defaults = {
      'colonnes_affichees_parcelles': '["nom", "surface_ha", "type_sol", "ph_sol", "exposition", "date_creation"]',
      'colonnes_affichees_arbres': '["numero", "espece", "variete_truffe", "parcelle_nom", "etat", "date_plantation", "circonference_cm"]',
      'colonnes_affichees_interventions': '["date_prevue", "type_nom", "parcelle_nom", "arbre_numero", "statut", "personnel", "cout"]',
      'colonnes_affichees_recoltes': '["date_recolte", "parcelle_nom", "arbre_numero", "poids_grammes", "qualite", "calibre", "caveur"]',
      'colonnes_affichees_clients': '["nom", "type", "email", "telephone", "ville"]',
      'colonnes_affichees_ventes': '["date_vente", "client_nom", "quantite_grammes", "prix_unitaire_kg", "montant_total", "statut"]',
      'colonnes_export_parcelles': '["nom", "surface_ha", "type_sol", "ph_sol", "exposition", "notes"]',
      'colonnes_export_arbres': '["numero", "espece", "variete_truffe", "parcelle_nom", "etat", "date_plantation", "circonference_cm", "hauteur_m", "notes"]',
      'colonnes_export_interventions': '["date_prevue", "date_realisee", "type_nom", "parcelle_nom", "arbre_numero", "statut", "personnel", "cout", "description", "notes"]',
      'colonnes_export_recoltes': '["date_recolte", "parcelle_nom", "arbre_numero", "poids_grammes", "qualite", "calibre", "maturite", "caveur", "chien", "notes"]',
      'colonnes_export_clients': '["nom", "prenom", "raison_sociale", "type", "email", "telephone", "adresse", "code_postal", "ville", "pays", "siret", "notes"]',
      'colonnes_export_ventes': '["date_vente", "numero_facture", "client_nom", "quantite_grammes", "prix_unitaire_kg", "montant_total", "mode_paiement", "statut", "notes"]'
    };
    
    for (const [cle, valeur] of Object.entries(defaults)) {
      await pool.query(
        'INSERT INTO parametres (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO UPDATE SET valeur = $2',
        [cle, valeur]
      );
    }
    
    res.json({ message: 'Parametres reinitialises' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la reinitialisation' });
  }
});

// ==================== ROUTES PREFERENCES UTILISATEUR ====================
app.get('/api/preferences-utilisateur', async (req, res) => {
  try {
    const userId = req.query.user_id || 'default';
    const result = await pool.query('SELECT * FROM preferences_utilisateur WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      const insertResult = await pool.query(
        'INSERT INTO preferences_utilisateur (user_id, colonnes_affichees, colonnes_export) VALUES ($1, $2, $3) RETURNING *',
        [userId, '{}', '{}']
      );
      return res.json(insertResult.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la recuperation des preferences' });
  }
});

app.put('/api/preferences-utilisateur', async (req, res) => {
  try {
    const userId = req.query.user_id || 'default';
    const { colonnes_affichees, colonnes_export } = req.body;
    
    const result = await pool.query(
      `INSERT INTO preferences_utilisateur (user_id, colonnes_affichees, colonnes_export) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id) DO UPDATE SET colonnes_affichees = $2, colonnes_export = $3 
       RETURNING *`,
      [userId, JSON.stringify(colonnes_affichees || {}), JSON.stringify(colonnes_export || {})]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise a jour des preferences' });
  }
});

app.post('/api/preferences-utilisateur/reset', async (req, res) => {
  try {
    const userId = req.query.user_id || 'default';
    const result = await pool.query(
      'UPDATE preferences_utilisateur SET colonnes_affichees = $1, colonnes_export = $2 WHERE user_id = $3 RETURNING *',
      ['{}', '{}', userId]
    );
    res.json(result.rows[0] || { message: 'Preferences reinitialisees' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la reinitialisation' });
  }
});

// ==================== ROUTES STATISTIQUES ====================
app.get('/api/stats/dashboard', async (req, res) => {
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
      SELECT COUNT(*) as count FROM interventions WHERE date_prevue >= CURRENT_DATE AND statut = 'PlanifiÃƒÂ©'
    `);
    
    const commandesEnCours = await pool.query(`
      SELECT COUNT(*) as count FROM commandes WHERE statut IN ('En attente', 'ConfirmÃƒÂ©e', 'En prÃƒÂ©paration')
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
    res.status(500).json({ error: 'Erreur lors de la recuperation des statistiques' });
  }
});

app.get('/api/stats/recoltes-annuelles', async (req, res) => {
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

app.get('/api/stats/recoltes-mensuelles', async (req, res) => {
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


// ==================== ROUTE DASHBOARD CONSOLIDÉE ====================
// Endpoint optimisé qui retourne TOUTES les données du dashboard en une seule requête
// Réduit le nombre d'appels API de 5-6 à 1 seul

app.get('/api/dashboard/full', async (req, res) => {
  try {
    // Exécuter toutes les requêtes en parallèle pour optimiser les performances
    const [
      // Stats de base
      parcellesStats,
      arbresCount,
      arbresParEtat,
      recoltesSaison,
      ventesMois,
      interventionsAVenir,
      commandesEnCours,
      
      // Alertes
      commandesEnAttente,
      ventesEnAttente,
      
      // Listes récentes
      dernieresRecoltes,
      prochainesInterventions,
      commandesRecentes,
      
      // Données graphiques
      productionMensuelle,
      productionParParcelle
    ] = await Promise.all([
      // === STATS DE BASE ===
      pool.query('SELECT COUNT(*) as count, COALESCE(SUM(surface_ha), 0) as surface FROM parcelles'),
      
      pool.query('SELECT COUNT(*) as count FROM arbres WHERE deleted_at IS NULL'),
      
      pool.query(`
        SELECT etat, COUNT(*) as count 
        FROM arbres 
        WHERE deleted_at IS NULL 
        GROUP BY etat
        ORDER BY CASE etat 
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
      
      // === ALERTES ===
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
      
      // === LISTES RÉCENTES ===
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
        LEFT JOIN types_intervention t ON i.type_id = t.id
        LEFT JOIN parcelles p ON i.parcelle_id = p.id
        LEFT JOIN arbres a ON i.arbre_id = a.id
        WHERE i.date_prevue >= CURRENT_DATE AND i.statut = 'Planifié'
        ORDER BY i.date_prevue ASC
        LIMIT 5
      `),
      
      pool.query(`
        SELECT c.id, c.numero_commande, c.date_commande, c.date_livraison_demandee,
               c.poids_grammes, c.montant_total, c.statut,
               cl.nom as client_nom
        FROM commandes c
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE c.statut NOT IN ('Annulée', 'Livrée')
        ORDER BY c.date_commande DESC
        LIMIT 5
      `),
      
      // === DONNÉES GRAPHIQUES ===
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
        SELECT p.nom as parcelle_nom, 
               COALESCE(SUM(r.poids_grammes), 0) as total_grammes
        FROM parcelles p
        LEFT JOIN recoltes r ON r.parcelle_id = p.id
        GROUP BY p.id, p.nom
        HAVING COALESCE(SUM(r.poids_grammes), 0) > 0
        ORDER BY total_grammes DESC
        LIMIT 10
      `)
    ]);

    // Construire la réponse consolidée
    const response = {
      // Statistiques principales (KPIs)
      stats: {
        parcelles: {
          count: parseInt(parcellesStats.rows[0].count),
          surface: parseFloat(parcellesStats.rows[0].surface) || 0
        },
        arbres: {
          count: parseInt(arbresCount.rows[0].count),
          parEtat: arbresParEtat.rows.map(row => ({
            etat: row.etat,
            count: parseInt(row.count)
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
      
      // Alertes prioritaires
      alertes: {
        commandesEnAttente: parseInt(commandesEnAttente.rows[0].count),
        ventesEnAttente: parseInt(ventesEnAttente.rows[0].count)
      },
      
      // Listes d'activités récentes
      activites: {
        dernieresRecoltes: dernieresRecoltes.rows,
        prochainesInterventions: prochainesInterventions.rows,
        commandesEnCours: commandesRecentes.rows
      },
      
      // Données pour les graphiques
      graphiques: {
        productionMensuelle: productionMensuelle.rows.map(row => ({
          mois: row.mois,
          totalGrammes: parseFloat(row.total_grammes) || 0,
          nombreRecoltes: parseInt(row.nombre_recoltes)
        })),
        productionParParcelle: productionParParcelle.rows.map(row => ({
          nom: row.parcelle_nom,
          totalGrammes: parseFloat(row.total_grammes) || 0
        }))
      },
      
      // Métadonnées
      meta: {
        generatedAt: new Date().toISOString(),
        periode: {
          recoltes: 'Saison en cours (depuis septembre)',
          ventes: 'Mois en cours',
          graphiqueMensuel: '12 derniers mois'
        }
      }
    };

    res.json(response);
    
  } catch (err) {
    console.error('Erreur endpoint /api/dashboard/full:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des données du dashboard',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Demarrer le serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur demarre sur le port ${PORT}`);
});
