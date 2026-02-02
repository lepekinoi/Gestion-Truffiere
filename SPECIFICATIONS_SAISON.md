# Spécifications - Vue Saisonnière de la Culture des Truffes

## 📋 Vue d'ensemble

### Objectif
Adapter l'application Gestion Truffière pour afficher les données selon le **cycle naturel de la truffe** (septembre à mars) plutôt que l'année civile (janvier à décembre).

### Contexte
La culture de la truffe suit un cycle saisonnier qui commence en septembre et se termine en mars. L'exploitant souhaite comparer les performances d'une saison à l'autre (ex: saison 2024-2025 vs 2023-2024) plutôt que par année civile.

### Portée des modifications
- **Dashboard.js** : Vue principale avec statistiques et graphiques
- **Statistiques.js** : Analyses détaillées et exports
- **src/utils/seasonUtils.js** : Fonctions utilitaires (nouveau fichier)
- **API Backend** : Ajout d'endpoints si nécessaire

---

## 🎯 Fonctionnalités à implémenter

### 1. Toggle Mode d'Affichage

#### Description
Bouton de bascule permettant à l'utilisateur de choisir entre :
- **Mode Année Civile** : Janvier → Décembre (existant)
- **Mode Saison Truffière** : Septembre → Mars (nouveau)

#### Emplacement
En haut du Dashboard, avant les KPIs

#### Design
```
┌────────────────────────────────────────────────┐
│  Vue : [📅 Année civile] [🍄 Saison truffière] │
└────────────────────────────────────────────────┘
```

#### State Management
```javascript
const [displayMode, setDisplayMode] = useState('saison'); // 'saison' | 'annee'
```

#### Persistance
- Sauvegarder le choix dans `localStorage`
- Restaurer au chargement de la page

---

### 2. Calcul de la Saison Actuelle

#### Définition d'une Saison
Une saison truffière s'étend sur 7 mois :
- **Septembre** (début)
- Octobre, Novembre, Décembre
- Janvier, Février, Mars (fin)
- **Avril à Août** : Hors saison

#### Nomenclature
Format : `YYYY-YYYY` (année de début - année de fin)
- Exemple : `2024-2025` = Sep 2024 → Mar 2025

#### Logique de calcul
```javascript
const getCurrentSeason = () => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  
  if (month >= 9 && month <= 12) {
    // Sep-Déc : saison année_actuelle → année_suivante
    return `${year}-${year + 1}`;
  } else if (month >= 1 && month <= 3) {
    // Jan-Mar : saison année_précédente → année_actuelle
    return `${year - 1}-${year}`;
  } else {
    // Avr-Aoû : hors saison, on considère la prochaine saison
    return `${year}-${year + 1}`;
  }
};
```

#### Extraction des saisons disponibles
```javascript
const getAvailableSeasons = (recoltesData) => {
  const seasons = new Set();
  
  recoltesData.forEach(recolte => {
    if (!recolte.date_recolte) return;
    
    const date = new Date(recolte.date_recolte);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    if (month >= 9 && month <= 12) {
      seasons.add(`${year}-${year + 1}`);
    } else if (month >= 1 && month <= 3) {
      seasons.add(`${year - 1}-${year}`);
    }
  });
  
  return Array.from(seasons).sort().reverse(); // Plus récent en premier
};
```

---

### 3. ⚠️ Gestion Période Hors Saison (Avril-Août) ⭐ NOUVEAU

#### Problématique
Entre avril et août, il n'y a pas de récolte. L'expérience utilisateur doit être adaptée.

#### Solution
Afficher un widget spécifique "Hors Saison" avec :
- Message informatif
- Statistiques de la dernière saison complète
- Compte à rebours jusqu'à la prochaine saison

#### Design du Widget Hors Saison
```
┌──────────────────────────────────────────────────────────┐
│ 🌱 Période Hors Saison                                       │
│                                                           │
│ Prochaine saison : Septembre 2026                         │
│ Début dans : 42 jours                                      │
│                                                           │
│ 📊 Dernière saison (2025-2026)                           │
│ Production : 48.5 kg | 132 récoltes                        │
└──────────────────────────────────────────────────────────┘
```

