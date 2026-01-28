// ============================================================
// server.js - API Truffière avec Authentification JWT
// Version 2.0.1 - Architecture refactorée et centralisée
// ============================================================

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

// ============================================================
// CONFIGURATION
// ============================================================

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant !');
  process.exit(1);
}

// Configuration base de données
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Vérifications de sécurité au démarrage
const requiredEnvVars = ['JWT_SECRET', 'DB_PASSWORD', 'DB_USER', 'DB_NAME'];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`❌ Variable d'environnement manquante : ${varName}`);
    process.exit(1);
  }
}

// ============================================================
// TEST DE CONNEXION À LA BASE DE DONNÉES
// ============================================================

const testDatabaseConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connexion à la base de données PostgreSQL réussie');
    console.log(`📦 Base: ${process.env.DB_NAME} | Hôte: ${process.env.DB_HOST}`);
    
    const result = await client.query('SELECT NOW()');
    console.log('🕐 Heure serveur DB:', result.rows[0].now);
    
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Erreur de connexion à la base de données');
    console.error('Message:', err.message);
    console.error('Configuration:', {
      host: process.env.DB_HOST || 'NON DÉFINI',
      port: process.env.DB_PORT || 'NON DÉFINI',
      database: process.env.DB_NAME || 'NON DÉFINI',
      user: process.env.DB_USER || 'NON DÉFINI'
    });
    console.error('\n⚠️  Vérifiez vos variables d\'environnement et que PostgreSQL est démarré\n');
    return false;
  }
};

// Tester la connexion avant de démarrer le serveur
testDatabaseConnection().then((connected) => {
  if (!connected) {
    console.error('❌ Impossible de démarrer le serveur sans connexion DB');
    process.exit(1);
  }
  
  // ✅ Endpoint de santé pour Docker healthcheck
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  });

  // Démarrer le serveur seulement si la connexion DB fonctionne
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║  🚀 Serveur API Truffière démarré      ║`);
    console.log(`║  📡 Port: ${PORT.toString().padEnd(28)} ║`);
    console.log(`║  🌍 URL: http://localhost:${PORT}        ║`);
    console.log('╚════════════════════════════════════════╝\n');
  });
});

// ============================================================
// MIDDLEWARES GLOBAUX
// ============================================================

// Sécurité HTTP headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuré
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.CORS_ORIGINS || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Parser JSON et cookies
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Logging
app.use(morgan('dev'));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Trop de requêtes', code: 'RATE_LIMIT' }
});
app.use(globalLimiter);

// ============================================================
// IMPORTS CENTRALISÉS
// ============================================================

const { emptyToNull } = require('./utils');
const { authMiddleware, adminOnly } = require('./middleware/auth');

// ============================================================
// MIDDLEWARE DE VÉRIFICATION DES PERMISSIONS D'ÉCRITURE
// ============================================================

const requireWriteAccess = (req, res, next) => {
  if (req.user && req.user.role === 'readonly') {
    return res.status(403).json({ error: 'Accès en lecture seule', code: 'READONLY' });
  }
  next();
};

// ============================================================
// ROUTES PUBLIQUES
// ============================================================

// Health check API
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API Truffière fonctionnelle',
    version: '2.0.1',
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// ROUTES D'AUTHENTIFICATION (refactorées)
// ============================================================

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes(pool));

// ============================================================
// MIDDLEWARE D'AUTHENTIFICATION POUR ROUTES PROTÉGÉES
// ============================================================

// Toutes les routes /api/* suivantes nécessitent une authentification
app.use('/api', (req, res, next) => {
  // Skip les routes publiques
  if (req.path.startsWith('/auth') || req.path === '/health' || req.path.startsWith('/especes')) {
    return next();
  }
  authMiddleware(req, res, next);
});

// ============================================================
// ROUTES MÉTIER
// ============================================================

// Parcelles
const parcellesRoutes = require('./routes/parcelles.routes');
app.use('/api/parcelles', (req, res, next) => {
  req.pool = pool;
  next();
}, parcellesRoutes(pool, requireWriteAccess, emptyToNull));

// Arbres
const arbresRoutes = require('./routes/arbres.routes');
app.use('/api/arbres', (req, res, next) => {
  req.pool = pool;
  next();
}, arbresRoutes(pool, requireWriteAccess, emptyToNull));

