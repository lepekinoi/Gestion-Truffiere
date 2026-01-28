// ============================================================
// database.js - Configuration PostgreSQL Pool
// ============================================================

const { Pool } = require('pg');
require('dotenv').config();

// Configuration du pool de connexions PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Configuration avancée du pool
  max: 20,                      // Nombre max de connexions
  idleTimeoutMillis: 30000,     // Timeout inactivité (30s)
  connectionTimeoutMillis: 2000, // Timeout connexion (2s)
});

/**
 * Teste la connexion à la base de données
 * @returns {Promise<boolean>} true si connecté, false sinon
 */
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connexion à la base de données PostgreSQL réussie');
    console.log(`📦 Base: ${process.env.DB_NAME} | Hôte: ${process.env.DB_HOST}`);
    
    // Test simple de requête
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

/**
 * Ferme proprement le pool de connexions
 */
const closePool = async () => {
  try {
    await pool.end();
    console.log('✅ Pool de connexions fermé');
  } catch (err) {
    console.error('❌ Erreur fermeture pool:', err.message);
  }
};

// Gestion de la fermeture propre en cas d'arrêt
process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

module.exports = { 
  pool, 
  testConnection,
  closePool
};
