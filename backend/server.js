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
    res.status(500).json({ error: 'Erreur lors de la récupération des arbres' });
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
    res.status(500).json({ error: 'Erreur' });
  }
});

app.post('/api/arbres', requireWriteAccess, async (req, res) => {
  try {
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, latitude, longitude, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO arbres (parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, latitude, longitude, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        emptyToNull(parcelle_id),
        numero,
        espece,
        emptyToNull(variete_truffe),
        emptyToNull(date_plantation),
        etat || 'Bon',
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
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, date_derniere_taille, latitude, longitude, notes } = req.body;
    const result = await pool.query(
      `UPDATE arbres SET parcelle_id = $1, numero = $2, espece = $3, variete_truffe = $4, 
       date_plantation = $5, etat = $6, circonference_cm = $7, hauteur_m = $8, 
       date_derniere_taille = $9, latitude = $10, longitude = $11, notes = $12
       WHERE id = $13 AND deleted_at IS NULL RETURNING *`,
      [
        emptyToNull(parcelle_id),
        numero,
        espece,
        emptyToNull(variete_truffe),
        emptyToNull(date_plantation),
        etat || 'Bon',
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
    res.status(500).json({ error: 'Erreur lors de la mise Ã  jour', details: err.message });
  }
});

// Routes corbeille (spécifiques) AVANT la route générique /:id
app.post('/api/arbres/corbeille/:id/restaurer', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE arbres SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé dans la corbeille' });
    }
    res.json({ message: 'Arbre restauré', arbre: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.delete('/api/arbres/corbeille/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM arbres WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé dans la corbeille' });
    }
    res.json({ message: 'Arbre supprimé définitivement', arbre: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

app.delete('/api/arbres/corbeille', requireWriteAccess, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Récupérer les IDs des arbres à supprimer
    const treesToDelete = await client.query(
      'SELECT id FROM arbres WHERE deleted_at IS NOT NULL'
    );
    const treeIds = treesToDelete.rows.map(row => row.id);
    
    if (treeIds.length === 0) {
      await client.query('COMMIT');
      return res.json({ message: 'Corbeille vide', count: 0 });
    }
    
    // Supprimer les références en cascade
    await client.query('DELETE FROM interventions WHERE arbre_id = ANY($1)', [treeIds]);
    await client.query('DELETE FROM recoltes WHERE arbre_id = ANY($1)', [treeIds]);
    
    // Enfin, supprimer les arbres
    const result = await client.query('DELETE FROM arbres WHERE deleted_at IS NOT NULL RETURNING id');
    
    await client.query('COMMIT');
    res.json({ message: 'Corbeille vidée', count: result.rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erreur lors du vidage de la corbeille', details: err.message });
  } finally {
    client.release();
  }
});

// Route générique APRÈS les routes /corbeille
app.delete('/api/arbres/:id', requireWriteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE arbres SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Arbre non trouvé' });
    }
    res.json({ message: 'Arbre mis Ã  la corbeille', arbre: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});
