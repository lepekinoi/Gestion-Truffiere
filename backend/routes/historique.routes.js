// ====================================================================
// routes/historique.routes.js - Routes pour l'historique des modifications
// ====================================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireWriteAccess } = require('../middleware/auth');

// GET /api/historique - Récupérer l'historique avec filtres
router.get('/', async (req, res) => {
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
      query += ` AND h.timestamp >= ($${paramIndex}::date AT TIME ZONE 'Europe/Paris')`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND h.timestamp < (($${paramIndex}::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Paris')`;
      params.push(end_date);
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
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

// DELETE /api/historique/purge - Purger l'historique selon critères
router.delete('/purge', requireWriteAccess, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès admin requis' });
    }

    const { period, table_name, custom_date } = req.body;

    let deleteQuery = 'DELETE FROM historique WHERE 1=1';
    const params = [];
    let paramIndex = 1;

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

    if (table_name && table_name !== 'all') {
      deleteQuery += ` AND table_name = $${paramIndex}`;
      params.push(table_name);
      paramIndex++;
    }

    deleteQuery += ' RETURNING id';

    const result = await pool.query(deleteQuery, params);
    res.json({ message: 'Purge effectuée', deleted_count: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la purge' });
  }
});

// GET /api/historique/stats - Statistiques de l'historique
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name, action, COUNT(*) as count
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
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
