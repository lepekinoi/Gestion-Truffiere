// ====================================================================
// config/jwt.js - Configuration JWT et Bcrypt
// ====================================================================

module.exports = {
  // Secret pour signer les JWT (DOIT être dans .env en production)
  JWT_SECRET: process.env.JWT_SECRET || 'votre_secret_jwt_super_securise',
  
  // Durée de validité des access tokens
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // Durée de validité des refresh tokens (en jours)
  REFRESH_TOKEN_EXPIRES_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30,
  
  // Nombre de rounds pour bcrypt
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  
  // Options de génération du token
  signOptions: {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    algorithm: 'HS256',
    issuer: 'truffiere-api',
    audience: 'truffiere-client'
  },
  
  // Options de vérification du token
  verifyOptions: {
    algorithms: ['HS256'],
    issuer: 'truffiere-api',
    audience: 'truffiere-client'
  }
};
