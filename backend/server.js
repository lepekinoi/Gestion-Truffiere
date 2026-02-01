// ============================================================
// server.js - API Truffière avec Authentification JWT
// Version 2.0.2 - Ajout gestion Fournisseurs & Achats
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
    version: '2.0.2',
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
}, especesRoutes(pool));

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

// Fournisseurs & Achats (NOUVEAU)
const fournisseursRoutes = require('./routes/fournisseurs');
app.use('/api/fournisseurs', (req, res, next) => {
  req.pool = pool;
  next();
}, fournisseursRoutes);

// ============================================================
// ROUTES RECHERCHE GLOBALE (le reste du fichier reste inchangé)
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

    // ... (autres recherches inchangées)

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

// Routes factures et gestion erreurs inchangées...

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