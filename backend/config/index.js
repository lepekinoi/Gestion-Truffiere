// ============================================================
// config/index.js - Export centralisé de toutes les configurations
// ============================================================

const database = require('./database');
const jwt = require('./jwt');
const security = require('./security');
const environment = require('./environment');

module.exports = {
  // Database
  pool: database.pool,
  testConnection: database.testConnection,
  closePool: database.closePool,

  // JWT
  JWT_SECRET: jwt.JWT_SECRET,
  JWT_EXPIRES_IN: jwt.JWT_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_DAYS: jwt.REFRESH_TOKEN_EXPIRES_DAYS,
  BCRYPT_ROUNDS: jwt.BCRYPT_ROUNDS,

  // Security
  corsOptions: security.corsOptions,
  helmetConfig: security.helmetConfig,
  globalLimiter: security.globalLimiter,
  authLimiter: security.authLimiter,
  registerLimiter: security.registerLimiter,
  passwordResetLimiter: security.passwordResetLimiter,
  sensitiveLimiter: security.sensitiveLimiter,
  cookieOptions: security.cookieOptions,
  bcryptConfig: security.bcryptConfig,
  publicRoutes: security.publicRoutes,
  isPublicRoute: security.isPublicRoute,
  cors: security.cors,

  // Environment
  validateEnvironment: environment.validateEnvironment,
  getEnv: environment.getEnv,
  getEnvNumber: environment.getEnvNumber,
  getEnvBoolean: environment.getEnvBoolean,
  displayEnvironment: environment.displayEnvironment
};
