/**
 * Utilitaire d'import CSV pour l'application TruffiÃ Æ’Ã†â€™Ã â€šÃ‚Â¨re
 * Gestion complÃ Æ’Ã†â€™Ã â€šÃ‚Â¨te de l'encodage UTF-8 avec BOM pour Excel
 * Support complet de tous les composants avec import activÃ Æ’Ã†â€™Ã â€šÃ‚Â©
 * 
 * @version 2.0.0
 * @author Claude AI
 */

import Papa from 'papaparse';

// ============================================================================
// CONSTANTES ET CONFIGURATION
// ============================================================================

/**
 * BOM UTF-8 pour compatibilitÃ Æ’Ã†â€™Ã â€šÃ‚Â© Excel
 */
const UTF8_BOM = '\uFEFF';

/**
 * Options de qualitÃ Æ’Ã†â€™Ã â€šÃ‚Â© disponibles
 */
export const QUALITES = ['Extra', 'Première catégorie', 'Deuxième catégorie', 'Tout venant'];

/**
 * Options de calibre disponibles
 */
export const CALIBRES = ['Petit (moins de 20g)', 'Moyen (20-50g)', 'Gros (50-100g)', 'Très gros (plus de 100g)'];

/**
 * Options de maturitÃ Æ’Ã†â€™Ã â€šÃ‚Â© disponibles
 */
export const MATURITES = ['Immature', 'À point', 'Mature', 'Très mature'];

/**
 * Options d'exposition (position autour de l'arbre)
 */
export const EXPOSITIONS = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];

/**
 * Ã Æ’Ã†â€™Ã¢â‚¬Ã‚Â°tats possibles des arbres
 */
export const ETATS_ARBRES = ['Bon', 'Moyen', 'Mauvais', 'Mort'];

/**
 * Statuts des interventions
 */
export const STATUTS_INTERVENTIONS = ['Planifié', 'En cours', 'Terminé', 'Annulé', 'Reporté'];

/**
 * Statuts des ventes
 */
export const STATUTS_VENTES = ['En attente', 'Payée', 'Annulée'];

/**
 * Statuts des commandes
 */
export const STATUTS_COMMANDES = ['En attente', 'Confirmée', 'En préparation', 'Livrée', 'Annulée'];

/**
 * Types de clients
 */
export const TYPES_CLIENTS = ['Particulier', 'Professionnel', 'Restaurant', 'Grossiste', 'Exportateur'];

/**
 * Modes de paiement
 */
export const MODES_PAIEMENT = ['Espèces', 'Chèque', 'Virement', 'Carte bancaire', 'PayPal'];

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Nettoie une chaÃ Æ’Ã†â€™Ã â€šÃ‚Â®ne de caractÃ Æ’Ã†â€™Ã â€šÃ‚Â¨res du BOM et des espaces
 * @param {string} str - ChaÃ Æ’Ã†â€™Ã â€šÃ‚Â®ne Ã Æ’Ã†â€™Ã â€šÃ‚Â  nettoyer
 * @returns {string} ChaÃ Æ’Ã†â€™Ã â€šÃ‚Â®ne nettoyÃ Æ’Ã†â€™Ã â€šÃ‚Â©e
 */
const cleanString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim()
    .replace(/^\uFEFF/, '')  // BOM UTF-8
    .replace(/^\ufeff/, '')  // BOM UTF-8 (minuscule)
    .replace(/^\xEF\xBB\xBF/, '') // BOM UTF-8 en bytes
    .replace(/\u00A0/g, ' ') // Espace insÃ Æ’Ã†â€™Ã â€šÃ‚Â©cable
    .trim();
};

/**
 * Valide et parse une date au format YYYY-MM-DD ou DD/MM/YYYY
 * @param {string} dateStr - Date en chaÃ Æ’Ã†â€™Ã â€šÃ‚Â®ne
 * @returns {string|null} Date au format YYYY-MM-DD ou null si invalide
 */
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  const cleaned = cleanString(dateStr);
  
  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) return cleaned;
  }
  
  // Format DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
    const [day, month, year] = cleaned.split('/');
    const date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date.getTime())) return `${year}-${month}-${day}`;
  }
  
  // Format DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
    const [day, month, year] = cleaned.split('-');
    const date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date.getTime())) return `${year}-${month}-${day}`;
  }
  
  return null;
};

/**
 * Parse un nombre dÃ Æ’Ã†â€™Ã â€šÃ‚Â©cimal avec gestion des virgules
 * @param {string|number} value - Valeur Ã Æ’Ã†â€™Ã â€šÃ‚Â  parser
 * @returns {number|null} Nombre ou null si invalide
 */
const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  
  const cleaned = cleanString(String(value))
    .replace(/\s/g, '')
    .replace(',', '.');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

/**
 * Parse un entier
 * @param {string|number} value - Valeur Ã Æ’Ã†â€™Ã â€šÃ‚Â  parser
 * @returns {number|null} Entier ou null si invalide
 */
const parseInteger = (value) => {
  const num = parseNumber(value);
  return num !== null ? Math.round(num) : null;
};

/**
 * Valide une adresse email
 * @param {string} email - Email Ã Æ’Ã†â€™Ã â€šÃ‚Â  valider
 * @returns {boolean} True si valide
 */
const isValidEmail = (email) => {
  if (!email) return true; // Email optionnel
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleanString(email));
};

/**
 * Valide un numÃ Æ’Ã†â€™Ã â€šÃ‚Â©ro de tÃ Æ’Ã†â€™Ã â€šÃ‚Â©lÃ Æ’Ã†â€™Ã â€šÃ‚Â©phone franÃ Æ’Ã†â€™Ã â€šÃ‚Â§ais
 * @param {string} phone - TÃ Æ’Ã†â€™Ã â€šÃ‚Â©lÃ Æ’Ã†â€™Ã â€šÃ‚Â©phone Ã Æ’Ã†â€™Ã â€šÃ‚Â  valider
 * @returns {boolean} True si valide
 */
const isValidPhone = (phone) => {
  if (!phone) return true; // TÃ Æ’Ã†â€™Ã â€šÃ‚Â©lÃ Æ’Ã†â€™Ã â€šÃ‚Â©phone optionnel
  const cleaned = cleanString(phone).replace(/[\s.-]/g, '');
  return /^(\+33|0033|0)[1-9]\d{8}$/.test(cleaned);
};

/**
 * Valide un numÃ Æ’Ã†â€™Ã â€šÃ‚Â©ro SIRET
 * @param {string} siret - SIRET Ã Æ’Ã†â€™Ã â€šÃ‚Â  valider
 * @returns {boolean} True si valide
 */
