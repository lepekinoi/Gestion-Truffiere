// ============================================================
// middleware/index.js
// Point d'entrée centralisé pour tous les middlewares
// ============================================================

/**
 * Export centralisé de tous les middlewares de l'application
 * 
 * Usage:
 *   const { authMiddleware, roleMiddleware, requireWriteAccess } = require('./middleware');
 * 
 * Ou pour tout importer:
 *   const middleware = require('./middleware');
 *   app.use(middleware.authMiddleware);
 */

// ============================================================
// MIDDLEWARES D'AUTHENTIFICATION
// ============================================================
const {
  authMiddleware,
  roleMiddleware,
  requireRole,
  requireWriteAccess,
  optionalAuth,
  activeUserMiddleware,
  adminOnly,
  userOrAdmin,
  allRoles,
  JWT_SECRET,
  JWT_EXPIRES_IN
} = require('./auth');

// ============================================================
// MIDDLEWARES DE VALIDATION
// ============================================================
const {
  handleValidationErrors,
  loginValidation,
  registerValidation,
  updateUserValidation,
  changePasswordValidation,
  resetPasswordValidation,
  forgotPasswordValidation,
  refreshTokenValidation
} = require('./validation');

// ============================================================
// MIDDLEWARES DE GESTION D'ERREURS
// ============================================================
const {
  notFoundHandler,
  corsErrorHandler,
  postgresErrorHandler,
  errorHandler,
  asyncHandler,
  createError
} = require('./error.middleware');

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // === AUTHENTIFICATION ===
  authMiddleware,
  roleMiddleware,
  requireRole,              // Alias de roleMiddleware
  requireWriteAccess,       // Bloque les utilisateurs readonly
  optionalAuth,             // Auth optionnelle (n'échoue pas)
  activeUserMiddleware,     // Vérifie compte actif en DB
  
  // Raccourcis d'authentification
  adminOnly,                // Require role: admin
  userOrAdmin,              // Require role: user ou admin
  allRoles,                 // Autorise tous les rôles
  
  // Config JWT (pour compatibilité)
  JWT_SECRET,
  JWT_EXPIRES_IN,
  
  // === VALIDATION ===
  handleValidationErrors,
  loginValidation,
  registerValidation,
  updateUserValidation,
  changePasswordValidation,
  resetPasswordValidation,
  forgotPasswordValidation,
  refreshTokenValidation,
  
  // === GESTION D'ERREURS ===
  notFoundHandler,          // Middleware 404
  corsErrorHandler,         // Gestion erreurs CORS
  postgresErrorHandler,     // Gestion erreurs PostgreSQL
  errorHandler,             // Gestionnaire global (dernier)
  asyncHandler,             // Wrapper pour routes async
  createError               // Factory d'erreurs custom
};
