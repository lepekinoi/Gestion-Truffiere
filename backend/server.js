// ==================== ROUTES STATISTIQUES ====================
app.get('/api/stats/dashboard', async (req, res) => {
  try {
    const parcelles = await pool.query('SELECT COUNT(*) as count, SUM(surface_ha) as surface FROM parcelles');
    const arbres = await pool.query('SELECT COUNT(*) as count FROM arbres WHERE deleted_at IS NULL');
    const arbresParEtat = await pool.query('SELECT etat_sanitaire as etat, COUNT(*) as count FROM arbres WHERE deleted_at IS NULL GROUP BY etat_sanitaire');
    
    const recoltesSaison = await pool.query(`
      SELECT SUM(poids_grammes) as total_grammes, COUNT(*) as count
      FROM recoltes WHERE date_recolte >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '3 months'
    `);
    
    const ventesMois = await pool.query(`
      SELECT SUM(montant_total) as chiffre_affaires, COUNT(*) as count
      FROM ventes WHERE date_vente >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    
    const interventionsAVenir = await pool.query(`
      SELECT COUNT(*) as count FROM interventions WHERE date_prevue >= CURRENT_DATE AND statut = 'Planifié'
    `);
    
    const commandesEnCours = await pool.query(`
      SELECT COUNT(*) as count FROM commandes WHERE statut IN ('En attente', 'Confirmée', 'En préparation')
    `);

    res.json({
      parcelles: { count: parseInt(parcelles.rows[0].count), surface: parseFloat(parcelles.rows[0].surface) || 0 },
      arbres: { count: parseInt(arbres.rows[0].count), parEtat: arbresParEtat.rows },
      recoltes: { totalGrammes: parseFloat(recoltesSaison.rows[0].total_grammes) || 0, count: parseInt(recoltesSaison.rows[0].count) },
      ventes: { chiffreAffaires: parseFloat(ventesMois.rows[0].chiffre_affaires) || 0, count: parseInt(ventesMois.rows[0].count) },
      interventions: { aVenir: parseInt(interventionsAVenir.rows[0].count) },
      commandes: { enCours: parseInt(commandesEnCours.rows[0].count) }
    });
  } catch (err) {
    console.error('Erreur stats dashboard:', err);
    res.status(500).json({ error: 'Erreur', details: err.message });
  }
});