// Caveurs
const caveursRoutes = require('./routes/caveurs.routes');
app.use('/api/caveurs', (req, res, next) => {
  req.pool = pool;
  next();
}, caveursRoutes(pool, requireWriteAccess));

// Chiens
const chiensRoutes = require('./routes/chiens.routes');
app.use('/api/chiens', (req, res, next) => {
  req.pool = pool;
  next();
}, chiensRoutes(pool, requireWriteAccess));

// Récoltes
const recoltesRoutes = require('./routes/recoltes.routes');
app.use('/api/recoltes', (req, res, next) => {
  req.pool = pool;
  next();
}, recoltesRoutes(pool, requireWriteAccess));

// Historique
const historiqueRoutes = require('./routes/historique.routes');
app.use('/api/historique', (req, res, next) => {
  req.pool = pool;
  next();
}, historiqueRoutes(pool, requireWriteAccess, adminOnly));

// Clients
const clientsRoutes = require('./routes/clients.routes');
app.use('/api/clients', (req, res, next) => {
  req.pool = pool;
  next();
}, clientsRoutes(pool, requireWriteAccess));

// Ventes
const ventesRoutes = require('./routes/ventes.routes');
app.use('/api/ventes', (req, res, next) => {
  req.pool = pool;
  next();
}, ventesRoutes(pool, requireWriteAccess));

// Commandes
const commandesRoutes = require('./routes/commandes.routes');
app.use('/api/commandes', (req, res, next) => {
  req.pool = pool;
  next();
}, commandesRoutes(pool, requireWriteAccess));

// Paramètres
const parametresRoutes = require('./routes/parametres.routes');
app.use('/api/parametres', (req, res, next) => {
  req.pool = pool;
  next();
}, parametresRoutes(pool, requireWriteAccess));

// Préférences utilisateur
const preferencesRoutes = require('./routes/preferences.routes');
app.use('/api/preferences-utilisateur', (req, res, next) => {
  req.pool = pool;
  next();
}, preferencesRoutes(pool, requireWriteAccess));

// Statistiques
const statsRoutes = require('./routes/stats.routes');
app.use('/api/stats', (req, res, next) => {
  req.pool = pool;
  next();
}, statsRoutes(pool));

// Dashboard
const dashboardRoutes = require('./routes/dashboard.routes');
app.use('/api/dashboard', (req, res, next) => {
  req.pool = pool;
  next();
}, dashboardRoutes(pool));

// Stock
const stockRoutes = require('./routes/stock.routes');
app.use('/api/stock', (req, res, next) => {
  req.pool = pool;
  next();
}, stockRoutes(pool));

// Espèces
const especesRoutes = require('./routes/especes.routes');
app.use('/api/especes', (req, res, next) => {
  req.pool = pool;
  next();
}, especesRoutes(pool)); // ✅ CORRIGÉ : Appel de la fonction avec pool

// Types d'intervention
const typesInterventionRoutes = require('./routes/types-intervention.routes');
app.use('/api/types-intervention', (req, res, next) => {
  req.pool = pool;
  next();
}, typesInterventionRoutes(pool));

// Interventions
const interventionsRoutes = require('./routes/interventions.routes');
app.use('/api/interventions', (req, res, next) => {
  req.pool = pool;
  next();
}, interventionsRoutes(pool, requireWriteAccess, emptyToNull));

// Produits phytosanitaires
const produitsPhytoRoutes = require('./routes/produits-phyto.routes');
app.use('/api/produits-phyto', (req, res, next) => {
  req.pool = pool;
  next();
}, produitsPhytoRoutes(pool, requireWriteAccess));

// Amendements référentiel
const amendementsRefRoutes = require('./routes/amendements-ref.routes');
app.use('/api/amendements-ref', (req, res, next) => {
  req.pool = pool;
  next();
}, amendementsRefRoutes(pool, requireWriteAccess));

// ============================================================
// ROUTES RECHERCHE GLOBALE
// ============================================================

