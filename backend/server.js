app.post('/api/arbres', requireWriteAccess, async (req, res) => {
  try {
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, porte_greffe, rendement_estimé, circonference_cm, hauteur_m, latitude, longitude, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO arbres (parcelle_id, numero, espece, variete_truffe, date_plantation, porte_greffe, rendement_estimé, circonference_cm, hauteur_m, latitude, longitude, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        emptyToNull(parcelle_id),
        numero,
        espece,
        emptyToNull(variete_truffe),
        emptyToNull(date_plantation),
        emptyToNull(porte_greffe),
        emptyToNull(rendement_estimé),
        emptyToNull(circonference_cm),
        emptyToNull(hauteur_m),
        emptyToNull(latitude),
        emptyToNull(longitude),
        emptyToNull(notes)
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur création arbre:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'arbre', details: err.message });
  }
});

app.put('/api/arbres/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, porte_greffe, rendement_estimé, circonference_cm, hauteur_m, date_derniere_taille, latitude, longitude, notes } = req.body;
    const result = await pool.query(
      `UPDATE arbres SET parcelle_id = $1, numero = $2, espece = $3, variete_truffe = $4, 
       date_plantation = $5, porte_greffe = $6, rendement_estimé = $7, circonference_cm = $8, hauteur_m = $9, 
       date_derniere_taille = $10, latitude = $11, longitude = $12, notes = $13
       WHERE id = $14 AND deleted_at IS NULL RETURNING *`,
      [
        emptyToNull(parcelle_id),
        numero,
        espece,
        emptyToNull(variete_truffe),
        emptyToNull(date_plantation),
        emptyToNull(porte_greffe),
        emptyToNull(rendement_estimé),
        emptyToNull(circonference_cm),
        emptyToNull(hauteur_m),
        emptyToNull(date_derniere_taille),
        emptyToNull(latitude),
        emptyToNull(longitude),
        emptyToNull(notes),
        id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur modification arbre:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour', details: err.message });
  }
});

// Routes corbeille (spécifiques) AVANT la route générique /:id
app.post('/api/arbres/corbeille/:id/restaurer', requireWriteAccess, async (req, res) => {