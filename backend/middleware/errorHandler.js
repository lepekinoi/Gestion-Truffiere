// ====================================================================
// middleware/errorHandler.js - Gestion centralisée des erreurs
// ====================================================================

function errorHandler(err, req, res, next) {
  // Log de l'erreur
  console.error('\u274c Erreur capturée:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Déterminer le code de statut
  const statusCode = err.statusCode || err.status || 500;
  
  // Réponse d'erreur
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Erreur serveur interne',
      code: statusCode,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err
      })
    }
  });
}

// Middleware pour les routes non trouvées
function notFoundHandler(req, res, next) {
  const error = new Error(`Route non trouvée - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

module.exports = {
  errorHandler,
  notFoundHandler
};
