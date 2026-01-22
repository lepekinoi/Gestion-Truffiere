// ====================================================================
// utils/logger.js - Utilitaires de logging
// ====================================================================

const colors = {
  reset: '\u001b[0m',
  bright: '\u001b[1m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m'
};

function getTimestamp() {
  return new Date().toISOString();
}

function log(level, message, data = null) {
  const timestamp = getTimestamp();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

const logger = {
  info: (message, data) => {
    console.log(`${colors.cyan}\u2139\ufe0f [INFO]${colors.reset} ${message}`, data || '');
  },
  
  success: (message, data) => {
    console.log(`${colors.green}\u2705 [SUCCESS]${colors.reset} ${message}`, data || '');
  },
  
  warning: (message, data) => {
    console.warn(`${colors.yellow}\u26a0\ufe0f [WARNING]${colors.reset} ${message}`, data || '');
  },
  
  error: (message, error) => {
    console.error(`${colors.red}\u274c [ERROR]${colors.reset} ${message}`);
    if (error) {
      console.error(error);
    }
  },
  
  debug: (message, data) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${colors.magenta}\ud83d\udc1e [DEBUG]${colors.reset} ${message}`, data || '');
    }
  }
};

module.exports = logger;
