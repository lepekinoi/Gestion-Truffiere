// ====================================================================
// routes/recoltes.routes.js - Routes pour la gestion des récoltes
// ====================================================================

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// GET /api/recoltes - Liste des récoltes
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, 
        p.nom as parcelle_nom, 
        a.numero as arbre_numero
      FROM recoltes r
      LEFT JOIN parcelles p ON r.parcelle_id = p.id
      LEFT JOIN arbres a ON r.arbre_id = a.id
      ORDER BY r.date_recolte DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// POST /api/recoltes - Créer une récolte
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      parcelle_id, arbre_id, date_recolte, poids_grammes, qualite,
      calibre, maturite, profondeur_cm, exposition, conditions_meteo,
      temperature_sol, caveur, chien, notes
    } = req.body;

    const result = await pool.query(
      `INSERT INTO recoltes 
       (parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, 
        maturite, profondeur_cm, exposition, conditions_meteo, temperature_sol, 
        caveur, chien, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        parcelle_id || null,
        arbre_id || null,
        date_recolte,
        poids_grammes,
        qualite || null,
        calibre || null,
        maturite || null,
        profondeur_cm || null,
        exposition || null,
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
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/recoltes/:id - Modifier une récolte
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      parcelle_id, arbre_id, date_recolte, poids_grammes, qualite,
      calibre, maturite, profondeur_cm, exposition, conditions_meteo,
      temperature_sol, caveur, chien, notes
    } = req.body;

    const result = await pool.query(
      `UPDATE recoltes SET
       parcelle_id = $1, arbre_id = $2, date_recolte = $3, poids_grammes = $4,
       qualite = $5, calibre = $6, maturite = $7, profondeur_cm = $8,
       exposition = $9, conditions_meteo = $10, temperature_sol = $11,
       caveur = $12, chien = $13, notes = $14
       WHERE id = $15
       RETURNING *`,
      [
        parcelle_id || null,
        arbre_id || null,
        date_recolte,
        poids_grammes,
        qualite || null,
        calibre || null,
        maturite || null,
        profondeur_cm || null,
        exposition || null,
        conditions_meteo || null,
        temperature_sol || null,
        caveur || null,
        chien || null,
        notes || null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Récolte non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// DELETE /api/recoltes/:id - Supprimer une récolte
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM recoltes WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Récolte non trouvée' });
    }
    res.json({ message: 'Récolte supprimée', recolte: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
