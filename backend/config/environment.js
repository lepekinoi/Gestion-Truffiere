// ============================================================
// environment.js - Validation des variables d'environnement
// ============================================================

require('dotenv').config();

/**
 * Liste des variables d'environnement OBLIGATOIRES
 */
const requiredEnvVars = [
  'JWT_SECRET',
  'DB_PASSWORD',
  'DB_USER',
  'DB_NAME',
  'DB_HOST'
];

/**
 * Liste des variables d'environnement RECOMMANDÉES
 */
const recommendedEnvVars = [
  'CORS_ORIGINS',
  'NODE_ENV',
  'PORT',
  'DB_PORT',
  'JWT_EXPIRES_IN',
  'REFRESH_TOKEN_EXPIRES_DAYS',
  'BCRYPT_ROUNDS'
];

/**
 * Valide la présence des variables d'environnement obligatoires
 * @throws {Error} Si une variable obligatoire est manquante
 */
const validateEnvironment = () => {
  console.log('\n🔍 Validation des variables d\'environnement...');
  
  const missing = [];
  const warnings = [];

  // Vérifier les variables OBLIGATOIRES
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Vérifier les variables RECOMMANDÉES
  for (const varName of recommendedEnvVars) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  // Si variables manquantes : ERREUR CRITIQUE
  if (missing.length > 0) {
    console.error('\n❌ ERREUR : Variables d\'environnement obligatoires manquantes :');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\n📄 Créez un fichier .env à la racine de backend/ avec ces variables.');
    console.error('📋 Exemple : cp .env.example .env\n');
    process.exit(1);
  }

  // Si variables recommandées manquantes : AVERTISSEMENT
  if (warnings.length > 0) {
    console.warn('\n⚠️  Variables d\'environnement recommandées manquantes (valeurs par défaut utilisées) :');
    warnings.forEach(v => console.warn(`   - ${v}`));
  }

  console.log('\n✅ Variables d\'environnement validées avec succès\n');
};

/**
 * Récupère une variable d'environnement avec valeur par défaut
 * @param {string} key - Nom de la variable
 * @param {*} defaultValue - Valeur par défaut
 * @returns {string} Valeur de la variable ou défaut
 */
const getEnv = (key, defaultValue = null) => {
  return process.env[key] || defaultValue;
};

/**
 * Récupère une variable d'environnement numérique
 * @param {string} key - Nom de la variable
 * @param {number} defaultValue - Valeur par défaut
 * @returns {number} Valeur numérique
 */
const getEnvNumber = (key, defaultValue = 0) => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

/**
 * Récupère une variable d'environnement booléenne
 * @param {string} key - Nom de la variable
 * @param {boolean} defaultValue - Valeur par défaut
 * @returns {boolean} Valeur booléenne
 */
const getEnvBoolean = (key, defaultValue = false) => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
};

/**
 * Affiche les variables d'environnement (masquées)
 */
const displayEnvironment = () => {
  console.log('📦 Configuration environnement :');
  console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   - PORT: ${process.env.PORT || 3001}`);
  console.log(`   - DB_HOST: ${process.env.DB_HOST}`);
  console.log(`   - DB_NAME: ${process.env.DB_NAME}`);
  console.log(`   - DB_USER: ${process.env.DB_USER}`);
  console.log(`   - JWT_SECRET: ${process.env.JWT_SECRET ? '*****' + process.env.JWT_SECRET.slice(-4) : 'NON DÉFINI'}`);
  console.log(`   - CORS_ORIGINS: ${process.env.CORS_ORIGINS || 'Toutes les origines (dev)'}`);
};

module.exports = {
  validateEnvironment,
  getEnv,
  getEnvNumber,
  getEnvBoolean,
  displayEnvironment
};