#### Implémentation
```javascript
/**
 * Vérifie si on est en période hors saison
 * @returns {boolean}
 */
export const isOffSeason = () => {
  const month = new Date().getMonth() + 1;
  return month >= 4 && month <= 8;
};

/**
 * Calcule le nombre de jours jusqu'à la prochaine saison
 * @returns {number} Nombre de jours
 */
export const getDaysUntilNextSeason = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  if (month >= 4 && month <= 8) {
    // Prochaine saison commence en septembre
    const nextSeasonStart = new Date(year, 8, 1); // Mois 8 = septembre (0-indexé)
    const diffTime = nextSeasonStart - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  return 0; // En saison
};

/**
 * Obtient la dernière saison complète
 * @returns {string} Saison au format "YYYY-YYYY"
 */
export const getLastCompleteSeason = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  if (month >= 4 && month <= 8) {
    // Dernière saison complète : année précédente
    return `${year - 1}-${year}`;
  } else if (month >= 9) {
    // En cours : dernière complète est l'année précédente
    return `${year - 1}-${year}`;
  } else {
    // Jan-Mars : dernière complète = 2 ans avant
    return `${year - 2}-${year - 1}`;
  }
};
```

---

### 4. Widget "Saison en Cours" (Dashboard)

#### Description
Bannière visuelle affichant les statistiques de la saison truffière en cours.

#### Emplacement
Après la bannière Patrimoine, avant la météo

#### Contenu
- **Nom de la saison** : "Saison Truffière 2024-2025"
- **Production totale** : X.XX kg
- **Nombre de récoltes** : N récoltes
- **Progression** : X% (avancement dans la saison)
- **Barre de progression visuelle**
- **⭐ NOUVEAU : Comparaison même période**

#### Design
```
┌──────────────────────────────────────────────────────────┐
│ 🍄 Saison Truffière 2024-2025                            │
│                                                           │
│ Production      Récoltes        Progression              │
│ 45.32 kg        127            71% ███████░░░             │
│ ↗️ +8.3% vs même période saison dernière (41.8 kg)        │
└──────────────────────────────────────────────────────────┘
```

#### ⭐ Comparaison Même Période (NOUVEAU)

**Problématique** : Comparer une saison en cours avec une saison complète n'est pas juste.

**Solution** : Comparer jusqu'au même point d'avancement.

