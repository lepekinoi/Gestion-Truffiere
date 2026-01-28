// backend/routes/preferences.routes.js
const express = require('express');

module.exports = (pool, requireWriteAccess) => {
  const router = express.Router();

  // GET /api/preferences-utilisateur - Récupérer les préférences
  router.get('/', async (req, res) => {
    try {
      const userId = req.user?.id || req.query.user_id || 'default';
      const result = await pool.query(
        'SELECT * FROM preferences_utilisateur WHERE user_id = $1', 
        [userId.toString()]
      );
      
      if (result.rows.length === 0) {
        const insertResult = await pool.query(
          `INSERT INTO preferences_utilisateur (user_id, colonnes_affichees, colonnes_export) 
           VALUES ($1, $2, $3) 
           RETURNING *`,
          [userId.toString(), '{}', '{}']
        );
        return res.json(insertResult.rows[0]);
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erreur récupération préférences:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la récupération des préférences',
        code: 'GET_PREFERENCES_ERROR'
      });
    }
  });

  // PUT /api/preferences-utilisateur - Mettre à jour les préférences
  router.put('/', requireWriteAccess, async (req, res) => {
    try {
      const userId = req.user?.id || req.query.user_id || 'default';
      const { colonnes_affichees, colonnes_export } = req.body;
      
      const result = await pool.query(
        `INSERT INTO preferences_utilisateur (user_id, colonnes_affichees, colonnes_export) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (user_id) 
         DO UPDATE SET colonnes_affichees = $2, colonnes_export = $3 
         RETURNING *`,
        [
          userId.toString(), 
          JSON.stringify(colonnes_affichees || {}), 
          JSON.stringify(colonnes_export || {})
        ]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Erreur mise à jour préférences:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour des préférences',
        code: 'UPDATE_PREFERENCES_ERROR'
      });
    }
  });

  // POST /api/preferences-utilisateur/reset - Réinitialiser les préférences
  router.post('/reset', requireWriteAccess, async (req, res) => {
    try {
      const userId = req.user?.id || req.query.user_id || 'default';
      const result = await pool.query(
        `UPDATE preferences_utilisateur 
         SET colonnes_affichees = $1, colonnes_export = $2 
         WHERE user_id = $3 
         RETURNING *`,
        ['{}', '{}', userId.toString()]
      );
      res.json(result.rows[0] || { message: 'Préférences réinitialisées' });
    } catch (err) {
      console.error('Erreur reset préférences:', err);
      res.status(500).json({ 
        error: 'Erreur lors de la réinitialisation des préférences',
        code: 'RESET_PREFERENCES_ERROR'
      });
    }
  });

  return router;
};
