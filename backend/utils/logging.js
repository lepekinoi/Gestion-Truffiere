// ============================================================
// utils/logging.js
// Fonctions de logging et audit trail
// ============================================================

/**
 * Enregistre une tentative de connexion
 * @param {Object} pool - Pool PostgreSQL
 * @param {string} email - Email de l'utilisateur
 * @param {string} ip - Adresse IP
 * @param {string} userAgent - User agent du navigateur
 * @param {boolean} success - Succès ou échec
 * @param {string|null} reason - Raison de l'échec (si applicable)
 * @returns {Promise<void>}
 */
const logLoginAttempt = async (pool, email, ip, userAgent, success, reason = null) => {
  try {
    await pool.query(
      `INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, ip, userAgent?.substring(0, 500), success, reason]
    );
  } catch (err) {
    console.error('[Logging Error] Impossible d\'enregistrer la tentative de connexion:', err.message);
  }
};

/**
 * Enregistre un événement de sécurité
 * @param {Object} pool - Pool PostgreSQL
 * @param {number|null} userId - ID utilisateur (null si non authentifié)
 * @param {string} event - Type d'événement (ex: 'account_locked', 'token_reuse')
 * @param {Object} details - Détails de l'événement
 * @returns {Promise<void>}
 */
const logSecurityEvent = async (pool, userId, event, details = {}) => {
  try {
    const logEntry = {
      userId: userId || null,
      event,
      details: JSON.stringify(details),
      timestamp: new Date().toISOString(),
      severity: determineSeverity(event)
    };

    await pool.query(
      `INSERT INTO security_logs (user_id, event_type, details, severity)
       VALUES ($1, $2, $3, $4)`,
      [logEntry.userId, logEntry.event, logEntry.details, logEntry.severity]
    );

    // Log critique en console également
    if (logEntry.severity === 'critical') {
      console.error('[⚠️ ALERTE SÉCURITÉ]', {
        userId: logEntry.userId,
        event: logEntry.event,
        details: logEntry.details
      });
    }
  } catch (err) {
    // Si la table security_logs n'existe pas, logger en console uniquement
    console.error('[Security Event]', {
      userId,
      event,
      details,
      error: err.message
    });
  }
};

/**
 * Enregistre une modification de données (audit trail)
 * @param {Object} pool - Pool PostgreSQL
 * @param {number} userId - ID utilisateur
 * @param {string} action - Action effectuée (create, update, delete)
 * @param {string} entity - Type d'entité (parcelle, arbre, vente, etc.)
 * @param {number} entityId - ID de l'entité
 * @param {Object|null} oldValues - Anciennes valeurs (pour update/delete)
 * @param {Object|null} newValues - Nouvelles valeurs (pour create/update)
 * @returns {Promise<void>}
 */
const logAuditTrail = async (pool, userId, action, entity, entityId, oldValues = null, newValues = null) => {
  try {
    await pool.query(
      `INSERT INTO audit_trail (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        action,
        entity,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null
      ]
    );
  } catch (err) {
    // Si la table audit_trail n'existe pas, logger en console
    console.log('[Audit Trail]', {
      userId,
      action,
      entity,
      entityId,
      timestamp: new Date().toISOString(),
      error: err.message
    });
  }
};

/**
 * Formate un message de log avec contexte
 * @param {string} level - Niveau (info, warn, error, debug)
 * @param {string} message - Message principal
 * @param {Object} context - Contexte additionnel
 * @returns {string} Message formaté
 */
const formatLogMessage = (level, message, context = {}) => {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase().padEnd(5);
  
  let logMessage = `[${timestamp}] [${levelUpper}] ${message}`;
  
  if (Object.keys(context).length > 0) {
    logMessage += ` | Context: ${JSON.stringify(context)}`;
  }
  
  return logMessage;
};

/**
 * Détermine la sévérité d'un événement de sécurité
 * @param {string} event - Type d'événement
 * @returns {string} Sévérité (low, medium, high, critical)
 */
const determineSeverity = (event) => {
  const criticalEvents = [
    'token_reuse_detected',
    'sql_injection_attempt',
    'xss_attempt',
    'brute_force_detected',
    'security_breach_all_sessions'
  ];
  
  const highEvents = [
    'account_locked',
    'max_attempts_exceeded',
    'suspicious_activity',
    'unauthorized_access_attempt'
  ];
  
  const mediumEvents = [
    'password_changed',
    'email_changed',
    'failed_login',
    'invalid_token'
  ];
  
  if (criticalEvents.includes(event)) return 'critical';
  if (highEvents.includes(event)) return 'high';
  if (mediumEvents.includes(event)) return 'medium';
  
  return 'low';
};

/**
 * Log une erreur avec stack trace
 * @param {Error} error - Objet erreur
 * @param {Object} context - Contexte additionnel
 */
const logError = (error, context = {}) => {
  console.error(formatLogMessage('error', error.message, {
    ...context,
    stack: error.stack,
    name: error.name
  }));
};

/**
 * Log d'information
 * @param {string} message - Message
 * @param {Object} context - Contexte
 */
const logInfo = (message, context = {}) => {
  console.log(formatLogMessage('info', message, context));
};

/**
 * Log de warning
 * @param {string} message - Message
 * @param {Object} context - Contexte
 */
const logWarn = (message, context = {}) => {
  console.warn(formatLogMessage('warn', message, context));
};

/**
 * Log de debug (seulement en mode développement)
 * @param {string} message - Message
 * @param {Object} context - Contexte
 */
const logDebug = (message, context = {}) => {
  if (process.env.NODE_ENV === 'development') {
    console.debug(formatLogMessage('debug', message, context));
  }
};

/**
 * Enregistre une requête API (middleware helper)
 * @param {Object} req - Requête Express
 * @param {number} statusCode - Code de statut HTTP
 * @param {number} duration - Durée en ms
 */
const logAPIRequest = (req, statusCode, duration) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  
  const message = `${req.method} ${req.path} ${statusCode}`;
  const context = {
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent')?.substring(0, 100)
  };
  
  if (level === 'error') {
    logError(new Error(message), context);
  } else if (level === 'warn') {
    logWarn(message, context);
  } else {
    logDebug(message, context); // Info logs seulement en dev
  }
};

module.exports = {
  // Logs métier
  logLoginAttempt,
  logSecurityEvent,
  logAuditTrail,
  
  // Logs génériques
  formatLogMessage,
  logError,
  logInfo,
  logWarn,
  logDebug,
  logAPIRequest,
  
  // Utilitaires internes
  determineSeverity
};
