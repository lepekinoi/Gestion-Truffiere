// ====================================================================
// routes/referentiels.routes.js - Routes pour les données de référence
// ====================================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireWriteAccess } = require('../middleware/auth');

// ==================== ROUTES CAVEURS ====================

// GET /api/caveurs - Liste des caveurs
router.get('/caveurs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM caveurs ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des caveurs' });
  }
});

// POST /api/caveurs - Créer un caveur
router.post('/caveurs', requireWriteAccess, async (req, res) => {
  try {
    const { nom } = req.body;
    const result = await pool.query('INSERT INTO caveurs (nom) VALUES ($1) RETURNING *', [nom]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création du caveur' });
  }
});

// PUT /api/caveurs/:id - Modifier un caveur
router.put('/caveurs/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { nom } = req.body;
    const result = await pool.query('UPDATE caveurs SET nom = $1 WHERE id = $2 RETURNING *', [nom, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caveur non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// DELETE /api/caveurs/:id - Supprimer un caveur
router.delete('/caveurs/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM caveurs WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caveur non trouvé' });
    }
    res.json({ message: 'Caveur supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES CHIENS ====================

// GET /api/chiens - Liste des chiens
router.get('/chiens', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM chiens ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des chiens' });
  }
});

// POST /api/chiens - Créer un chien
router.post('/chiens', requireWriteAccess, async (req, res) => {
  try {
    const { nom, race } = req.body;
    const result = await pool.query(
      'INSERT INTO chiens (nom, race) VALUES ($1, $2) RETURNING *',
      [nom, race || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création du chien' });
  }
});

// PUT /api/chiens/:id - Modifier un chien
router.put('/chiens/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, race } = req.body;
    const result = await pool.query(
      'UPDATE chiens SET nom = $1, race = $2 WHERE id = $3 RETURNING *',
      [nom, race || null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chien non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// DELETE /api/chiens/:id - Supprimer un chien
router.delete('/chiens/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM chiens WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chien non trouvé' });
    }
    res.json({ message: 'Chien supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES TYPES INTERVENTION ====================

// GET /api/types-intervention - Liste des types d'intervention
router.get('/types-intervention', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM types_intervention ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