**Exemple** : Si on est le 15 janvier 2025 (à 71% de la saison 2024-2025):
- Comparer Sep 2024 → mi-janvier 2025
- Avec Sep 2023 → mi-janvier 2024 (même % d'avancement)

#### Implémentation
```javascript
/**
 * Calcule le nombre de jours écoulés depuis le début de la saison
 * @param {Date} date - Date à évaluer
 * @returns {number} Nombre de jours
 */
export const getDaysIntoSeason = (date) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  let seasonStart;
  if (month >= 9 && month <= 12) {
    seasonStart = new Date(year, 8, 1); // 1er septembre
  } else if (month >= 1 && month <= 3) {
    seasonStart = new Date(year - 1, 8, 1); // 1er septembre année précédente
  } else {
    return 0; // Hors saison
  }
  
  const diffTime = date - seasonStart;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Compare deux saisons jusqu'à la même période
 * @param {Array} recoltesData - Toutes les récoltes
 * @param {string} currentSeason - Saison actuelle (ex: "2024-2025")
 * @param {string} previousSeason - Saison précédente (ex: "2023-2024")
 * @returns {Object} Comparaison
 */
export const compareSeasonsSamePeriod = (recoltesData, currentSeason, previousSeason) => {
  const now = new Date();
  const currentDaysIntoSeason = getDaysIntoSeason(now);
  
  // Filtrer les récoltes de la saison actuelle jusqu'à aujourd'hui
  const currentRecoltes = filterRecoltesBySeason(recoltesData, currentSeason)
    .filter(r => getDaysIntoSeason(new Date(r.date_recolte)) <= currentDaysIntoSeason);
  
  // Filtrer les récoltes de la saison précédente jusqu'au même point
  const previousRecoltes = filterRecoltesBySeason(recoltesData, previousSeason)
    .filter(r => getDaysIntoSeason(new Date(r.date_recolte)) <= currentDaysIntoSeason);
  
  const currentProduction = currentRecoltes.reduce((sum, r) => 
    sum + parseFloat(r.poids_grammes || 0), 0
  ) / 1000; // kg
  
  const previousProduction = previousRecoltes.reduce((sum, r) => 
    sum + parseFloat(r.poids_grammes || 0), 0
  ) / 1000; // kg
  
  const difference = currentProduction - previousProduction;
  const percentChange = previousProduction > 0 
    ? (difference / previousProduction) * 100 
    : 0;
  
  return {
    currentProduction: currentProduction.toFixed(2),
    previousProduction: previousProduction.toFixed(2),
    difference: difference.toFixed(2),
    percentChange: percentChange.toFixed(1),
    trend: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'stable'
  };
};
```

#### Calcul de la progression
```javascript
const calculateSeasonProgress = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  
  let monthsIntoSeason;
  
  if (month >= 9) {
    // Septembre = mois 1, Octobre = mois 2, etc.
    monthsIntoSeason = month - 8;
  } else if (month <= 3) {
    // Janvier = mois 5, Février = mois 6, Mars = mois 7
    monthsIntoSeason = month + 4;
  } else {
    // Hors saison
    return 0;
  }
  
  // Ajouter les jours pour plus de précision
  const daysInMonth = new Date(now.getFullYear(), month, 0).getDate();
  const dayProgress = day / daysInMonth;
  
  return Math.round(((monthsIntoSeason - 1 + dayProgress) / 7) * 100);
};
```

---

### 5. 🔍 Détection des Saisons Incomplètes ⭐ NOUVEAU

#### Problématique
Si les données commencent en janvier 2023, la saison 2022-2023 est incomplète (pas de sep-déc 2022).

#### Solution
Marquer visuellement les saisons incomplètes et afficher le taux de couverture.

#### Implémentation
```javascript
/**
 * Détecte si une saison a des données incomplètes
 * @param {string} season - Saison au format "YYYY-YYYY"
 * @param {Array} recoltesData - Tableau des récoltes
 * @returns {Object} Informations sur la complétude
 */
export const detectIncompleteSeason = (season, recoltesData) => {
  const recoltesBySeason = filterRecoltesBySeason(recoltesData, season);
  
  if (recoltesBySeason.length === 0) {
    return {
      isComplete: false,
      coverage: 0,
      missingMonths: [9, 10, 11, 12, 1, 2, 3],
      hasData: false
    };
  }
  
  const monthsCovered = new Set(
    recoltesBySeason.map(r => new Date(r.date_recolte).getMonth() + 1)
  );
  
  const expectedMonths = [9, 10, 11, 12, 1, 2, 3];
  const missingMonths = expectedMonths.filter(m => !monthsCovered.has(m));
  
  const coverage = ((7 - missingMonths.length) / 7 * 100);
  
  return {
    isComplete: missingMonths.length === 0,
    coverage: coverage.toFixed(0),
    missingMonths,
    hasData: true,
    monthsPresent: Array.from(monthsCovered).sort((a, b) => {
      // Trier dans l'ordre de la saison (Sep-Mar)
      const orderMap = { 9: 1, 10: 2, 11: 3, 12: 4, 1: 5, 2: 6, 3: 7 };
      return orderMap[a] - orderMap[b];
    })
  };
};

/**
 * Formate l'affichage d'une saison avec indicateur de complétude
 * @param {string} season
 * @param {Object} completenessInfo
 * @returns {string}
 */
export const formatSeasonLabel = (season, completenessInfo) => {
  if (!completenessInfo.hasData) {
    return `${season} (Aucune donnée)`;
  }
  
  if (completenessInfo.isComplete) {
    return season;
  }
  
  const monthNames = {
    1: 'Jan', 2: 'Fév', 3: 'Mar',
    9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Déc'
  };
  
  const presentMonthsStr = completenessInfo.monthsPresent
    .map(m => monthNames[m])
    .join(', ');
  
  return `${season} ⚠️ (${completenessInfo.coverage}% - ${presentMonthsStr})`;
};
```

#### Affichage dans l'interface
```javascript
// Dans le sélecteur de saisons
{availableSeasons.map(season => {
  const completeness = detectIncompleteSeason(season, recoltesData);
  const label = formatSeasonLabel(season, completeness);
  const isIncomplete = !completeness.isComplete && completeness.hasData;
  
  return (
    <button
      key={season}
      style={{
        opacity: isIncomplete ? 0.7 : 1,
        border: isIncomplete ? '2px dashed #f39c12' : '2px solid transparent'
      }}
      title={isIncomplete ? `Données partielles : ${completeness.coverage}% de couverture` : ''}
    >
      {label}
    </button>
  );
})}
```

---

### 6. Graphique Comparaison Multi-Saisons

#### Description
Graphique en courbes comparant la production mensuelle de plusieurs saisons truffières.

#### Emplacement
Section "Graphiques" du Dashboard, remplace ou complète le graphique multi-années existant

#### Axe X : Mois de la saison
```javascript
const MOIS_SAISON = [
  { nom: 'Sep', index: 9, label: 'Septembre' },
  { nom: 'Oct', index: 10, label: 'Octobre' },
  { nom: 'Nov', index: 11, label: 'Novembre' },
  { nom: 'Déc', index: 12, label: 'Décembre' },
  { nom: 'Jan', index: 1, label: 'Janvier' },
  { nom: 'Fév', index: 2, label: 'Février' },
  { nom: 'Mar', index: 3, label: 'Mars' }
];
```

#### Axe Y : Production en kg

#### Données
Une courbe par saison sélectionnée (ex: 2024-2025, 2023-2024, 2022-2023)

#### Interactions
- **Sélection des saisons** : Boutons toggle pour afficher/masquer chaque saison
- **Couleurs** : Palette cohérente (même logique que le graphique multi-années actuel)
- **Tooltip** : Affiche saison, mois, production au survol

#### ⭐ Fonction de formatage optimisée (NOUVEAU)
```javascript
/**
 * Formate les données pour le graphique de comparaison multi-saisons
 * Optimisé avec useMemo
 */
const formatSeasonComparisonData = useMemo(() => {
  if (!recolteMensuellesBrutes || selectedSeasons.length === 0) {
    return [];
  }
  
  const data = MOIS_SAISON.map(({ nom, index }) => ({ 
    mois: nom, 
    monthIndex: index 
  }));
  
  selectedSeasons.forEach(season => {
    const [yearStart, yearEnd] = season.split('-').map(Number);
    
    recolteMensuellesBrutes.forEach(item => {
      if (!item || !item.mois) return;
      
      const [year, month] = item.mois.split('-').map(Number);
      const production = parseFloat((item.total_grammes / 1000).toFixed(2));
      
      // Déterminer si ce mois appartient à cette saison
      let belongsToSeason = false;
      if (month >= 9 && month <= 12 && year === yearStart) {
        belongsToSeason = true;
      } else if (month >= 1 && month <= 3 && year === yearEnd) {
        belongsToSeason = true;
      }
      
      if (belongsToSeason) {
        const dataIndex = MOIS_SAISON.findIndex(m => m.index === month);
        if (dataIndex !== -1) {
          data[dataIndex][season] = production;
        }
      }
    });
    
    // Remplir les mois manquants avec 0
    MOIS_SAISON.forEach((_, idx) => {
      if (!data[idx][season]) {
        data[idx][season] = 0;
      }
    });
  });
  
  return data;
}, [recolteMensuellesBrutes, selectedSeasons]); // ⭐ useMemo pour optimisation
```

---

### 7. KPIs Saisonniers

#### Nouveaux KPIs
Ajouter dans la section KPIs du Dashboard (mode saison uniquement) :

1. **Production Saison en Cours**
   - Valeur : X.XX kg
   - Comparaison : +/- X% vs même période saison précédente ⭐
   - Icône : 🍄

2. **Moyenne par Récolte (Saison)**
   - Valeur : XXX g
   - Comparaison : +/- X% vs saison précédente
   - Icône : ⚖️

3. **Meilleur Mois de la Saison**
   - Valeur : Nom du mois + production
   - Exemple : "Décembre (12.5 kg)"
   - Icône : 🏆

#### Calcul des KPIs (optimisé avec useMemo)
```javascript
const seasonKPIs = useMemo(() => {
  if (!recoltesData || !currentSeason) return null;
  
  const [yearStart, yearEnd] = currentSeason.split('-').map(Number);
  
  // Filtrer les récoltes de la saison actuelle
  const seasonRecoltes = recoltesData.filter(r => {
    if (!r.date_recolte) return false;
    const date = new Date(r.date_recolte);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    return (month >= 9 && month <= 12 && year === yearStart) ||
           (month >= 1 && month <= 3 && year === yearEnd);
  });
  
  const totalProduction = seasonRecoltes.reduce((sum, r) => 
    sum + parseFloat(r.poids_grammes || 0), 0
  );
  
  const nbRecoltes = seasonRecoltes.length;
  const moyenneParRecolte = nbRecoltes > 0 ? totalProduction / nbRecoltes : 0;
  
  // Trouver le meilleur mois
  const prodParMois = {};
  seasonRecoltes.forEach(r => {
    const month = new Date(r.date_recolte).getMonth() + 1;
    const moisNom = MOIS_SAISON.find(m => m.index === month)?.label || 'Inconnu';
    prodParMois[moisNom] = (prodParMois[moisNom] || 0) + parseFloat(r.poids_grammes || 0);
  });
  
  const meilleurMois = Object.entries(prodParMois)
    .sort((a, b) => b[1] - a[1])[0];
  
  // ⭐ Comparaison avec même période saison précédente
  const previousSeason = `${yearStart - 1}-${yearEnd - 1}`;
  const comparison = compareSeasonsSamePeriod(recoltesData, currentSeason, previousSeason);
  
  return {
    saison: currentSeason,
    totalProduction: totalProduction / 1000, // kg
    nbRecoltes,
    moyenneParRecolte: moyenneParRecolte.toFixed(0), // g
    meilleurMois: meilleurMois ? {
      nom: meilleurMois[0],
      production: (meilleurMois[1] / 1000).toFixed(2) // kg
    } : null,
    comparison // ⭐ Comparaison même période
  };
}, [recoltesData, currentSeason]); // ⭐ useMemo pour optimisation
```

---

### 8. Production par Parcelle (Vue Saisonnière)

#### Modification du tableau existant
Ajouter une colonne "Saison" et adapter le filtrage

#### Structure
```
┌──────────┬─────────┬─────────────┬────────────┬──────────────┐
│ Parcelle │ Saison  │ Nb récoltes │ Production │ Poids moyen  │
├──────────┼─────────┼─────────────┼────────────┼──────────────┤
│ Parcelle1│2024-2025│     45      │  12.5 kg   │    278 g     │
│ Parcelle1│2023-2024│     38      │  10.2 kg   │    268 g     │
└──────────┴─────────┴─────────────┴────────────┴──────────────┘
```

#### Calcul (optimisé avec useMemo)
```javascript
const productionParParcelle = useMemo(() => {
  if (!recoltesData || selectedSeasons.length === 0) return [];
  
  const prodParParcelle = {};
  
  recoltesData.forEach(recolte => {
    if (!recolte || !recolte.date_recolte) return;
    
    const parcelle = recolte.parcelle_nom || 'Non défini';
    const date = new Date(recolte.date_recolte);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const poids = parseFloat(recolte.poids_grammes || 0);
    
    // Déterminer la saison
    let season;
    if (month >= 9 && month <= 12) {
      season = `${year}-${year + 1}`;
    } else if (month >= 1 && month <= 3) {
      season = `${year - 1}-${year}`;
    } else {
      return; // Hors saison
    }
    
    // Filtrer selon les saisons sélectionnées
    if (!selectedSeasons.includes(season)) return;
    
    const key = `${parcelle}_${season}`;
    if (!prodParParcelle[key]) {
      prodParParcelle[key] = {
        parcelle,
        saison: season,
        nbRecoltes: 0,
        production: 0
      };
    }
    
    prodParParcelle[key].nbRecoltes += 1;
    prodParParcelle[key].production += poids / 1000; // kg
  });
  
  return Object.values(prodParParcelle)
    .map(p => ({
      ...p,
      moyenneGrammes: p.nbRecoltes > 0 ? (p.production * 1000 / p.nbRecoltes).toFixed(0) : 0
    }))
    .sort((a, b) => {
      // Trier par saison (desc) puis par production (desc)
      if (a.saison !== b.saison) return b.saison.localeCompare(a.saison);
      return b.production - a.production;
    });
}, [recoltesData, selectedSeasons]); // ⭐ useMemo pour optimisation
```

---

### 9. Nouvel Onglet "Saisons" dans Statistiques.js

#### Description
Ajouter un onglet dédié aux analyses saisonnières

#### Structure de la vue

##### A. Sélection des saisons
Boutons toggle pour chaque saison disponible (même pattern que le multi-années actuel)

##### B. Graphique comparatif
Graphique en courbes (LineChart) montrant l'évolution mensuelle de plusieurs saisons

##### C. Tableau récapitulatif
```
┌──────────┬────────────┬─────────────┬────────────────────┬──────────────┐
│  Saison  │ Production │ Nb récoltes │ Mois le + productif│ Moyenne/rco  │
├──────────┼────────────┼─────────────┼────────────────────┼──────────────┤
│2024-2025 │  45.32 kg  │     127     │  Décembre (12.5kg) │    357 g     │
│2023-2024 │  38.67 kg  │     115     │  Janvier (10.8kg)  │    336 g     │
│2022-2023 │  42.15 kg  │     108     │  Décembre (11.2kg) │    390 g     │
└──────────┴────────────┴─────────────┴────────────────────┴──────────────┘
```

##### D. Statistiques agrégées
- **Meilleure saison** : Nom + production
- **Moyenne toutes saisons** : X.XX kg
- **Tendance** : Graphique sparkline ou flèche ↗️↘️➡️
- **Mois globalement le plus productif** : Analyse sur toutes les saisons

---

## 🔧 Modifications Techniques

### States à ajouter

#### Dashboard.js
```javascript
// Mode d'affichage
const [displayMode, setDisplayMode] = useState(() => {
  return localStorage.getItem('displayMode') || 'saison';
});

// Saisons
const [currentSeason, setCurrentSeason] = useState('');
const [availableSeasons, setAvailableSeasons] = useState([]);
const [selectedSeasons, setSelectedSeasons] = useState([]);
const [isOffSeason, setIsOffSeason] = useState(false); // ⭐ NOUVEAU

// KPIs optimisés avec useMemo ⭐
const seasonKPIs = useMemo(() => calculateSeasonKPIs(recoltesData, currentSeason), 
  [recoltesData, currentSeason]
);
```

#### Statistiques.js
```javascript
// Ajouter dans les views existantes
const [selectedView, setSelectedView] = useState('dashboard'); 
// Ajouter 'saisons' comme option

// Stats saisonnières optimisées ⭐
const seasonsSummary = useMemo(() => calculateSeasonsSummary(recoltesData, selectedSeasons),
  [recoltesData, selectedSeasons]
);
```

### ⭐ Optimisations Performance (NOUVEAU)

#### Utilisation systématique de useMemo
```javascript
import { useMemo } from 'react';

// Exemple : Calculs lourds mémoïsés
const seasonData = useMemo(() => {
  return formatSeasonComparisonData(recolteMensuellesBrutes, selectedSeasons);
}, [recolteMensuellesBrutes, selectedSeasons]);

const productionStats = useMemo(() => {
  return calculateProductionStats(recoltesData, currentSeason);
}, [recoltesData, currentSeason]);
```

#### Lazy Loading des saisons
```javascript
// Charger les saisons de manière incrémentale
const [visibleSeasons, setVisibleSeasons] = useState(3); // Afficher 3 saisons par défaut

const loadMoreSeasons = () => {
  setVisibleSeasons(prev => Math.min(prev + 3, availableSeasons.length));
};
```

---

## 🎨 Design & UX

### Palette de couleurs pour les saisons
```javascript
const SEASON_COLORS = [
  '#2c5f2d', // Vert foncé - Saison la plus récente
  '#4a8b4c', // Vert moyen
  '#8b5a2b', // Brun
  '#3498db', // Bleu
  '#e74c3c', // Rouge
  '#9b59b6', // Violet
  '#16a085', // Turquoise
  '#f39c12'  // Orange
];

const getSeasonColor = (season, availableSeasons) => {
  const index = availableSeasons.indexOf(season);
  return SEASON_COLORS[index % SEASON_COLORS.length];
};
```

### Responsive Design
- **Desktop** : Affichage complet avec tous les graphiques
- **Tablet** : Graphiques en grille 2 colonnes
- **Mobile** : Graphiques en colonne unique, toggle en liste déroulante

### Transitions
- Transition fluide lors du changement de mode (année ↔ saison)
- Animation de la barre de progression de saison
- Effet de survol sur les boutons de sélection

---

## ✅ Checklist d'implémentation

### Phase 1 : Fondations (Priorité haute) ⭐
- [x] Créer `src/utils/seasonUtils.js` avec toutes les fonctions utilitaires
- [ ] Ajouter les states dans `Dashboard.js`
- [ ] Implémenter le toggle Mode Affichage
- [x] Implémenter `getCurrentSeason()` et `getAvailableSeasons()`
- [ ] Implémenter `isOffSeason()` et `getDaysUntilNextSeason()` ⭐
- [ ] Implémenter `detectIncompleteSeason()` ⭐
- [ ] Implémenter `compareSeasonsSamePeriod()` ⭐
- [ ] Tester la logique de calcul de saison

### Phase 2 : Dashboard (Priorité haute)
- [ ] Créer le composant `SeasonWidget` avec comparaison même période ⭐
- [ ] Créer le composant `OffSeasonWidget` ⭐
- [ ] Implémenter `calculateSeasonKPIs()` avec useMemo ⭐
- [ ] Adapter le graphique de comparaison pour le mode saison
- [ ] Implémenter `formatSeasonComparisonData()` avec useMemo ⭐
- [ ] Ajouter la sélection/désélection des saisons avec marquage des incomplètes ⭐
- [ ] Adapter le tableau "Production par Parcelle" pour les saisons

### Phase 3 : Statistiques (Priorité moyenne)
- [ ] Ajouter l'onglet "Saisons" dans la navigation
- [ ] Implémenter le graphique de comparaison multi-saisons avec useMemo ⭐
- [ ] Créer le tableau récapitulatif des saisons
- [ ] Calculer les statistiques agrégées (meilleure saison, moyenne, etc.)
- [ ] Implémenter la fonction `calculateSeasonsSummary()` avec useMemo ⭐

### Phase 4 : Optimisations (Priorité haute) ⭐
- [ ] Appliquer useMemo sur tous les calculs lourds
- [ ] Persistance du mode d'affichage dans localStorage
- [ ] Lazy loading des saisons anciennes
- [ ] Ajouter des animations de transition

### Phase 5 : Tests & Documentation (Priorité haute)
- [ ] Tests unitaires pour `seasonUtils.js`
- [ ] Tests pour `compareSeasonsSamePeriod()` ⭐
- [ ] Tests pour `detectIncompleteSeason()` ⭐
- [ ] Tests d'intégration Dashboard mode saison
- [ ] Tests d'intégration Statistiques onglet Saisons
- [ ] Documenter l'utilisation dans le README
- [ ] Mettre à jour le CHANGELOG

---

## 📝 Tests à effectuer

### Tests fonctionnels

#### Test 1 : Calcul de saison
```javascript
// Septembre 2024 → "2024-2025"
getSeasonForDate(new Date('2024-09-15')) === '2024-2025'

// Janvier 2025 → "2024-2025"
getSeasonForDate(new Date('2025-01-15')) === '2024-2025'

// Mars 2025 → "2024-2025"
getSeasonForDate(new Date('2025-03-31')) === '2024-2025'

// Avril 2025 → null (hors saison)
getSeasonForDate(new Date('2025-04-01')) === null
```

#### Test 2 : Progression de saison
```javascript
// 15 septembre → ~2% (début)
// 31 décembre → ~57% (4 mois)
// 15 janvier → ~64% (milieu mois 5)
// 31 mars → 100% (fin)
```

#### Test 3 : Comparaison même période ⭐
```javascript
// Au 15 janvier 2025 (71% de la saison)
const comparison = compareSeasonsSamePeriod(data, '2024-2025', '2023-2024');
// Doit comparer Sep 2024-mi Jan 2025 avec Sep 2023-mi Jan 2024
// Exclure fin janvier-mars 2024
```

#### Test 4 : Détection saisons incomplètes ⭐
```javascript
const info = detectIncompleteSeason('2022-2023', data);
// Si première récolte = 15 jan 2023
// isComplete = false
// coverage = "43" (3 mois sur 7)
// missingMonths = [9, 10, 11, 12]
```

#### Test 5 : Période hors saison ⭐
```javascript
// En mai 2025
isOffSeason() === true
getDaysUntilNextSeason() > 0 // Nombre de jours jusqu'au 1er septembre
getLastCompleteSeason() === '2024-2025'
```

---

## 🚀 Déploiement

### Prérequis
- Branche `V7` à jour
- Tests passés
- Code review effectué
- Tests de performance validés ⭐

### Étapes
1. Merger `V7-Saison` dans `V7`
2. Déployer sur environnement de staging
3. Tests utilisateur
4. Déploiement production
5. Monitoring des performances

### Rollback
En cas de problème, le mode "Année civile" reste fonctionnel tel qu'avant.

---

## 📚 Ressources

### Documentation
- [Recharts - Documentation](https://recharts.org/)
- [React Hooks - useMemo](https://react.dev/reference/react/useMemo)
- [Date manipulation JavaScript](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Date)

### Références projet
- `ARCHITECTURE.md` : Architecture générale
- `API.md` : Documentation API
- `CHANGELOG.md` : Historique des modifications

---

## 🤝 Contributeurs

- **Auteur** : Perplexity AI
- **Date** : 2 février 2026
- **Version** : 2.0 (avec améliorations prioritaires)
- **Branche** : V7-Saison

---

## 🔄 Historique des versions

### Version 2.0 (02/02/2026)
- ⭐ Ajout comparaison "même période" entre saisons
- ⭐ Ajout gestion période hors saison (avril-août)
- ⭐ Ajout détection saisons incomplètes avec marquage visuel
- ⭐ Ajout optimisations performance (useMemo, lazy loading)
- Amélioration de la documentation technique
- Mise à jour de la checklist d'implémentation

### Version 1.0 (02/02/2026)
- Spécifications initiales
- Fonctionnalités de base

---

## 📄 Licence

Ce document fait partie du projet Gestion Truffière et suit la même licence que le projet.
