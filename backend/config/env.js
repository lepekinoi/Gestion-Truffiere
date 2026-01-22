// ====================================================================
// config/env.js - Validation et configuration des variables d'environnement
// ====================================================================

const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET'
];

function validateEnv() {
  const missing = [];
  
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });
  
  if (missing.length > 0) {
    console.error('\u26a0\ufe0f Variables d\'environnement manquantes:', missing.join(', '));
    console.error('V\u00e9rifiez votre fichier .env');
    process.exit(1);
  }
  
  console.log('\u2705 Toutes les variables d\'environnement sont pr\u00e9sentes');
}

module.exports = {
  validateEnv,
  requiredEnvVars
};
