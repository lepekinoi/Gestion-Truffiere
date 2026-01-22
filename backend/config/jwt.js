// ====================================================================
// config/jwt.js - Configuration JWT
// ====================================================================

module.exports = {
  secret: process.env.JWT_SECRET || 'votre_secret_jwt_super_securise',
  expiresIn: '24h',
  
  // Options de génération du token
  signOptions: {
    expiresIn: '24h',
    algorithm: 'HS256'
  },
  
  // Options de vérification du token
  verifyOptions: {
    algorithms: ['HS256']
  }
};
