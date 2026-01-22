// ============================================================
// utils/helpers.js - Fonctions utilitaires
// ============================================================

/**
 * Convertit les valeurs vides en null (pour PostgreSQL)
 * @param {*} value - Valeur à convertir
 * @returns {*|null} - La valeur ou null
 */
const emptyToNull = (value) => {
  if (value === '' || value === undefined || value === null) {
    return null;
  }
  return value;
};

/**
 * Logger une tentative de connexion dans la base de données
 * @param {Object} pool - Pool de connexions PostgreSQL
 * @param {string} email - Email de l'utilisateur
 * @param {string} ip - Adresse IP
 * @param {string} userAgent - User agent du navigateur
 * @param {boolean} success - Succès ou échec
 * @param {string|null} reason - Raison de l'échec
 */
const logLoginAttempt = async (pool, email, ip, userAgent, success, reason) => {
  try {
    await pool.query(
      'INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason) VALUES ($1, $2, $3, $4, $5)',
      [email, ip, userAgent?.substring(0, 500), success, reason]
    );
  } catch (err) {
    console.error('Erreur log login:', err);
  }
};

/**
 * Génère un numéro de commande unique
 * @param {Object} pool - Pool de connexions PostgreSQL
 * @param {string} prefix - Préfixe (ex: 'CMD', 'FACT')
 * @returns {Promise<string>} - Numéro généré
 */
const generateOrderNumber = async (pool, prefix = 'CMD') => {
  const year = new Date().getFullYear();
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM commandes WHERE EXTRACT(YEAR FROM date_commande) = $1`,
    [year]
  );
  const count = parseInt(countResult.rows[0].count) + 1;
  return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
};

/**
 * Formatte une date pour l'affichage
 * @param {Date|string} date - Date à formater
 * @returns {string} - Date formatée (JJ/MM/AAAA)
 */
const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR');
};

/**
 * Calcule le montant TTC à partir du HT
 * @param {number} montantHT - Montant HT
 * @param {number} tauxTVA - Taux de TVA (en %)
 * @returns {number} - Montant TTC
 */
const calculateTTC = (montantHT, tauxTVA = 5.5) => {
  return montantHT * (1 + tauxTVA / 100);
};

module.exports = {
  emptyToNull,
  logLoginAttempt,
  generateOrderNumber,
  formatDate,
  calculateTTC
};
