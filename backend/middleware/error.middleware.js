// ============================================================
// middleware/error.middleware.js
// Gestion centralisée des erreurs pour l'API Truffière
// ============================================================

/**
 * Middleware 404 - Route non trouvée
 * Capture toutes les routes non définies
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method
  });
};

/**
 * Gestionnaire d'erreurs CORS
 * Gestion spécifique des erreurs CORS
 */
const corsErrorHandler = (err, req, res, next) => {
  if (err.message === 'Non autorisé par CORS') {
    return res.status(403).json({ 
      error: 'Origine non autorisée par la politique CORS', 
      code: 'CORS_ERROR',
      origin: req.get('origin') || 'unknown'
    });
  }
  next(err);
};

/**
 * Gestionnaire d'erreurs PostgreSQL
 * Traduction des codes d'erreur PostgreSQL en messages clairs
 */
const postgresErrorHandler = (err, req, res, next) => {
  // Si ce n'est pas une erreur PostgreSQL, passer au suivant
  if (!err.code || typeof err.code !== 'string') {
    return next(err);
  }

  // Codes d'erreur PostgreSQL courants
  const pgErrors = {
    // Contraintes d'unicité
    '23505': {
      status: 409,
      code: 'UNIQUE_VIOLATION',
      message: 'Conflit : cette valeur existe déjà dans la base de données'
    },
    
    // Contraintes de clé étrangère
    '23503': {
      status: 409,
      code: 'FOREIGN_KEY_VIOLATION',
      message: 'Conflit : référence à un enregistrement inexistant'
    },
    
    // Contraintes NOT NULL
    '23502': {
      status: 400,
      code: 'NOT_NULL_VIOLATION',
      message: 'Données manquantes : un champ obligatoire est vide'
    },
    
    // Contraintes CHECK
    '23514': {
      status: 400,
      code: 'CHECK_VIOLATION',
      message: 'Données invalides : les valeurs ne respectent pas les contraintes'
    },
    
    // Erreur de syntaxe SQL
    '42601': {
      status: 500,
      code: 'SYNTAX_ERROR',
      message: 'Erreur interne de requête'
    },
    
    // Colonne inconnue
    '42703': {
      status: 500,
      code: 'UNDEFINED_COLUMN',
      message: 'Erreur interne de requête'
    },
    
    // Table inconnue
    '42P01': {
      status: 500,
      code: 'UNDEFINED_TABLE',
      message: 'Erreur interne de requête'
    }
  };

  const pgError = pgErrors[err.code];
  
  if (pgError) {
    console.error('Erreur PostgreSQL:', {
      code: err.code,
      message: err.message,
      detail: err.detail,
      table: err.table,
      column: err.column,
      constraint: err.constraint
    });

    return res.status(pgError.status).json({
      error: pgError.message,
      code: pgError.code,
      // En développement, ajouter des détails
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          constraint: err.constraint,
          table: err.table,
          column: err.column
        }
      })
    });
  }

  // Si erreur PostgreSQL non gérée, passer au gestionnaire suivant
  next(err);
};

/**
 * Gestionnaire d'erreurs global
 * Doit être le dernier middleware de l'application
 * @param {Error} err - Objet erreur
 * @param {Request} req - Requête Express
 * @param {Response} res - Réponse Express
 * @param {Function} next - Fonction next (non utilisée, mais requise par Express)
 */
const errorHandler = (err, req, res, next) => {
  // Log détaillé de l'erreur
  console.error('Erreur serveur:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    route: req.path,
    method: req.method,
    user: req.user?.id || 'non authentifié',
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Déterminer le code de statut
  const statusCode = err.statusCode || err.status || 500;

  // Réponse au client
  res.status(statusCode).json({
    error: err.message || 'Erreur interne du serveur',
    code: err.code || 'INTERNAL_ERROR',
    
    // Informations supplémentaires en mode développement
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details || undefined
    }),
    
    // Timestamp pour le débogage
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware pour envelopper les routes async
 * Évite les try/catch répétitifs dans les routes
 * @param {Function} fn - Fonction async à envelopper
 * @returns {Function} Middleware Express
 * 
 * @example
 * router.get('/data', asyncHandler(async (req, res) => {
 *   const data = await fetchData();
 *   res.json(data);
 * }));
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Créer une erreur personnalisée
 * @param {string} message - Message d'erreur
 * @param {number} statusCode - Code HTTP
 * @param {string} code - Code d'erreur custom
 * @returns {Error} Erreur enrichie
 * 
 * @example
 * throw createError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND');
 */
const createError = (message, statusCode = 500, code = 'ERROR') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

module.exports = {
  notFoundHandler,
  corsErrorHandler,
  postgresErrorHandler,
  errorHandler,
  asyncHandler,
  createError
};
