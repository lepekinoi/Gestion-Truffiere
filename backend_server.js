const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration de la base de données
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'truffiere',
  user: process.env.DB_USER || 'truffiere_user',
  password: process.env.DB_PASSWORD || 'truffiere_pass_2024',
});

// Test de connexion à la base de données
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Erreur de connexion à la base de données:', err.stack);
  } else {
    console.log('✅ Connecté à la base de données PostgreSQL');
    release();
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes de base
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'API Truffière fonctionnelle' });
});

// ==================== ROUTES PARCELLES ====================
app.get('/api/parcelles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parcelles ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des parcelles' });
  }
});

app.get('/api/parcelles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM parcelles WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/parcelles', async (req, res) => {
  try {
    const { nom, surface_ha, type_sol, ph_sol, exposition, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO parcelles (nom, surface_ha, type_sol, ph_sol, exposition, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nom, surface_ha, type_sol, ph_sol, exposition, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de la parcelle' });
  }
});

app.put('/api/parcelles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, surface_ha, type_sol, ph_sol, exposition, notes } = req.body;
    const result = await pool.query(
      'UPDATE parcelles SET nom = $1, surface_ha = $2, type_sol = $3, ph_sol = $4, exposition = $5, notes = $6 WHERE id = $7 RETURNING *',
      [nom, surface_ha, type_sol, ph_sol, exposition, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvée' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

app.delete('/api/parcelles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM parcelles WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcelle non trouvée' });
    }
    res.json({ message: 'Parcelle supprimée', parcelle: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ==================== ROUTES ARBRES ====================
app.get('/api/arbres', async (req, res) => {
  try {
    const { parcelle_id } = req.query;
    let query = `
      SELECT a.*, p.nom as parcelle_nom 
      FROM arbres a 
      LEFT JOIN parcelles p ON a.parcelle_id = p.id
    `;
    const params = [];
    
    if (parcelle_id) {
      query += ' WHERE a.parcelle_id = $1';
      params.push(parcelle_id);
    }
    
    query += ' ORDER BY a.numero';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des arbres' });
  }
});

app.post('/api/arbres', async (req, res) => {
  try {
    const { parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO arbres (parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [parcelle_id, numero, espece, variete_truffe, date_plantation, etat, circonference_cm, hauteur_m, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'arbre' });
  }
});

// ==================== ROUTES INTERVENTIONS ====================
app.get('/api/interventions', async (req, res) => {
  try {
    const { debut, fin } = req.query;
    let query = `
      SELECT i.*, 
             ti.nom as type_nom, ti.couleur as type_couleur,
             p.nom as parcelle_nom,
             a.numero as arbre_numero
      FROM interventions i
      LEFT JOIN types_intervention ti ON i.type_intervention_id = ti.id
      LEFT JOIN parcelles p ON i.parcelle_id = p.id
      LEFT JOIN arbres a ON i.arbre_id = a.id
    `;
    const params = [];
    
    if (debut && fin) {
      query += ' WHERE i.date_prevue BETWEEN $1 AND $2';
      params.push(debut, fin);
    }
    
    query += ' ORDER BY i.date_prevue DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des interventions' });
  }
});

app.post('/api/interventions', async (req, res) => {
  try {
    const { type_intervention_id, parcelle_id, arbre_id, date_prevue, description, cout, statut, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO interventions (type_intervention_id, parcelle_id, arbre_id, date_prevue, description, cout, statut, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [type_intervention_id, parcelle_id, arbre_id, date_prevue, description, cout, statut || 'Planifié', notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'intervention' });
  }
});

app.get('/api/types-intervention', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM types_intervention ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ROUTES RECOLTES ====================
app.get('/api/recoltes', async (req, res) => {
  try {
    const { annee } = req.query;
    let query = `
      SELECT r.*, 
             p.nom as parcelle_nom,
             a.numero as arbre_numero
      FROM recoltes r
      LEFT JOIN parcelles p ON r.parcelle_id = p.id
      LEFT JOIN arbres a ON r.arbre_id = a.id
    `;
    const params = [];
    
    if (annee) {
      query += ' WHERE EXTRACT(YEAR FROM r.date_recolte) = $1';
      params.push(annee);
    }
    
    query += ' ORDER BY r.date_recolte DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la récupération des récoltes' });
  }
});

app.post('/api/recoltes', async (req, res) => {
  try {
    const { parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, prix_kg, caveur, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO recoltes (parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, prix_kg, caveur, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [parcelle_id, arbre_id, date_recolte, poids_grammes, qualite, calibre, maturite, prix_kg, caveur, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la récolte' });
  }
});

// ==================== ROUTES CLIENTS ====================
app.get('/api/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO clients (type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [type, nom, prenom, raison_sociale, email, telephone, adresse, code_postal, ville, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création du client' });
  }
});

// ==================== ROUTES VENTES ====================
app.get('/api/ventes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, 
             c.nom as client_nom, c.prenom as client_prenom,
             r.date_recolte, r.qualite
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN recoltes r ON v.recolte_id = r.id
      ORDER BY v.date_vente DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/ventes', async (req, res) => {
  try {
    const { client_id, recolte_id, date_vente, quantite_grammes, prix_unitaire_kg, mode_paiement, notes } = req.body;
    const montant_total = (quantite_grammes / 1000) * prix_unitaire_kg;
    
    const result = await pool.query(
      `INSERT INTO ventes (client_id, recolte_id, date_vente, quantite_grammes, prix_unitaire_kg, montant_total, mode_paiement, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [client_id, recolte_id, date_vente, quantite_grammes, prix_unitaire_kg, montant_total, mode_paiement, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création de la vente' });
  }
});

// ==================== ROUTES STATISTIQUES ====================
app.get('/api/stats/production-parcelle', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stats_production_parcelle');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/stats/production-arbre', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stats_production_arbre');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/stats/ventes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stats_ventes ORDER BY annee DESC, mois DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ROUTES HISTORIQUE ====================
app.get('/api/historique', async (req, res) => {
  try {
    const { table_name, record_id, limit = 50 } = req.query;
    let query = 'SELECT * FROM historique';
    const params = [];
    const conditions = [];
    
    if (table_name) {
      conditions.push(`table_name = $${params.length + 1}`);
      params.push(table_name);
    }
    
    if (record_id) {
      conditions.push(`record_id = $${params.length + 1}`);
      params.push(record_id);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📍 API disponible sur http://localhost:${PORT}/api`);
});