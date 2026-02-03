/**
 * seasonUtils.js - Utilitaires pour la gestion des saisons truffières
 * Cycle : Septembre → Mars (7 mois)
 */

export const MOIS_SAISON = [
  { nom: 'Sep', index: 9, label: 'Septembre' },
  { nom: 'Oct', index: 10, label: 'Octobre' },
  { nom: 'Nov', index: 11, label: 'Novembre' },
  { nom: 'Déc', index: 12, label: 'Décembre' },
  { nom: 'Jan', index: 1, label: 'Janvier' },
  { nom: 'Fév', index: 2, label: 'Février' },
  { nom: 'Mar', index: 3, label: 'Mars' }
];

export const SEASON_COLORS = [
  '#2c5f2d', '#4a8b4c', '#8b5a2b', '#3498db',
  '#e74c3c', '#9b59b6', '#16a085', '#f39c12'
];

export const getSeasonForDate = (date) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  if (month >= 9 && month <= 12) return `${year}-${year + 1}`;
  if (month >= 1 && month <= 3) return `${year - 1}-${year}`;
  return null;
};

export const getCurrentSeason = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 9 && month <= 12) return `${year}-${year + 1}`;
  if (month >= 1 && month <= 3) return `${year - 1}-${year}`;
  return `${year}-${year + 1}`;
};

export const getAvailableSeasons = (recoltesData) => {
  const seasons = new Set();
  recoltesData.forEach(recolte => {
    if (!recolte?.date_recolte) return;
    const season = getSeasonForDate(new Date(recolte.date_recolte));
    if (season) seasons.add(season);
  });
  return Array.from(seasons).sort().reverse();
};

export const calculateSeasonProgress = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  let monthsIntoSeason;
  if (month >= 9 && month <= 12) monthsIntoSeason = month - 8;
  else if (month >= 1 && month <= 3) monthsIntoSeason = month + 4;
  else return 0;
  const daysInMonth = new Date(now.getFullYear(), month, 0).getDate();
  const dayProgress = day / daysInMonth;
  return Math.round(((monthsIntoSeason - 1 + dayProgress) / 7) * 100);
};

export const getDaysIntoSeason = (date) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  let seasonStart;
  if (month >= 9 && month <= 12) seasonStart = new Date(year, 8, 1);
  else if (month >= 1 && month <= 3) seasonStart = new Date(year - 1, 8, 1);
  else return 0;
  return Math.floor((date - seasonStart) / (1000 * 60 * 60 * 24));
};

/**
 * Vérifie si on est actuellement en saison truffière (septembre-mars)
 * @returns {boolean} true si en saison, false si hors saison (avril-août)
 */
export const isInSeason = () => {
  const month = new Date().getMonth() + 1;
  return (month >= 9 && month <= 12) || (month >= 1 && month <= 3);
};

export const isOffSeason = () => {
  const month = new Date().getMonth() + 1;
  return month >= 4 && month <= 8;
};

export const getDaysUntilNextSeason = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  if (month >= 4 && month <= 8) {
    const nextStart = new Date(now.getFullYear(), 8, 1);
    return Math.ceil((nextStart - now) / (1000 * 60 * 60 * 24));
  }
  return 0;
};

export const getLastCompleteSeason = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 4 && month <= 8) return `${year - 1}-${year}`;
  if (month >= 9 && month <= 12) return `${year - 1}-${year}`;
  return `${year - 2}-${year - 1}`;
};

export const isInTruffleSeason = (date) => {
  const month = date.getMonth() + 1;
  return (month >= 9 && month <= 12) || (month >= 1 && month <= 3);
};

export const filterRecoltesBySeason = (recoltesData, season) => {
  const [yearStart, yearEnd] = season.split('-').map(Number);
  return recoltesData.filter(recolte => {
    if (!recolte?.date_recolte) return false;
    const date = new Date(recolte.date_recolte);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return (month >= 9 && month <= 12 && year === yearStart) ||
           (month >= 1 && month <= 3 && year === yearEnd);
  });
};

export const compareSeasonsSamePeriod = (recoltesData, currentSeason, previousSeason) => {
  const now = new Date();
  const currentDaysIntoSeason = getDaysIntoSeason(now);
  
  const currentRecoltes = filterRecoltesBySeason(recoltesData, currentSeason)
    .filter(r => getDaysIntoSeason(new Date(r.date_recolte)) <= currentDaysIntoSeason);
  
  const previousRecoltes = filterRecoltesBySeason(recoltesData, previousSeason)
    .filter(r => getDaysIntoSeason(new Date(r.date_recolte)) <= currentDaysIntoSeason);
  
  const currentProduction = currentRecoltes.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0) / 1000;
  const previousProduction = previousRecoltes.reduce((sum, r) => sum + parseFloat(r.poids_grammes || 0), 0) / 1000;
  const difference = currentProduction - previousProduction;
  const percentChange = previousProduction > 0 ? (difference / previousProduction) * 100 : 0;
  
  return {
    currentProduction: currentProduction.toFixed(2),
    previousProduction: previousProduction.toFixed(2),
    difference: difference.toFixed(2),
    percentChange: percentChange.toFixed(1),
    trend: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'stable'
  };
};