const isValidSiret = (siret) => {
  if (!siret) return true; // SIRET optionnel
  const cleaned = cleanString(siret).replace(/\s/g, '');
  return /^\d{14}$/.test(cleaned);
};

/**
 * Formate un numÃ Æ’Ã†â€™Ã â€šÃ‚Â©ro de tÃ Æ’Ã†â€™Ã â€šÃ‚Â©lÃ Æ’Ã†â€™Ã â€šÃ‚Â©phone
 * @param {string} phone - TÃ Æ’Ã†â€™Ã â€šÃ‚Â©lÃ Æ’Ã†â€™Ã â€šÃ‚Â©phone Ã Æ’Ã†â€™Ã â€šÃ‚Â  formater
 * @returns {string|null} TÃ Æ’Ã†â€™Ã â€šÃ‚Â©lÃ Æ’Ã†â€™Ã â€šÃ‚Â©phone formatÃ Æ’Ã†â€™Ã â€šÃ‚Â© ou null
 */
const formatPhone = (phone) => {
  if (!phone) return null;
  const cleaned = cleanString(phone).replace(/[\s.-]/g, '');
  if (cleaned.startsWith('+33')) {
    return '0' + cleaned.slice(3);
  }
  if (cleaned.startsWith('0033')) {
    return '0' + cleaned.slice(4);
  }
  return cleaned;
};

// ============================================================================
// PARSING CSV
// ============================================================================

/**
 * Parse un fichier CSV et retourne les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * GÃ Æ’Ã†â€™Ã â€šÃ‚Â¨re automatiquement UTF-8 avec ou sans BOM
 * @param {File} file - Fichier CSV Ã Æ’Ã†â€™Ã â€šÃ‚Â  parser
 * @returns {Promise<Array>} DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 */
export const parseCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    // Lire d'abord comme ArrayBuffer pour dÃ Æ’Ã†â€™Ã â€šÃ‚Â©tecter l'encodage
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const arrayBuffer = event.target.result;
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // DÃ Æ’Ã†â€™Ã â€šÃ‚Â©tecter et supprimer le BOM si prÃ Æ’Ã†â€™Ã â€šÃ‚Â©sent
      let startIndex = 0;
      if (uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
        startIndex = 3; // BOM UTF-8 dÃ Æ’Ã†â€™Ã â€šÃ‚Â©tectÃ Æ’Ã†â€™Ã â€šÃ‚Â©
      }
      
      // Convertir en texte UTF-8
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(uint8Array.slice(startIndex));
      
      // Parser avec PapaParse
      Papa.parse(text, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (header) => cleanString(header),
        transform: (value) => cleanString(value),
        complete: (results) => {
          if (results.errors.length > 0) {
            // Filtrer les erreurs non critiques
            const criticalErrors = results.errors.filter(e => 
              e.type !== 'Quotes' && 
              e.type !== 'FieldMismatch' &&
              e.code !== 'TooFewFields' &&
              e.code !== 'TooManyFields'
            );
            if (criticalErrors.length > 0) {
              reject(new Error(`Erreurs de parsing: ${criticalErrors.map(e => e.message).join(', ')}`));
              return;
            }
          }
          
          // Filtrer les lignes vides
          const validData = results.data.filter(row => {
            return Object.values(row).some(val => val && val.trim() !== '');
          });
          
          resolve(validData);
        },
        error: (error) => reject(new Error(`Erreur de lecture: ${error.message}`))
      });
    };
    
    reader.onerror = () => reject(new Error('Impossible de lire le fichier'));
    reader.readAsArrayBuffer(file);
  });
};

// ============================================================================
// FONCTIONS DE VALIDATION
// ============================================================================

/**
 * Valide les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es de parcelles
 * @param {Array} data - DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es CSV parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @returns {Object} { validData, errors }
 */
