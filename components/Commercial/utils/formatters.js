// ============================================================
// formatters.js - Fonctions de formatage pour le module Commercial
// ============================================================

/**
 * Formate un prix en euros avec 2 décimales
 * @param {number} price - Prix à formater
 * @param {boolean} showCurrency - Afficher le symbole € (par défaut: true)
 * @returns {string} Prix formaté
 */
export const formatPrice = (price, showCurrency = true) => {
  const formatted = parseFloat(price || 0).toFixed(2);
  return showCurrency ? `${formatted} €` : formatted;
};

/**
 * Formate une date au format français (DD/MM/YYYY)
 * @param {string|Date} date - Date à formater
 * @returns {string} Date formatée
 */
export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR');
};

/**
 * Formate une date et heure au format français
 * @param {string|Date} date - Date à formater
 * @returns {string} Date et heure formatées
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('fr-FR');
};

/**
 * Formate un poids en grammes avec unité
 * @param {number} grammes - Poids en grammes
 * @param {boolean} showUnit - Afficher l'unité (par défaut: true)
 * @returns {string} Poids formaté
 */
export const formatWeight = (grammes, showUnit = true) => {
  const formatted = parseFloat(grammes || 0).toFixed(0);
  return showUnit ? `${formatted} g` : formatted;
};

/**
 * Convertit des grammes en kilogrammes
 * @param {number} grammes - Poids en grammes
 * @returns {number} Poids en kilogrammes
 */
export const grammesToKg = (grammes) => {
  return parseFloat(grammes || 0) / 1000;
};

/**
 * Formate un numéro de téléphone français
 * @param {string} phone - Numéro de téléphone
 * @returns {string} Numéro formaté
 */
export const formatPhone = (phone) => {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }
  return phone;
};

/**
 * Tronque un texte avec des points de suspension
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale (par défaut: 50)
 * @returns {string} Texte tronqué
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

/**
 * Calcule le montant total à partir du poids et du prix unitaire
 * @param {number} grammes - Poids en grammes
 * @param {number} prixKg - Prix par kilogramme
 * @returns {number} Montant total
 */
export const calculateTotal = (grammes, prixKg) => {
  const kg = grammesToKg(grammes);
  return parseFloat((kg * parseFloat(prixKg || 0)).toFixed(2));
};

/**
 * Calcule le montant TTC à partir du HT
 * @param {number} montantHT - Montant hors taxes
 * @param {number} tauxTVA - Taux de TVA (par défaut: 0.055)
 * @returns {number} Montant TTC
 */
export const calculateTTC = (montantHT, tauxTVA = 0.055) => {
  return parseFloat((parseFloat(montantHT || 0) * (1 + tauxTVA)).toFixed(2));
};

/**
 * Calcule le montant de la TVA
 * @param {number} montantHT - Montant hors taxes
 * @param {number} tauxTVA - Taux de TVA (par défaut: 0.055)
 * @returns {number} Montant de la TVA
 */
export const calculateTVA = (montantHT, tauxTVA = 0.055) => {
  return parseFloat((parseFloat(montantHT || 0) * tauxTVA).toFixed(2));
};

/**
 * Formate un nom de client selon son type
 * @param {object} client - Objet client
 * @returns {string} Nom formaté
 */
export const formatClientName = (client) => {
  if (!client) return '-';
  
  if (client.type === 'Particulier') {
    return `${client.nom} ${client.prenom || ''}`.trim();
  }
  
  return client.raison_sociale || client.nom || '-';
};

/**
 * Formate une adresse complète
 * @param {object} client - Objet contenant l'adresse
 * @returns {string} Adresse formatée
 */
export const formatAddress = (client) => {
  if (!client) return '-';
  
  const parts = [
    client.adresse,
    client.code_postal && client.ville ? `${client.code_postal} ${client.ville}` : (client.ville || client.code_postal),
    client.pays !== 'France' ? client.pays : null
  ].filter(Boolean);
  
  return parts.join(', ') || '-';
};

/**
 * Formate un pourcentage
 * @param {number} value - Valeur à formater
 * @param {number} decimals - Nombre de décimales (par défaut: 1)
 * @returns {string} Pourcentage formaté
 */
export const formatPercentage = (value, decimals = 1) => {
  return `${parseFloat(value || 0).toFixed(decimals)} %`;
};

/**
 * Formate un nombre avec séparateurs de milliers
 * @param {number} value - Nombre à formater
 * @returns {string} Nombre formaté
 */
export const formatNumber = (value) => {
  return new Intl.NumberFormat('fr-FR').format(value || 0);
};