app.get('/api/search/global', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q.toLowerCase()}%`;
    const results = [];

    // Recherche dans les parcelles
    try {
      const parcelles = await pool.query(`
        SELECT id, nom, surface_ha, type_sol
        FROM parcelles
        WHERE LOWER(COALESCE(nom, '')) LIKE $1 
           OR LOWER(COALESCE(type_sol, '')) LIKE $1 
           OR LOWER(COALESCE(notes, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (parcelles.rows.length > 0) {
        results.push({
          category: 'parcelles',
          items: parcelles.rows.map(p => ({
            id: p.id,
            title: p.nom,
            subtitle: `${p.surface_ha} ha - ${p.type_sol || 'Type non défini'}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche parcelles:', e.message);
    }

    // Recherche dans les arbres
    try {
      const arbres = await pool.query(`
        SELECT a.id, a.numero, a.espece, a.variete_truffe, a.etat_sanitaire, p.nom as parcelle_nom
        FROM arbres a
        LEFT JOIN parcelles p ON a.parcelle_id = p.id
        WHERE LOWER(COALESCE(a.numero, '')) LIKE $1 
           OR LOWER(COALESCE(a.espece, '')) LIKE $1 
           OR LOWER(COALESCE(a.variete_truffe, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (arbres.rows.length > 0) {
        results.push({
          category: 'arbres',
          items: arbres.rows.map(a => ({
            id: a.id,
            title: `${a.numero} - ${a.espece}`,
            subtitle: `${a.parcelle_nom || 'Sans parcelle'} - ${a.etat_sanitaire}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche arbres:', e.message);
    }

    // Recherche dans les récoltes
    try {
      const recoltes = await pool.query(`
        SELECT r.id, r.date_recolte, r.poids_grammes, r.qualite, r.calibre, 
               a.numero as arbre_numero, p.nom as parcelle_nom
        FROM recoltes r
        LEFT JOIN arbres a ON r.arbre_id = a.id
        LEFT JOIN parcelles p ON r.parcelle_id = p.id
        WHERE LOWER(COALESCE(r.qualite, '')) LIKE $1 
           OR LOWER(COALESCE(r.calibre, '')) LIKE $1 
           OR LOWER(COALESCE(r.caveur, '')) LIKE $1
           OR LOWER(COALESCE(p.nom, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (recoltes.rows.length > 0) {
        results.push({
          category: 'recoltes',
          items: recoltes.rows.map(r => ({
            id: r.id,
            title: `${new Date(r.date_recolte).toLocaleDateString('fr-FR')} - ${r.poids_grammes}g`,
            subtitle: `${r.qualite || 'Qualité NC'} - ${r.calibre || 'Calibre NC'} - ${r.parcelle_nom || ''}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche récoltes:', e.message);
    }

    // Recherche dans les clients
    try {
      const clients = await pool.query(`
        SELECT id, type, nom, prenom, raison_sociale, email, telephone, ville
        FROM clients
        WHERE LOWER(COALESCE(nom, '')) LIKE $1 
           OR LOWER(COALESCE(prenom, '')) LIKE $1 
           OR LOWER(COALESCE(raison_sociale, '')) LIKE $1
           OR LOWER(COALESCE(email, '')) LIKE $1 
           OR LOWER(COALESCE(telephone, '')) LIKE $1 
           OR LOWER(COALESCE(ville, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (clients.rows.length > 0) {
        results.push({
          category: 'clients',
          items: clients.rows.map(c => ({
            id: c.id,
            title: c.type === 'Professionnel' ? (c.raison_sociale || c.nom) : `${c.prenom || ''} ${c.nom}`.trim(),
            subtitle: `${c.type} - ${c.ville || 'Ville NC'} - ${c.email || ''}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche clients:', e.message);
    }

    // Recherche dans les ventes
    try {
      const ventes = await pool.query(`
        SELECT v.id, v.date_vente, v.quantite_grammes, v.montant_total, v.statut, v.numero_facture,
               c.nom as client_nom, c.prenom as client_prenom, c.raison_sociale as client_raison_sociale
        FROM ventes v
        LEFT JOIN clients c ON v.client_id = c.id
        WHERE LOWER(COALESCE(v.numero_facture, '')) LIKE $1 
           OR LOWER(COALESCE(v.statut, '')) LIKE $1
           OR LOWER(COALESCE(c.nom, '')) LIKE $1 
           OR LOWER(COALESCE(c.raison_sociale, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (ventes.rows.length > 0) {
        results.push({
          category: 'ventes',
          items: ventes.rows.map(v => ({
            id: v.id,
            title: `${v.numero_facture || 'Sans n°'} - ${v.montant_total}€`,
            subtitle: `${v.client_raison_sociale || `${v.client_prenom || ''} ${v.client_nom || ''}`.trim() || 'Client NC'} - ${v.statut}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche ventes:', e.message);
    }

    // Recherche dans les commandes
    try {
      const commandes = await pool.query(`
        SELECT co.id, co.numero_commande, co.date_commande, co.poids_grammes, co.statut,
               c.nom as client_nom, c.prenom as client_prenom, c.raison_sociale as client_raison_sociale
        FROM commandes co
        LEFT JOIN clients c ON co.client_id = c.id
        WHERE LOWER(COALESCE(co.numero_commande, '')) LIKE $1 
           OR LOWER(COALESCE(co.statut, '')) LIKE $1
           OR LOWER(COALESCE(c.nom, '')) LIKE $1 
           OR LOWER(COALESCE(c.raison_sociale, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (commandes.rows.length > 0) {
        results.push({
          category: 'commandes',
          items: commandes.rows.map(co => ({
            id: co.id,
            title: `${co.numero_commande || 'Sans n°'} - ${co.poids_grammes}g`,
            subtitle: `${co.client_raison_sociale || `${co.client_prenom || ''} ${co.client_nom || ''}`.trim() || 'Client NC'} - ${co.statut}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche commandes:', e.message);
    }

    // Recherche dans les interventions
    try {
      const interventions = await pool.query(`
        SELECT i.id, i.date_prevue, i.date_realisee, i.description, i.statut,
               t.nom as type_nom, p.nom as parcelle_nom
        FROM interventions i
        LEFT JOIN types_intervention t ON i.type_intervention_id = t.id
        LEFT JOIN parcelles p ON i.parcelle_id = p.id
        WHERE LOWER(COALESCE(t.nom, '')) LIKE $1 
           OR LOWER(COALESCE(i.description, '')) LIKE $1 
           OR LOWER(COALESCE(p.nom, '')) LIKE $1
           OR LOWER(COALESCE(i.personnel, '')) LIKE $1
        LIMIT 5
      `, [searchTerm]);
      
      if (interventions.rows.length > 0) {
        results.push({
          category: 'interventions',
          items: interventions.rows.map(i => ({
            id: i.id,
            title: `${i.type_nom || 'Intervention'} - ${new Date(i.date_prevue).toLocaleDateString('fr-FR')}`,
            subtitle: `${i.parcelle_nom || 'Sans parcelle'} - ${i.statut || ''}`
          }))
        });
      }
    } catch (e) {
      console.error('Erreur recherche interventions:', e.message);
    }

    res.json(results);
  } catch (err) {
    console.error('Erreur recherche globale:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la recherche', 
      code: 'SEARCH_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ============================================================
// ROUTES FACTURES PDF
// ============================================================

// Récupérer les données pour générer une facture
app.get('/api/factures/:venteId', async (req, res) => {
  try {
    const { venteId } = req.params;

    const vente = await pool.query(`
      SELECT 
        v.*,
        c.type as client_type,
        c.nom as client_nom,
        c.prenom as client_prenom,
        c.raison_sociale as client_raison_sociale,
        c.email as client_email,
        c.telephone as client_telephone,
        c.adresse as client_adresse,
        c.code_postal as client_code_postal,
        c.ville as client_ville,
        c.pays as client_pays,
        c.siret as client_siret,
        r.date_recolte,
        r.qualite as recolte_qualite,
        r.calibre as recolte_calibre,
        r.maturite as recolte_maturite,
        p.nom as parcelle_nom
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN recoltes r ON v.recolte_id = r.id
      LEFT JOIN parcelles p ON r.parcelle_id = p.id
      WHERE v.id = $1
    `, [venteId]);

    if (vente.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Vente non trouvée',
        code: 'VENTE_NOT_FOUND'
      });
    }

    // Récupérer les paramètres de l'entreprise
    const parametres = await pool.query(`
      SELECT cle, valeur FROM parametres 
      WHERE cle IN ('entreprise_nom', 'entreprise_adresse', 'entreprise_code_postal', 
                    'entreprise_ville', 'entreprise_telephone', 'entreprise_email',
                    'entreprise_siret', 'entreprise_tva', 'facture_mentions_legales',
                    'facture_conditions_paiement', 'facture_iban', 'facture_bic')
    `);

    const params = {};
    parametres.rows.forEach(p => {
      params[p.cle] = p.valeur;
    });

    const venteData = vente.rows[0];
    
    // Générer le numéro de facture si non existant
    let numeroFacture = venteData.numero_facture;
    if (!numeroFacture) {
      const year = new Date(venteData.date_vente).getFullYear();
      const countResult = await pool.query(`
        SELECT COUNT(*) as count FROM ventes 
        WHERE EXTRACT(YEAR FROM date_vente) = $1 AND numero_facture IS NOT NULL
      `, [year]);
      const count = parseInt(countResult.rows[0].count) + 1;
      numeroFacture = `FAC-${year}-${String(count).padStart(4, '0')}`;
      
      await pool.query(`UPDATE ventes SET numero_facture = $1 WHERE id = $2`, [numeroFacture, venteId]);
    }

    res.json({
      facture: {
        numero: numeroFacture,
        date_emission: new Date().toISOString(),
        date_vente: venteData.date_vente,
        quantite_grammes: venteData.quantite_grammes,
        prix_unitaire_kg: venteData.prix_unitaire_kg,
        montant_ht: venteData.montant_total,
        tva_taux: 5.5,
        tva_montant: venteData.montant_total * 0.055,
        montant_ttc: venteData.montant_total * 1.055,
        mode_paiement: venteData.mode_paiement,
        statut: venteData.statut,
        notes: venteData.notes
      },
      client: {
        type: venteData.client_type,
        nom: venteData.client_nom,
        prenom: venteData.client_prenom,
        raison_sociale: venteData.client_raison_sociale,
        email: venteData.client_email,
        telephone: venteData.client_telephone,
        adresse: venteData.client_adresse,
        code_postal: venteData.client_code_postal,
        ville: venteData.client_ville,
        pays: venteData.client_pays,
        siret: venteData.client_siret
      },
      produit: {
        description: 'Truffes fraîches',
        qualite: venteData.recolte_qualite,
        calibre: venteData.recolte_calibre,
        maturite: venteData.recolte_maturite,
        date_recolte: venteData.date_recolte,
        parcelle: venteData.parcelle_nom
      },
      entreprise: {
        nom: params.entreprise_nom || 'Truffière',
        adresse: params.entreprise_adresse || '',
        code_postal: params.entreprise_code_postal || '',
        ville: params.entreprise_ville || '',
        telephone: params.entreprise_telephone || '',
        email: params.entreprise_email || '',
        siret: params.entreprise_siret || '',
        tva_intra: params.entreprise_tva || '',
        iban: params.facture_iban || '',
        bic: params.facture_bic || '',
        mentions_legales: params.facture_mentions_legales || '',
        conditions_paiement: params.facture_conditions_paiement || 'Paiement à réception'
      }
    });
  } catch (err) {
    console.error('Erreur récupération facture:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des données de facture',
      code: 'FACTURE_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Générer un numéro de facture
app.post('/api/factures/generer-numero', requireWriteAccess, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM ventes 
      WHERE EXTRACT(YEAR FROM date_vente) = $1 AND numero_facture IS NOT NULL
    `, [year]);
    const count = parseInt(countResult.rows[0].count) + 1;
    const numeroFacture = `FAC-${year}-${String(count).padStart(4, '0')}`;
    
    res.json({ numero_facture: numeroFacture });
  } catch (err) {
    console.error('Erreur génération numéro facture:', err);
    res.status(500).json({ 
      error: 'Erreur lors de la génération du numéro de facture',
      code: 'FACTURE_NUMERO_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ============================================================
// GESTION DES ERREURS
// ============================================================

// Middleware 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée', 
    code: 'NOT_FOUND', 
    path: req.path 
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', {
    message: err.message, 
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined, 
    route: req.path, 
    user: req.user?.id, 
    ip: req.ip 
  });
  
  if (err.message === 'Non autorisé par CORS') {
    return res.status(403).json({ 
      error: 'Origine non autorisée', 
      code: 'CORS_ERROR' 
    });
  }
  
  // Erreurs PostgreSQL courantes
  if (err.code === '23505') {
    return res.status(409).json({ 
      error: 'Conflit : doublon détecté', 
      code: 'UNIQUE_VIOLATION' 
    });
  }
  
  res.status(500).json({ 
    error: 'Erreur interne', 
    code: 'INTERNAL_ERROR', 
    details: process.env.NODE_ENV === 'development' ? err.message : undefined 
  }); 
});

module.exports = app;
