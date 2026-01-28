// ============================================================
// jwt.js - Configuration JWT
// ============================================================

require('dotenv').config();

// Vérification critique : JWT_SECRET doit être défini
if (!process.env.JWT_SECRET) {
  console.error('❌ ERREUR CRITIQUE : JWT_SECRET manquant dans .env !');
  console.error('⚠️  Générez un secret sécurisé avec : node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

// Configuration JWT
const jwtConfig = {
  /**
   * Secret pour signer les tokens JWT
   * CRITIQUE : Doit être une chaîne aléatoire sécurisée de 64+ caractères
   */
  JWT_SECRET: process.env.JWT_SECRET,

  /**
   * Durée de validité des access tokens
   * Format : '15m', '1h', '7d'
   * Défaut : 15 minutes (sécurité optimale)
   */
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',

  /**
   * Durée de validité des refresh tokens (en jours)
   * Défaut : 7 jours
   */
  REFRESH_TOKEN_EXPIRES_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 7,

  /**
   * Nombre de rounds pour bcrypt (hashing mots de passe)
   * Plus élevé = plus sécurisé mais plus lent
   * Défaut : 12 (recommandé)
   */
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
};

// Log de configuration (masquer le secret)
console.log('⚙️  Configuration JWT chargée :');
console.log(`   - JWT_SECRET: ${jwtConfig.JWT_SECRET.substring(0, 10)}... (✅ défini)`);
console.log(`   - JWT_EXPIRES_IN: ${jwtConfig.JWT_EXPIRES_IN}`);
console.log(`   - REFRESH_TOKEN_EXPIRES_DAYS: ${jwtConfig.REFRESH_TOKEN_EXPIRES_DAYS} jours`);
console.log(`   - BCRYPT_ROUNDS: ${jwtConfig.BCRYPT_ROUNDS}`);

module.exports = jwtConfig;