export const validateParcellesCSV = (data) => {
  const errors = [];
  const validData = [];
  const nomsVus = new Set();

  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 car ligne 1 = headers, index 0 = ligne 2
    const rowErrors = [];
    
    // Validation du nom (obligatoire et unique)
    const nom = cleanString(row.nom);
    if (!nom) {
      rowErrors.push('Le nom est obligatoire');
    } else if (nomsVus.has(nom.toLowerCase())) {
      rowErrors.push(`Le nom "${nom}" est en doublon`);
    } else {
      nomsVus.add(nom.toLowerCase());
    }
    
    // Validation de la surface (obligatoire, numÃ Æ’Ã†â€™Ã â€šÃ‚Â©rique positif)
    const surface = parseNumber(row.surface_ha);
    if (surface === null) {
      rowErrors.push('La surface est obligatoire et doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre numÃ Æ’Ã†â€™Ã â€šÃ‚Â©rique');
    } else if (surface <= 0) {
      rowErrors.push('La surface doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre positive');
    } else if (surface > 1000) {
      rowErrors.push('La surface semble trop grande (>1000 ha)');
    }
    
    // Validation du pH (optionnel, entre 0 et 14)
    const phSol = parseNumber(row.ph_sol);
    if (phSol !== null && (phSol < 0 || phSol > 14)) {
      rowErrors.push('Le pH doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre compris entre 0 et 14');
    }
    
    if (rowErrors.length > 0) {
      errors.push(`Ligne ${rowNum}: ${rowErrors.join(', ')}`);
      return;
    }

    validData.push({
      nom: nom,
      surface_ha: surface,
      type_sol: cleanString(row.type_sol) || null,
      ph_sol: phSol,
      notes: cleanString(row.notes) || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es d'arbres
 * @param {Array} data - DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es CSV parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @param {Object} dependencies - { parcelles: Array }
 * @returns {Object} { validData, errors }
 */
export const validateArbresCSV = (data, dependencies = {}) => {
  const errors = [];
  const validData = [];
  const numerosVus = new Set();
  
  // CrÃ Æ’Ã†â€™Ã â€šÃ‚Â©er un map des parcelles par nom (insensible Ã Æ’Ã†â€™Ã â€šÃ‚Â  la casse)
  const parcelleMap = {};
  (dependencies.parcelles || []).forEach(p => {
    parcelleMap[cleanString(p.nom).toLowerCase()] = p.id;
  });

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const rowErrors = [];
    
    // Validation du numÃ Æ’Ã†â€™Ã â€šÃ‚Â©ro (obligatoire et unique)
    const numero = cleanString(row.numero);
    if (!numero) {
      rowErrors.push('Le numÃ Æ’Ã†â€™Ã â€šÃ‚Â©ro est obligatoire');
    } else if (numerosVus.has(numero.toLowerCase())) {
      rowErrors.push(`Le numÃ Æ’Ã†â€™Ã â€šÃ‚Â©ro "${numero}" est en doublon dans le fichier`);
    } else {
      numerosVus.add(numero.toLowerCase());
    }
    
    // Validation de la parcelle (obligatoire)
    const parcelleNom = cleanString(row.parcelle_nom);
    let parcelleId = null;
    if (!parcelleNom) {
      rowErrors.push('La parcelle est obligatoire');
    } else {
      parcelleId = parcelleMap[parcelleNom.toLowerCase()];
      if (!parcelleId) {
        rowErrors.push(`Parcelle "${parcelleNom}" introuvable`);
      }
    }
    
    // Validation de l'espÃ Æ’Ã†â€™Ã â€šÃ‚Â¨ce (obligatoire)
    const espece = cleanString(row.espece);
    if (!espece) {
      rowErrors.push("L'espÃ Æ’Ã†â€™Ã â€šÃ‚Â¨ce est obligatoire");
    }
    
    // Validation de la date de plantation (obligatoire)
    const datePlantation = parseDate(row.date_plantation);
    if (!datePlantation) {
      rowErrors.push('La date de plantation est obligatoire (format: YYYY-MM-DD ou DD/MM/YYYY)');
    } else {
      const dateObj = new Date(datePlantation);
      if (dateObj > new Date()) {
        rowErrors.push('La date de plantation ne peut pas Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre dans le futur');
      }
    }
    
    // Validation de la circonfÃ Æ’Ã†â€™Ã â€šÃ‚Â©rence (optionnel, positif)
    const circonference = parseNumber(row.circonference_cm);
    if (circonference !== null && circonference < 0) {
      rowErrors.push('La circonfÃ Æ’Ã†â€™Ã â€šÃ‚Â©rence doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre positive');
    }
    
    // Validation de la hauteur (optionnel, positif)
    const hauteur = parseNumber(row.hauteur_m);
    if (hauteur !== null && (hauteur < 0 || hauteur > 50)) {
      rowErrors.push('La hauteur doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre entre 0 et 50 mÃ Æ’Ã†â€™Ã â€šÃ‚Â¨tres');
    }
    
    // Validation des coordonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es GPS (optionnel)
    const latitude = parseNumber(row.latitude);
    const longitude = parseNumber(row.longitude);
    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      rowErrors.push('La latitude doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre entre -90 et 90');
    }
    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      rowErrors.push('La longitude doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre entre -180 et 180');
    }
    
    // Validation de l'Ã Æ’Ã†â€™Ã â€šÃ‚Â©tat
    const etat = cleanString(row.etat) || 'Bon';
    if (!ETATS_ARBRES.includes(etat)) {
      rowErrors.push(`Ã Æ’Ã†â€™Ã¢â‚¬Ã‚Â°tat "${etat}" non reconnu. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${ETATS_ARBRES.join(', ')}`);
    }

    if (rowErrors.length > 0) {
      errors.push(`Ligne ${rowNum}: ${rowErrors.join(', ')}`);
      return;
    }

    validData.push({
      parcelle_id: parcelleId,
      numero: numero,
      espece: espece,
      variete_truffe: cleanString(row.variete_truffe) || null,
      date_plantation: datePlantation,
      etat: etat,
      circonference_cm: circonference,
      hauteur_m: hauteur,
      latitude: latitude,
      longitude: longitude,
      date_derniere_taille: parseDate(row.date_derniere_taille),
      notes: cleanString(row.notes) || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es de rÃ Æ’Ã†â€™Ã â€šÃ‚Â©coltes
 * @param {Array} data - DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es CSV parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @param {Object} dependencies - { parcelles, arbres, caveurs, chiens }
 * @returns {Object} { validData, errors }
 */
export const validateRecoltesCSV = (data, dependencies = {}) => {
  const errors = [];
  const validData = [];
  
  // Maps pour recherche rapide
  const parcelleMap = {};
  (dependencies.parcelles || []).forEach(p => {
    parcelleMap[cleanString(p.nom).toLowerCase()] = p.id;
  });
  
  const arbreMap = {};
  (dependencies.arbres || []).forEach(a => {
    arbreMap[cleanString(a.numero).toLowerCase()] = a.id;
  });
  
  const caveursSet = new Set((dependencies.caveurs || []).map(c => cleanString(c.nom).toLowerCase()));
  const chiensSet = new Set((dependencies.chiens || []).map(c => cleanString(c.nom).toLowerCase()));

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const rowErrors = [];
    
    // Validation de la date de rÃ Æ’Ã†â€™Ã â€šÃ‚Â©colte (obligatoire)
    const dateRecolte = parseDate(row.date_recolte);
    if (!dateRecolte) {
      rowErrors.push('La date de rÃ Æ’Ã†â€™Ã â€šÃ‚Â©colte est obligatoire (format: YYYY-MM-DD ou DD/MM/YYYY)');
    } else {
      const dateObj = new Date(dateRecolte);
      if (dateObj > new Date()) {
        rowErrors.push('La date de rÃ Æ’Ã†â€™Ã â€šÃ‚Â©colte ne peut pas Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre dans le futur');
      }
    }
    
    // Validation du poids (obligatoire, positif)
    const poids = parseNumber(row.poids_grammes);
    if (poids === null) {
      rowErrors.push('Le poids est obligatoire');
    } else if (poids <= 0) {
      rowErrors.push('Le poids doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre positif');
    } else if (poids > 10000) {
      rowErrors.push('Le poids semble trop Ã Æ’Ã†â€™Ã â€šÃ‚Â©levÃ Æ’Ã†â€™Ã â€šÃ‚Â© (>10kg)');
    }
    
    // Validation de la parcelle (optionnel mais doit exister si fourni)
    let parcelleId = null;
    const parcelleNom = cleanString(row.parcelle_nom);
    if (parcelleNom) {
      parcelleId = parcelleMap[parcelleNom.toLowerCase()];
      if (!parcelleId) {
        rowErrors.push(`Parcelle "${parcelleNom}" introuvable`);
      }
    }
    
    // Validation de l'arbre (optionnel mais doit exister si fourni)
    let arbreId = null;
    const arbreNumero = cleanString(row.arbre_numero);
    if (arbreNumero) {
      arbreId = arbreMap[arbreNumero.toLowerCase()];
      if (!arbreId) {
        rowErrors.push(`Arbre "${arbreNumero}" introuvable`);
      }
    }
    
    // Validation de la qualitÃ Æ’Ã†â€™Ã â€šÃ‚Â©
    const qualite = cleanString(row.qualite);
    if (qualite && !QUALITES.includes(qualite)) {
      rowErrors.push(`QualitÃ Æ’Ã†â€™Ã â€šÃ‚Â© "${qualite}" non reconnue. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${QUALITES.join(', ')}`);
    }
    
    // Validation du calibre
    const calibre = cleanString(row.calibre);
    if (calibre && !CALIBRES.includes(calibre)) {
      rowErrors.push(`Calibre "${calibre}" non reconnu. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${CALIBRES.join(', ')}`);
    }
    
    // Validation de la maturitÃ Æ’Ã†â€™Ã â€šÃ‚Â©
    const maturite = cleanString(row.maturite);
    if (maturite && !MATURITES.includes(maturite)) {
      rowErrors.push(`MaturitÃ Æ’Ã†â€™Ã â€šÃ‚Â© "${maturite}" non reconnue. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${MATURITES.join(', ')}`);
    }
    
    // Validation de l'exposition
    const exposition = cleanString(row.exposition);
    if (exposition && !EXPOSITIONS.includes(exposition)) {
      rowErrors.push(`Exposition "${exposition}" non reconnue. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${EXPOSITIONS.join(', ')}`);
    }
    
    // Validation de la profondeur
    const profondeur = parseInteger(row.profondeur_cm);
    if (profondeur !== null && (profondeur < 0 || profondeur > 100)) {
      rowErrors.push('La profondeur doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre entre 0 et 100 cm');
    }
    
    // Validation de la tempÃ Æ’Ã†â€™Ã â€šÃ‚Â©rature du sol
    const tempSol = parseNumber(row.temperature_sol);
    if (tempSol !== null && (tempSol < -20 || tempSol > 50)) {
      rowErrors.push('La tempÃ Æ’Ã†â€™Ã â€šÃ‚Â©rature du sol semble incorrecte (-20Ã Æ’Ã¢â‚¬Å¡Ã â€šÃ‚Â°C Ã Æ’Ã†â€™Ã â€šÃ‚Â  50Ã Æ’Ã¢â‚¬Å¡Ã â€šÃ‚Â°C)');
    }
    
    // Warning pour caveur/chien inconnu (pas bloquant)
    const caveur = cleanString(row.caveur);
    const chien = cleanString(row.chien);
    if (caveur && caveursSet.size > 0 && !caveursSet.has(caveur.toLowerCase())) {
      // Avertissement seulement, on continue
    }
    if (chien && chiensSet.size > 0 && !chiensSet.has(chien.toLowerCase())) {
      // Avertissement seulement, on continue
    }

    if (rowErrors.length > 0) {
      errors.push(`Ligne ${rowNum}: ${rowErrors.join(', ')}`);
      return;
    }

    validData.push({
      parcelle_id: parcelleId,
      arbre_id: arbreId,
      date_recolte: dateRecolte,
      poids_grammes: poids,
      qualite: qualite || null,
      calibre: calibre || null,
      maturite: maturite || null,
      profondeur_cm: profondeur,
      exposition: exposition || null,
      caveur: caveur || null,
      chien: chien || null,
      conditions_meteo: cleanString(row.conditions_meteo) || null,
      temperature_sol: tempSol,
      notes: cleanString(row.notes) || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es de clients
 * @param {Array} data - DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es CSV parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @returns {Object} { validData, errors }
 */
export const validateClientsCSV = (data) => {
  const errors = [];
  const validData = [];
  const emailsVus = new Set();

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const rowErrors = [];
    
    // Validation du type
    const type = cleanString(row.type) || 'Particulier';
    if (!TYPES_CLIENTS.includes(type)) {
      rowErrors.push(`Type "${type}" non reconnu. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${TYPES_CLIENTS.join(', ')}`);
    }
    
    // Validation du nom/raison sociale selon le type
    const nom = cleanString(row.nom);
    const raisonSociale = cleanString(row.raison_sociale);
    
    if (type === 'Particulier') {
      if (!nom) {
        rowErrors.push('Le nom est obligatoire pour un particulier');
      }
    } else {
      if (!raisonSociale) {
        rowErrors.push('La raison sociale est obligatoire pour un professionnel');
      }
    }
    
    // Validation de l'email (optionnel mais format valide)
    const email = cleanString(row.email);
    if (email) {
      if (!isValidEmail(email)) {
        rowErrors.push("Format d'email invalide");
      } else if (emailsVus.has(email.toLowerCase())) {
        rowErrors.push(`L'email "${email}" est en doublon`);
      } else {
        emailsVus.add(email.toLowerCase());
      }
    }
    
    // Validation du tÃ Æ’Ã†â€™Ã â€šÃ‚Â©lÃ Æ’Ã†â€™Ã â€šÃ‚Â©phone (optionnel mais format valide)
    const telephone = cleanString(row.telephone);
    if (telephone && !isValidPhone(telephone)) {
      rowErrors.push('Format de tÃ Æ’Ã†â€™Ã â€šÃ‚Â©lÃ Æ’Ã†â€™Ã â€šÃ‚Â©phone invalide');
    }
    
    // Validation du SIRET (optionnel mais format valide)
    const siret = cleanString(row.siret);
    if (siret && !isValidSiret(siret)) {
      rowErrors.push('Format SIRET invalide (14 chiffres attendus)');
    }
    
    // Validation du code postal
    const codePostal = cleanString(row.code_postal);
    if (codePostal && !/^\d{5}$/.test(codePostal)) {
      rowErrors.push('Format de code postal invalide (5 chiffres attendus)');
    }

    if (rowErrors.length > 0) {
      errors.push(`Ligne ${rowNum}: ${rowErrors.join(', ')}`);
      return;
    }

    validData.push({
      type: type,
      nom: nom || null,
      prenom: cleanString(row.prenom) || null,
      raison_sociale: raisonSociale || null,
      email: email || null,
      telephone: formatPhone(telephone),
      adresse: cleanString(row.adresse) || null,
      code_postal: codePostal || null,
      ville: cleanString(row.ville) || null,
      pays: cleanString(row.pays) || 'France',
      siret: siret ? siret.replace(/\s/g, '') : null,
      notes: cleanString(row.notes) || null,
      date_premier_achat: parseDate(row.date_premier_achat)
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es de ventes
 * @param {Array} data - DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es CSV parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @param {Object} dependencies - { clients, recoltes }
 * @returns {Object} { validData, errors }
 */
export const validateVentesCSV = (data, dependencies = {}) => {
  const errors = [];
  const validData = [];
  
  // Map des clients par nom complet ou raison sociale
  const clientMap = {};
  (dependencies.clients || []).forEach(c => {
    if (c.type === 'Particulier') {
      const fullName = `${c.nom || ''} ${c.prenom || ''}`.trim().toLowerCase();
      if (fullName) clientMap[fullName] = c.id;
      // Aussi par nom seul
      if (c.nom) clientMap[c.nom.toLowerCase()] = c.id;
    } else {
      if (c.raison_sociale) {
        clientMap[c.raison_sociale.toLowerCase()] = c.id;
      }
    }
  });

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const rowErrors = [];
    
    // Validation de la date de vente (obligatoire)
    const dateVente = parseDate(row.date_vente);
    if (!dateVente) {
      rowErrors.push('La date de vente est obligatoire (format: YYYY-MM-DD ou DD/MM/YYYY)');
    }
    
    // Validation du client (obligatoire)
    const clientNom = cleanString(row.client_nom);
    let clientId = null;
    if (!clientNom) {
      rowErrors.push('Le client est obligatoire');
    } else {
      clientId = clientMap[clientNom.toLowerCase()];
      if (!clientId) {
        rowErrors.push(`Client "${clientNom}" introuvable`);
      }
    }
    
    // Validation de la quantitÃ Æ’Ã†â€™Ã â€šÃ‚Â© (obligatoire, positif)
    const quantite = parseNumber(row.quantite_grammes);
    if (quantite === null) {
      rowErrors.push('La quantitÃ Æ’Ã†â€™Ã â€šÃ‚Â© est obligatoire');
    } else if (quantite <= 0) {
      rowErrors.push('La quantitÃ Æ’Ã†â€™Ã â€šÃ‚Â© doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre positive');
    }
    
    // Validation du prix unitaire (obligatoire si pas de montant total)
    const prixUnitaire = parseNumber(row.prix_unitaire_kg);
    const montantTotal = parseNumber(row.montant_total);
    
    if (prixUnitaire === null && montantTotal === null) {
      rowErrors.push('Le prix unitaire ou le montant total est obligatoire');
    }
    if (prixUnitaire !== null && prixUnitaire < 0) {
      rowErrors.push('Le prix unitaire doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre positif');
    }
    
    // Validation du statut
    const statut = cleanString(row.statut) || 'En attente';
    if (!STATUTS_VENTES.includes(statut)) {
      rowErrors.push(`Statut "${statut}" non reconnu. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${STATUTS_VENTES.join(', ')}`);
    }
    
    // Validation du mode de paiement
    const modePaiement = cleanString(row.mode_paiement);
    if (modePaiement && !MODES_PAIEMENT.includes(modePaiement)) {
      rowErrors.push(`Mode de paiement "${modePaiement}" non reconnu. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${MODES_PAIEMENT.join(', ')}`);
    }

    if (rowErrors.length > 0) {
      errors.push(`Ligne ${rowNum}: ${rowErrors.join(', ')}`);
      return;
    }

    // Calcul du montant total si non fourni
    let finalMontant = montantTotal;
    if (finalMontant === null && prixUnitaire !== null && quantite !== null) {
      finalMontant = Math.round((prixUnitaire * quantite / 1000) * 100) / 100;
    }

    validData.push({
      client_id: clientId,
      recolte_id: null, // On ne lie pas automatiquement aux rÃ Æ’Ã†â€™Ã â€šÃ‚Â©coltes
      date_vente: dateVente,
      quantite_grammes: quantite,
      prix_unitaire_kg: prixUnitaire,
      montant_total: finalMontant,
      mode_paiement: modePaiement || null,
      statut: statut,
      numero_facture: cleanString(row.numero_facture) || null,
      notes: cleanString(row.notes) || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es d'interventions
 * @param {Array} data - DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es CSV parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @param {Object} dependencies - { parcelles, arbres, typesIntervention }
 * @returns {Object} { validData, errors }
 */
export const validateInterventionsCSV = (data, dependencies = {}) => {
  const errors = [];
  const validData = [];
  
  // Maps pour recherche rapide
  const parcelleMap = {};
  (dependencies.parcelles || []).forEach(p => {
    parcelleMap[cleanString(p.nom).toLowerCase()] = p.id;
  });
  
  const arbreMap = {};
  (dependencies.arbres || []).forEach(a => {
    arbreMap[cleanString(a.numero).toLowerCase()] = a.id;
  });
  
  const typeMap = {};
  (dependencies.typesIntervention || []).forEach(t => {
    typeMap[cleanString(t.nom).toLowerCase()] = t.id;
  });

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const rowErrors = [];
    
    // Validation du type d'intervention (obligatoire)
    const typeNom = cleanString(row.type_intervention);
    let typeId = null;
    if (!typeNom) {
      rowErrors.push("Le type d'intervention est obligatoire");
    } else {
      typeId = typeMap[typeNom.toLowerCase()];
      if (!typeId) {
        rowErrors.push(`Type d'intervention "${typeNom}" introuvable`);
      }
    }
    
    // Validation de la date prÃ Æ’Ã†â€™Ã â€šÃ‚Â©vue (obligatoire)
    const datePrevue = parseDate(row.date_prevue);
    if (!datePrevue) {
      rowErrors.push('La date prÃ Æ’Ã†â€™Ã â€šÃ‚Â©vue est obligatoire (format: YYYY-MM-DD ou DD/MM/YYYY)');
    }
    
    // Validation de la date rÃ Æ’Ã†â€™Ã â€šÃ‚Â©alisÃ Æ’Ã†â€™Ã â€šÃ‚Â©e (optionnel, doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre <= aujourd'hui)
    const dateRealisee = parseDate(row.date_realisee);
    if (dateRealisee) {
      const dateObj = new Date(dateRealisee);
      if (dateObj > new Date()) {
        rowErrors.push('La date rÃ Æ’Ã†â€™Ã â€šÃ‚Â©alisÃ Æ’Ã†â€™Ã â€šÃ‚Â©e ne peut pas Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre dans le futur');
      }
    }
    
    // Validation de la parcelle (optionnel mais doit exister si fourni)
    let parcelleId = null;
    const parcelleNom = cleanString(row.parcelle_nom);
    if (parcelleNom) {
      parcelleId = parcelleMap[parcelleNom.toLowerCase()];
      if (!parcelleId) {
        rowErrors.push(`Parcelle "${parcelleNom}" introuvable`);
      }
    }
    
    // Validation de l'arbre (optionnel mais doit exister si fourni)
    let arbreId = null;
    const arbreNumero = cleanString(row.arbre_numero);
    if (arbreNumero) {
      arbreId = arbreMap[arbreNumero.toLowerCase()];
      if (!arbreId) {
        rowErrors.push(`Arbre "${arbreNumero}" introuvable`);
      }
    }
    
    // Validation de la durÃ Æ’Ã†â€™Ã â€šÃ‚Â©e (positif)
    const duree = parseInteger(row.duree_minutes);
    if (duree !== null && duree < 0) {
      rowErrors.push('La durÃ Æ’Ã†â€™Ã â€šÃ‚Â©e doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre positive');
    }
    
    // Validation du coÃ Æ’Ã†â€™Ã â€šÃ‚Â»t (positif)
    const cout = parseNumber(row.cout);
    if (cout !== null && cout < 0) {
      rowErrors.push('Le coÃ Æ’Ã†â€™Ã â€šÃ‚Â»t doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre positif');
    }
    
    // Validation du statut
    const statut = cleanString(row.statut) || 'PlanifiÃ Æ’Ã†â€™Ã â€šÃ‚Â©';
    if (!STATUTS_INTERVENTIONS.includes(statut)) {
      rowErrors.push(`Statut "${statut}" non reconnu. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${STATUTS_INTERVENTIONS.join(', ')}`);
    }

    if (rowErrors.length > 0) {
      errors.push(`Ligne ${rowNum}: ${rowErrors.join(', ')}`);
      return;
    }

    validData.push({
      type_intervention_id: typeId,
      parcelle_id: parcelleId,
      arbre_id: arbreId,
      date_prevue: datePrevue,
      date_realisee: dateRealisee,
      duree_minutes: duree,
      personnel: cleanString(row.personnel) || null,
      description: cleanString(row.description) || null,
      cout: cout,
      statut: statut,
      meteo: cleanString(row.meteo) || null,
      notes: cleanString(row.notes) || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es de commandes
 * @param {Array} data - DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es CSV parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @param {Object} dependencies - { clients }
 * @returns {Object} { validData, errors }
 */
export const validateCommandesCSV = (data, dependencies = {}) => {
  const errors = [];
  const validData = [];
  
  // Map des clients
  const clientMap = {};
  (dependencies.clients || []).forEach(c => {
    if (c.type === 'Particulier') {
      const fullName = `${c.nom || ''} ${c.prenom || ''}`.trim().toLowerCase();
      if (fullName) clientMap[fullName] = c.id;
      if (c.nom) clientMap[c.nom.toLowerCase()] = c.id;
    } else {
      if (c.raison_sociale) {
        clientMap[c.raison_sociale.toLowerCase()] = c.id;
      }
    }
  });

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const rowErrors = [];
    
    // Validation du client (obligatoire)
    const clientNom = cleanString(row.client_nom);
    let clientId = null;
    if (!clientNom) {
      rowErrors.push('Le client est obligatoire');
    } else {
      clientId = clientMap[clientNom.toLowerCase()];
      if (!clientId) {
        rowErrors.push(`Client "${clientNom}" introuvable`);
      }
    }
    
    // Validation de la date de commande (optionnel, dÃ Æ’Ã†â€™Ã â€šÃ‚Â©faut = aujourd'hui)
    const dateCommande = parseDate(row.date_commande) || new Date().toISOString().split('T')[0];
    
    // Validation de la date de livraison demandÃ Æ’Ã†â€™Ã â€šÃ‚Â©e
    const dateLivraison = parseDate(row.date_livraison_demandee);
    if (dateLivraison && dateCommande) {
      if (new Date(dateLivraison) < new Date(dateCommande)) {
        rowErrors.push('La date de livraison ne peut pas Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre antÃ Æ’Ã†â€™Ã â€šÃ‚Â©rieure Ã Æ’Ã†â€™Ã â€šÃ‚Â  la date de commande');
      }
    }
    
    // Validation du poids (optionnel, positif)
    const poids = parseNumber(row.poids_grammes);
    if (poids !== null && poids <= 0) {
      rowErrors.push('Le poids doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre positif');
    }
    
    // Validation du prix unitaire (optionnel, positif)
    const prixUnitaire = parseNumber(row.prix_unitaire_kg);
    if (prixUnitaire !== null && prixUnitaire < 0) {
      rowErrors.push('Le prix unitaire doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre positif');
    }
    
    // Validation du calibre
    const calibre = cleanString(row.calibre);
    if (calibre && !CALIBRES.includes(calibre)) {
      rowErrors.push(`Calibre "${calibre}" non reconnu. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${CALIBRES.join(', ')}`);
    }
    
    // Validation de la qualitÃ Æ’Ã†â€™Ã â€šÃ‚Â©
    const qualite = cleanString(row.qualite);
    if (qualite && !QUALITES.includes(qualite)) {
      rowErrors.push(`QualitÃ Æ’Ã†â€™Ã â€šÃ‚Â© "${qualite}" non reconnue. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${QUALITES.join(', ')}`);
    }
    
    // Validation de la maturitÃ Æ’Ã†â€™Ã â€šÃ‚Â©
    const maturite = cleanString(row.maturite);
    if (maturite && !MATURITES.includes(maturite)) {
      rowErrors.push(`MaturitÃ Æ’Ã†â€™Ã â€šÃ‚Â© "${maturite}" non reconnue. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${MATURITES.join(', ')}`);
    }
    
    // Validation du statut
    const statut = cleanString(row.statut) || 'En attente';
    if (!STATUTS_COMMANDES.includes(statut)) {
      rowErrors.push(`Statut "${statut}" non reconnu. Valeurs acceptÃ Æ’Ã†â€™Ã â€šÃ‚Â©es: ${STATUTS_COMMANDES.join(', ')}`);
    }

    if (rowErrors.length > 0) {
      errors.push(`Ligne ${rowNum}: ${rowErrors.join(', ')}`);
      return;
    }

    // Calcul du montant total
    let montantTotal = parseNumber(row.montant_total);
    if (montantTotal === null && prixUnitaire !== null && poids !== null) {
      montantTotal = Math.round((prixUnitaire * poids / 1000) * 100) / 100;
    }

    validData.push({
      client_id: clientId,
      numero_commande: cleanString(row.numero_commande) || null,
      date_commande: dateCommande,
      date_livraison_demandee: dateLivraison,
      poids_grammes: poids,
      calibre: calibre || null,
      qualite: qualite || null,
      maturite: maturite || null,
      prix_unitaire_kg: prixUnitaire,
      montant_total: montantTotal,
      statut: statut,
      notes: cleanString(row.notes) || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es de types d'intervention
 * @param {Array} data - DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es CSV parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @returns {Object} { validData, errors }
 */
export const validateTypesInterventionCSV = (data) => {
  const errors = [];
  const validData = [];
  const nomsVus = new Set();

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const rowErrors = [];
    
    // Validation du nom (obligatoire et unique)
    const nom = cleanString(row.nom);
    if (!nom) {
      rowErrors.push('Le nom est obligatoire');
    } else if (nomsVus.has(nom.toLowerCase())) {
      rowErrors.push(`Le nom "${nom}" est en doublon`);
    } else {
      nomsVus.add(nom.toLowerCase());
    }
    
    // Validation de la couleur (format hex optionnel)
    const couleur = cleanString(row.couleur);
    if (couleur && !/^#[0-9A-Fa-f]{6}$/.test(couleur)) {
      rowErrors.push('La couleur doit Ã Æ’Ã†â€™Ã â€šÃ‚Âªtre au format hexadÃ Æ’Ã†â€™Ã â€šÃ‚Â©cimal (#RRGGBB)');
    }

    if (rowErrors.length > 0) {
      errors.push(`Ligne ${rowNum}: ${rowErrors.join(', ')}`);
      return;
    }

    validData.push({
      nom: nom,
      description: cleanString(row.description) || null,
      couleur: couleur || null
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es de caveurs
 * @param {Array} data - DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es CSV parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @returns {Object} { validData, errors }
 */
export const validateCaveursCSV = (data) => {
  const errors = [];
  const validData = [];
  const nomsVus = new Set();

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const rowErrors = [];
    
    // Validation du nom (obligatoire et unique)
    const nom = cleanString(row.nom);
    if (!nom) {
      rowErrors.push('Le nom est obligatoire');
    } else if (nomsVus.has(nom.toLowerCase())) {
      rowErrors.push(`Le nom "${nom}" est en doublon`);
    } else {
      nomsVus.add(nom.toLowerCase());
    }

    if (rowErrors.length > 0) {
      errors.push(`Ligne ${rowNum}: ${rowErrors.join(', ')}`);
      return;
    }

    validData.push({
      nom: nom
    });
  });

  return { validData, errors };
};

/**
 * Valide les donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es de chiens
 * @param {Array} data - DonnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es CSV parsÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @returns {Object} { validData, errors }
 */
export const validateChiensCSV = (data) => {
  const errors = [];
  const validData = [];
  const nomsVus = new Set();

  data.forEach((row, index) => {
    const rowNum = index + 2;
    const rowErrors = [];
    
    // Validation du nom (obligatoire et unique)
    const nom = cleanString(row.nom);
    if (!nom) {
      rowErrors.push('Le nom est obligatoire');
    } else if (nomsVus.has(nom.toLowerCase())) {
      rowErrors.push(`Le nom "${nom}" est en doublon`);
    } else {
      nomsVus.add(nom.toLowerCase());
    }

    if (rowErrors.length > 0) {
      errors.push(`Ligne ${rowNum}: ${rowErrors.join(', ')}`);
      return;
    }

    validData.push({
      nom: nom,
      race: cleanString(row.race) || null
    });
  });

  return { validData, errors };
};

// ============================================================================
// TEMPLATES CSV
// ============================================================================

/**
 * Templates CSV pour chaque type de donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * Avec BOM UTF-8 intÃ Æ’Ã†â€™Ã â€šÃ‚Â©grÃ Æ’Ã†â€™Ã â€šÃ‚Â© pour Excel
 */
const CSV_TEMPLATES = {
  parcelles: {
    headers: ['nom', 'surface_ha', 'type_sol', 'ph_sol', 'notes'],
    example: ['Parcelle Nord', '2.5', 'Calcaire', '7.8', 'Sud', 'PremiÃ Æ’Ã†â€™Ã â€šÃ‚Â¨re parcelle plantÃ Æ’Ã†â€™Ã â€šÃ‚Â©e'],
    description: 'Import des parcelles de la truffiÃ Æ’Ã†â€™Ã â€šÃ‚Â¨re'
  },
  
  arbres: {
    headers: ['numero', 'parcelle_nom', 'espece', 'variete_truffe', 'date_plantation', 'etat', 'circonference_cm', 'hauteur_m', 'latitude', 'longitude', 'date_derniere_taille', 'notes'],
    example: ['A001', 'Parcelle Nord', 'ChÃ Æ’Ã†â€™Ã â€šÃ‚Âªne pubescent', 'Tuber melanosporum', '2020-03-15', 'Bon', '45', '3.5', '46.5678', '1.2345', '2024-01-15', 'Premier arbre plantÃ Æ’Ã†â€™Ã â€šÃ‚Â©'],
    description: 'Import des arbres - États: Bon, Moyen, Mauvais, Mort - Associez chaque arbre Ã Æ’Ã‚Â  une parcelle existante'
  },
  
  recoltes: {
    headers: ['date_recolte', 'parcelle_nom', 'arbre_numero', 'poids_grammes', 'qualite', 'calibre', 'maturite', 'profondeur_cm', 'exposition', 'caveur', 'chien', 'conditions_meteo', 'temperature_sol', 'notes'],
    example: ['2024-12-15', 'Parcelle Nord', 'A001', '450', 'Extra', 'Moyen (20-50g)', 'Ã Æ’Ã†â€™Ã¢Ã¢â‚¬Å¡Ã‚Â¬ point', '15', 'Sud', 'Jean Dupont', 'Max', 'EnsoleillÃ Æ’Ã†â€™Ã â€šÃ‚Â©', '12.5', 'Belle rÃ Æ’Ã†â€™Ã â€šÃ‚Â©colte'],
    description: 'Import des rÃ Æ’Ã†â€™Ã â€šÃ‚Â©coltes - QualitÃ Æ’Ã†â€™Ã â€šÃ‚Â©s: Extra, PremiÃ Æ’Ã†â€™Ã â€šÃ‚Â¨re catÃ Æ’Ã†â€™Ã â€šÃ‚Â©gorie, DeuxiÃ Æ’Ã†â€™Ã â€šÃ‚Â¨me catÃ Æ’Ã†â€™Ã â€šÃ‚Â©gorie, Tout venant - Expositions: Nord, Nord-Est, Est, Sud-Est, Sud, Sud-Ouest, Ouest, Nord-Ouest'
  },
  
  clients: {
    headers: ['type', 'nom', 'prenom', 'raison_sociale', 'email', 'telephone', 'adresse', 'code_postal', 'ville', 'pays', 'siret', 'date_premier_achat', 'notes'],
    example: ['Particulier', 'Dupont', 'Jean', '', 'jean.dupont@email.com', '0601020304', '1 rue de la Truffe', '85140', 'Les Essarts', 'France', '', '2024-01-15', 'Client fidÃ Æ’Ã†â€™Ã â€šÃ‚Â¨le'],
    description: 'Import des clients - Types: Particulier, Professionnel, Restaurant, Grossiste, Exportateur'
  },
  
  ventes: {
    headers: ['date_vente', 'client_nom', 'quantite_grammes', 'prix_unitaire_kg', 'montant_total', 'mode_paiement', 'statut', 'numero_facture', 'notes'],
    example: ['2024-12-20', 'Dupont Jean', '500', '800', '', 'ChÃ Æ’Ã†â€™Ã â€šÃ‚Â¨que', 'PayÃ Æ’Ã†â€™Ã â€šÃ‚Â©e', 'F-2024-001', 'Vente directe'],
    description: 'Import des ventes - Modes de paiement: EspÃ Æ’Ã†â€™Ã â€šÃ‚Â¨ces, ChÃ Æ’Ã†â€™Ã â€šÃ‚Â¨que, Virement, Carte bancaire, PayPal'
  },
  
  interventions: {
    headers: ['type_intervention', 'parcelle_nom', 'arbre_numero', 'date_prevue', 'date_realisee', 'duree_minutes', 'personnel', 'description', 'cout', 'statut', 'meteo', 'notes'],
    example: ['Irrigation', 'Parcelle Nord', '', '2024-01-15', '2024-01-15', '120', 'Jean Dupont', 'Irrigation complÃ Æ’Ã†â€™Ã â€šÃ‚Â¨te de la parcelle', '50', 'TerminÃ Æ’Ã†â€™Ã â€šÃ‚Â©', 'EnsoleillÃ Æ’Ã†â€™Ã â€šÃ‚Â©', 'RAS'],
    description: 'Import des interventions - Statuts: PlanifiÃ Æ’Ã†â€™Ã â€šÃ‚Â©, En cours, TerminÃ Æ’Ã†â€™Ã â€šÃ‚Â©, AnnulÃ Æ’Ã†â€™Ã â€šÃ‚Â©, ReportÃ Æ’Ã†â€™Ã â€šÃ‚Â©'
  },
  
  commandes: {
    headers: ['client_nom', 'numero_commande', 'date_commande', 'date_livraison_demandee', 'poids_grammes', 'calibre', 'qualite', 'maturite', 'prix_unitaire_kg', 'montant_total', 'statut', 'notes'],
    example: ['Restaurant Le Gourmet', 'CMD-2024-001', '2024-12-01', '2024-12-15', '500', 'Moyen (20-50g)', 'Extra', 'Ã Æ’Ã†â€™Ã¢Ã¢â‚¬Å¡Ã‚Â¬ point', '850', '', 'ConfirmÃ Æ’Ã†â€™Ã â€šÃ‚Â©e', 'Livraison prioritaire'],
    description: 'Import des commandes - Statuts: En attente, ConfirmÃ Æ’Ã†â€™Ã â€šÃ‚Â©e, En prÃ Æ’Ã†â€™Ã â€šÃ‚Â©paration, LivrÃ Æ’Ã†â€™Ã â€šÃ‚Â©e, AnnulÃ Æ’Ã†â€™Ã â€šÃ‚Â©e'
  },
  
  types_intervention: {
    headers: ['nom', 'description', 'couleur'],
    example: ['Irrigation', 'Irrigation des parcelles', '#2196F3'],
    description: "Import des types d'intervention"
  },
  
  caveurs: {
    headers: ['nom'],
    example: ['Jean Dupont'],
    description: 'Import des caveurs (personnes qui rÃ Æ’Ã†â€™Ã â€šÃ‚Â©coltent les truffes)'
  },
  
  chiens: {
    headers: ['nom', 'race'],
    example: ['Max', 'Lagotto Romagnolo'],
    description: 'Import des chiens truffiers'
  }
};

/**
 * GÃ Æ’Ã†â€™Ã â€šÃ‚Â©nÃ Æ’Ã†â€™Ã â€šÃ‚Â¨re un template CSV pour un type donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©
 * @param {string} type - Type de donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @returns {string} Contenu CSV avec BOM UTF-8
 */
export const generateCSVTemplate = (type) => {
  const template = CSV_TEMPLATES[type];
  if (!template) {
    console.error(`Type de template inconnu: ${type}`);
    return '';
  }
  
  // Construction du CSV avec header et exemple
  const headerLine = template.headers.join(',');
  const exampleLine = template.example.map(val => {
    // Ã Æ’Ã†â€™Ã¢â‚¬Ã‚Â°chapper les valeurs contenant des virgules ou guillemets
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }).join(',');
  
  return `${headerLine}\n${exampleLine}`;
};

/**
 * TÃ Æ’Ã†â€™Ã â€šÃ‚Â©lÃ Æ’Ã†â€™Ã â€šÃ‚Â©charge un template CSV avec UTF-8 BOM
 * @param {string} type - Type de donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 */
export const downloadCSVTemplate = (type) => {
  const template = generateCSVTemplate(type);
  if (!template) {
    alert('Type de template non reconnu');
    return;
  }
  
  // Ajout du BOM UTF-8 pour Excel
  const csvContent = UTF8_BOM + template;
  
  // CrÃ Æ’Ã†â€™Ã â€šÃ‚Â©ation et tÃ Æ’Ã†â€™Ã â€šÃ‚Â©lÃ Æ’Ã†â€™Ã â€šÃ‚Â©chargement du fichier
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `template_${type}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // LibÃ Æ’Ã†â€™Ã â€šÃ‚Â©ration de la mÃ Æ’Ã†â€™Ã â€šÃ‚Â©moire
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Obtient la description d'un template
 * @param {string} type - Type de donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @returns {string} Description du template
 */
export const getTemplateDescription = (type) => {
  return CSV_TEMPLATES[type]?.description || '';
};

/**
 * Obtient les en-tÃ Æ’Ã†â€™Ã â€šÃ‚Âªtes d'un template
 * @param {string} type - Type de donnÃ Æ’Ã†â€™Ã â€šÃ‚Â©es
 * @returns {Array} Liste des en-tÃ Æ’Ã†â€™Ã â€šÃ‚Âªtes
 */
export const getTemplateHeaders = (type) => {
  return CSV_TEMPLATES[type]?.headers || [];
};

/**
 * Liste tous les types de templates disponibles
 * @returns {Array} Liste des types avec leurs descriptions
 */
export const listAvailableTemplates = () => {
  return Object.entries(CSV_TEMPLATES).map(([key, value]) => ({
    type: key,
    description: value.description,
    headers: value.headers
  }));
};

// ============================================================================
// EXPORT PAR DÃ Æ’Ã†â€™Ã¢â‚¬Ã‚Â°FAUT
// ============================================================================

export default {
  // Parsing
  parseCSVFile,
  
  // Validation
  validateParcellesCSV,
  validateArbresCSV,
  validateRecoltesCSV,
  validateClientsCSV,
  validateVentesCSV,
  validateInterventionsCSV,
  validateCommandesCSV,
  validateTypesInterventionCSV,
  validateCaveursCSV,
  validateChiensCSV,
  
  // Templates
  generateCSVTemplate,
  downloadCSVTemplate,
  getTemplateDescription,
  getTemplateHeaders,
  listAvailableTemplates,
  
  // Constantes
  QUALITES,
  CALIBRES,
  MATURITES,
  EXPOSITIONS,
  ETATS_ARBRES,
  STATUTS_INTERVENTIONS,
  STATUTS_VENTES,
  STATUTS_COMMANDES,
  TYPES_CLIENTS,
  MODES_PAIEMENT
};
