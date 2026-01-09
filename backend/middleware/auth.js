// ============================================================
// middleware/auth.js
// Middleware d'authentification JWT pour l'API Truffière
// ============================================================

const jwt = require('jsonwebtoken');

// Configuration JWT (à mettre dans les variables d'environnement)
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGEZ_MOI_EN_PRODUCTION_minimum_64_caracteres_de_securite';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

/**
 * Middleware d'authentification
 * Vérifie la présence et la validité du token JWT
 */
const authMiddleware = (req, res, next) => {
  try {
    // Récupérer le token du header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Authentification requise',
        code: 'NO_TOKEN'
      });
    }

    // Format attendu: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ 
        error: 'Format de token invalide',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    const token = parts[1];

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Ajouter les informations utilisateur à la requête
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      nom: decoded.nom
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expiré',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Token invalide',
        code: 'INVALID_TOKEN'
      });
    }

    console.error('Erreur auth middleware:', err);
    return res.status(500).json({ 
      error: 'Erreur d\'authentification',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware de vérification des rôles
 * Vérifie que l'utilisateur a le rôle requis
 * @param {...string} allowedRoles - Liste des rôles autorisés
 */
const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentification requise',
        code: 'NO_USER'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Accès non autorisé',
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Middleware optionnel d'authentification
 * N'échoue pas si pas de token, mais ajoute req.user si token valide
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      req.user = null;
      return next();
    }

    const token = parts[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      nom: decoded.nom
    };

    next();
  } catch (err) {
    // En cas d'erreur, on continue sans utilisateur
    req.user = null;
    next();
  }
};

/**
 * Middleware de vérification que l'utilisateur est actif
 * À utiliser après authMiddleware
 */
const activeUserMiddleware = (pool) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentification requise',
        code: 'NO_USER'
      });
    }

    try {
      const result = await pool.query(
        'SELECT is_active, locked_until FROM users WHERE id = $1',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ 
          error: 'Utilisateur non trouvé',
          code: 'USER_NOT_FOUND'
        });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(403).json({ 
          error: 'Compte désactivé',
          code: 'ACCOUNT_DISABLED'
        });
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return res.status(403).json({ 
          error: 'Compte temporairement verrouillé',
          code: 'ACCOUNT_LOCKED',
          lockedUntil: user.locked_until
        });
      }

      next();
    } catch (err) {
      console.error('Erreur vérification utilisateur actif:', err);
      return res.status(500).json({ 
        error: 'Erreur de vérification',
        code: 'CHECK_ERROR'
      });
    }
  };
};

// Raccourcis pour les rôles courants
const adminOnly = roleMiddleware('admin');
const userOrAdmin = roleMiddleware('user', 'admin');
const allRoles = roleMiddleware('readonly', 'user', 'admin');

module.exports = {
  authMiddleware,
  roleMiddleware,
  optionalAuth,
  activeUserMiddleware,
  adminOnly,
  userOrAdmin,
  allRoles,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