export const detectIncompleteSeason = (season, recoltesData) => {
  const recoltesBySeason = filterRecoltesBySeason(recoltesData, season);
  if (recoltesBySeason.length === 0) {
    return { isComplete: false, coverage: 0, missingMonths: [9,10,11,12,1,2,3], hasData: false, monthsPresent: [] };
  }
  const monthsCovered = new Set(recoltesBySeason.map(r => new Date(r.date_recolte).getMonth() + 1));
  const expectedMonths = [9, 10, 11, 12, 1, 2, 3];
  const missingMonths = expectedMonths.filter(m => !monthsCovered.has(m));
  const coverage = ((7 - missingMonths.length) / 7 * 100);
  const orderMap = { 9:1, 10:2, 11:3, 12:4, 1:5, 2:6, 3:7 };
  const monthsPresent = Array.from(monthsCovered).sort((a, b) => orderMap[a] - orderMap[b]);
  return { isComplete: missingMonths.length === 0, coverage: coverage.toFixed(0), missingMonths, hasData: true, monthsPresent };
};

export const formatSeasonLabel = (season, completenessInfo) => {
  if (!completenessInfo.hasData) return `${season} (Aucune donnée)`;
  if (completenessInfo.isComplete) return season;
  const monthNames = { 1:'Jan', 2:'Fév', 3:'Mar', 9:'Sep', 10:'Oct', 11:'Nov', 12:'Déc' };
  const presentMonthsStr = completenessInfo.monthsPresent.map(m => monthNames[m]).join(', ');
  return `${season} ⚠️ (${completenessInfo.coverage}% - ${presentMonthsStr})`;
};

export const getSeasonColor = (season, availableSeasons) => {
  const index = availableSeasons.indexOf(season);
  return SEASON_COLORS[index % SEASON_COLORS.length];
};

export const formatSeasonDate = (date) => {
  const day = date.getDate();
  const monthNames = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
  return `${day} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

export const getProgressLabel = (progress) => {
  if (progress < 20) return "Début de saison";
  if (progress < 40) return "Début-milieu";
  if (progress < 60) return "Mi-saison";
  if (progress < 80) return "Fin-milieu";
  return "Fin de saison";
};

export const isValidSeasonFormat = (season) => {
  if (typeof season !== 'string') return false;
  const parts = season.split('-');
  if (parts.length !== 2) return false;
  const [yearStart, yearEnd] = parts.map(y => parseInt(y, 10));
  return !isNaN(yearStart) && !isNaN(yearEnd) && yearEnd === yearStart + 1;
};

/**
 * Obtient les dates de début et fin de la prochaine saison
 * @returns {Object} { start: Date, end: Date }
 */
export const getNextSeasonDates = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  if (month >= 4 && month <= 8) {
    // Hors saison : prochaine saison commence en septembre
    return {
      start: new Date(year, 8, 1), // 1er septembre
      end: new Date(year + 1, 2, 31) // 31 mars année suivante
    };
  } else {
    // En saison : prochaine saison sera l'année suivante
    return {
      start: new Date(year + 1, 8, 1),
      end: new Date(year + 2, 2, 31)
    };
  }
};

/**
 * Obtient un récapitulatif de la dernière saison complète
 * @param {Array} recoltesData - Données des récoltes
 * @returns {Object} Stats de la dernière saison
 */
export const getLastSeasonSummary = (recoltesData) => {
  const lastSeason = getLastCompleteSeason();
  const seasonRecoltes = filterRecoltesBySeason(recoltesData, lastSeason);
  
  if (seasonRecoltes.length === 0) {
    return null;
  }
  
  const totalProduction = seasonRecoltes.reduce((sum, r) => 
    sum + parseFloat(r.poids_grammes || 0), 0
  ) / 1000;
  
  return {
    season: lastSeason,
    production: totalProduction.toFixed(2),
    count: seasonRecoltes.length,
    averagePerRecolte: (totalProduction * 1000 / seasonRecoltes.length).toFixed(0)
  };
};

/**
 * Trouve la meilleure saison historique (production maximale)
 * @param {Array} recoltesData - Données des récoltes
 * @returns {Object|null} Informations sur la meilleure saison
 */
export const getBestPastSeason = (recoltesData) => {
  const seasons = getAvailableSeasons(recoltesData);
  
  if (seasons.length === 0) return null;
  
  let bestSeason = null;
  let maxProduction = 0;
  
  seasons.forEach(season => {
    const seasonRecoltes = filterRecoltesBySeason(recoltesData, season);
    const production = seasonRecoltes.reduce((sum, r) => 
      sum + parseFloat(r.poids_grammes || 0), 0
    ) / 1000;
    
    if (production > maxProduction) {
      maxProduction = production;
      bestSeason = {
        season,
        production: production.toFixed(2),
        count: seasonRecoltes.length
      };
    }
  });
  
  return bestSeason;
};

// ✅ Export nommé pour respecter la règle ESLint
const seasonUtils = {
  MOIS_SAISON, 
  SEASON_COLORS,
  getSeasonForDate, 
  getCurrentSeason, 
  getAvailableSeasons,
  calculateSeasonProgress, 
  getDaysIntoSeason,
  isInSeason, 
  isOffSeason, 
  getDaysUntilNextSeason, 
  getLastCompleteSeason,
  isInTruffleSeason, 
  filterRecoltesBySeason, 
  compareSeasonsSamePeriod,
  detectIncompleteSeason, 
  formatSeasonLabel,
  getSeasonColor, 
  formatSeasonDate, 
  getProgressLabel, 
  isValidSeasonFormat,
  getNextSeasonDates, 
  getLastSeasonSummary, 
  getBestPastSeason
};

export default seasonUtils;

