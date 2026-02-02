# Spécifications - Vue Saisonnière de la Culture des Truffes

## 📋 Vue d'ensemble

### Objectif
Adapter l'application Gestion Truffière pour afficher les données selon le **cycle naturel de la truffe** (septembre à mars) plutôt que l'année civile (janvier à décembre).

### Contexte
La culture de la truffe suit un cycle saisonnier qui commence en septembre et se termine en mars. L'exploitant souhaite comparer les performances d'une saison à l'autre (ex: saison 2024-2025 vs 2023-2024) plutôt que par année civile.

### Portée des modifications
- **Dashboard.js** : Vue principale avec statistiques et graphiques
- **Statistiques.js** : Analyses détaillées et exports
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

### 3. Widget "Saison en Cours" (Dashboard)

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

#### Design
```
┌──────────────────────────────────────────────────────────┐
│ 🍄 Saison Truffière 2024-2025                            │
│                                                           │
│ Production      Récoltes        Progression              │
│ 45.32 kg        127            71% ███████░░░             │
└──────────────────────────────────────────────────────────┘
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

### 4. Graphique Comparaison Multi-Saisons

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

#### Fonction de formatage des données
```javascript
const formatSeasonComparisonData = (recolteMensuellesBrutes, selectedSeasons) => {
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
};
```

---

### 5. KPIs Saisonniers

#### Nouveaux KPIs
Ajouter dans la section KPIs du Dashboard (mode saison uniquement) :

1. **Production Saison en Cours**
   - Valeur : X.XX kg
   - Comparaison : +/- X% vs saison précédente
   - Icône : 🍄

2. **Moyenne par Récolte (Saison)**
   - Valeur : XXX g
   - Comparaison : +/- X% vs saison précédente
   - Icône : ⚖️

3. **Meilleur Mois de la Saison**
   - Valeur : Nom du mois + production
   - Exemple : "Décembre (12.5 kg)"
   - Icône : 🏆

#### Calcul des KPIs
```javascript
const calculateSeasonKPIs = (recoltesData, currentSeason) => {
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
  
  // Comparaison avec saison précédente
  const previousSeason = `${yearStart - 1}-${yearEnd - 1}`;
  const prevSeasonRecoltes = recoltesData.filter(r => {
    if (!r.date_recolte) return false;
    const date = new Date(r.date_recolte);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    return (month >= 9 && month <= 12 && year === yearStart - 1) ||
           (month >= 1 && month <= 3 && year === yearEnd - 1);
  });
  
  const prevProduction = prevSeasonRecoltes.reduce((sum, r) => 
    sum + parseFloat(r.poids_grammes || 0), 0
  );
  
  const tendance = prevProduction > 0 
    ? ((totalProduction - prevProduction) / prevProduction) * 100
    : 0;
  
  return {
    saison: currentSeason,
    totalProduction: totalProduction / 1000, // kg
    nbRecoltes,
    moyenneParRecolte: moyenneParRecolte.toFixed(0), // g
    meilleurMois: meilleurMois ? {
      nom: meilleurMois[0],
      production: (meilleurMois[1] / 1000).toFixed(2) // kg
    } : null,
    tendance: tendance.toFixed(1),
    trendDirection: tendance > 0 ? 'up' : tendance < 0 ? 'down' : 'stable'
  };
};
```

---

### 6. Production par Parcelle (Vue Saisonnière)

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

#### Calcul
```javascript
const getProductionParParcelleParSaison = (recoltesData, selectedSeasons) => {
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
};
```

---

### 7. Nouvel Onglet "Saisons" dans Statistiques.js

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

#### Implémentation
```javascript
// Dans Statistiques.js
{selectedView === 'saisons' && (
  <>
    <h3>🗓️ Comparaison des saisons truffières</h3>
    
    {/* Sélection des saisons */}
    <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {availableSeasons.map(season => (
        <button
          key={season}
          onClick={() => toggleSeasonVisibility(season)}
          style={{
            backgroundColor: selectedSeasons.includes(season) ? getSeasonColor(season) : '#e0e0e0',
            opacity: selectedSeasons.includes(season) ? 1 : 0.6,
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {season}
        </button>
      ))}
    </div>
    
    {/* Graphique */}
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={formatSeasonComparisonData()}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="mois" 
            label={{ value: 'Mois de la saison (Sep-Mar)', position: 'insideBottom', offset: -5 }}
          />
          <YAxis label={{ value: 'Production (kg)', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value) => `${value} kg`} />
          <Legend />
          {selectedSeasons.map(season => (
            <Line
              key={season}
              type="monotone"
              dataKey={season}
              stroke={getSeasonColor(season)}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
    
    {/* Tableau récapitulatif */}
    <h4>📊 Résumé par saison</h4>
    <table>
      <thead>
        <tr>
          <th>Saison</th>
          <th style={{ textAlign: 'right' }}>Production</th>
          <th style={{ textAlign: 'center' }}>Nb récoltes</th>
          <th>Mois le plus productif</th>
          <th style={{ textAlign: 'right' }}>Moyenne/récolte</th>
          <th style={{ textAlign: 'right' }}>Évolution</th>
        </tr>
      </thead>
      <tbody>
        {seasonsSummary.map((season, idx) => (
          <tr key={season.nom}>
            <td><strong>{season.nom}</strong></td>
            <td style={{ textAlign: 'right' }}>{season.totalKg.toFixed(2)} kg</td>
            <td style={{ textAlign: 'center' }}>{season.nbRecoltes}</td>
            <td>{season.meilleurMois} ({season.productionMeilleurMois.toFixed(2)} kg)</td>
            <td style={{ textAlign: 'right' }}>{season.moyenneGrammes.toFixed(0)} g</td>
            <td style={{ textAlign: 'right', color: season.tendance >= 0 ? '#27ae60' : '#e74c3c' }}>
              {idx < seasonsSummary.length - 1 ? (
                <>
                  {season.tendance >= 0 ? '↗️' : '↘️'}
                  {Math.abs(season.tendance).toFixed(1)}%
                </>
              ) : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    
    {/* Statistiques agrégées */}
    <div className="stats-grid" style={{ marginTop: '2rem' }}>
      <div className="card">
        <div className="card-title">🏆 Meilleure saison</div>
        <div className="card-value">{bestSeason.nom}</div>
        <div style={{ fontSize: '0.85rem', color: '#666' }}>
          {bestSeason.totalKg.toFixed(2)} kg produits
        </div>
      </div>
      
      <div className="card">
        <div className="card-title">📊 Moyenne toutes saisons</div>
        <div className="card-value">{avgProduction.toFixed(2)} kg</div>
        <div style={{ fontSize: '0.85rem', color: '#666' }}>
          {avgRecoltes.toFixed(0)} récoltes/saison
        </div>
      </div>
      
      <div className="card">
        <div className="card-title">⭐ Mois star</div>
        <div className="card-value">{bestMonthOverall}</div>
        <div style={{ fontSize: '0.85rem', color: '#666' }}>
          Le plus productif historiquement
        </div>
      </div>
    </div>
  </>
)}
```

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
const [seasonKPIs, setSeasonKPIs] = useState(null);

// Données formatées par saison
const [productionParSaison, setProductionParSaison] = useState([]);
```

#### Statistiques.js
```javascript
// Ajouter dans les views existantes
const [selectedView, setSelectedView] = useState('dashboard'); 
// Ajouter 'saisons' comme option

// Stats saisonnières
const [seasonsSummary, setSeasonsSummary] = useState([]);
const [selectedSeasons, setSelectedSeasons] = useState([]);
```

### Fonctions utilitaires

Créer un nouveau fichier `src/utils/seasonUtils.js` :

```javascript
// src/utils/seasonUtils.js

export const MOIS_SAISON = [
  { nom: 'Sep', index: 9, label: 'Septembre' },
  { nom: 'Oct', index: 10, label: 'Octobre' },
  { nom: 'Nov', index: 11, label: 'Novembre' },
  { nom: 'Déc', index: 12, label: 'Décembre' },
  { nom: 'Jan', index: 1, label: 'Janvier' },
  { nom: 'Fév', index: 2, label: 'Février' },
  { nom: 'Mar', index: 3, label: 'Mars' }
];

/**
 * Détermine la saison truffière pour une date donnée
 * @param {Date} date - Date à évaluer
 * @returns {string|null} Saison au format "YYYY-YYYY" ou null si hors saison
 */
export const getSeasonForDate = (date) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  if (month >= 9 && month <= 12) {
    return `${year}-${year + 1}`;
  } else if (month >= 1 && month <= 3) {
    return `${year - 1}-${year}`;
  }
  
  return null; // Hors saison
};

/**
 * Retourne la saison truffière actuelle
 * @returns {string} Saison au format "YYYY-YYYY"
 */
export const getCurrentSeason = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  if (month >= 9 && month <= 12) {
    return `${year}-${year + 1}`;
  } else if (month >= 1 && month <= 3) {
    return `${year - 1}-${year}`;
  } else {
    // Hors saison : retourner la prochaine saison
    return `${year}-${year + 1}`;
  }
};

/**
 * Extrait toutes les saisons présentes dans un jeu de données
 * @param {Array} recoltesData - Tableau des récoltes
 * @returns {Array<string>} Tableau des saisons triées (plus récent en premier)
 */
export const getAvailableSeasons = (recoltesData) => {
  const seasons = new Set();
  
  recoltesData.forEach(recolte => {
    if (!recolte || !recolte.date_recolte) return;
    
    const date = new Date(recolte.date_recolte);
    const season = getSeasonForDate(date);
    
    if (season) {
      seasons.add(season);
    }
  });
  
  return Array.from(seasons).sort().reverse();
};

/**
 * Calcule le pourcentage d'avancement dans la saison actuelle
 * @returns {number} Pourcentage (0-100)
 */
export const calculateSeasonProgress = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  
  let monthsIntoSeason;
  
  if (month >= 9 && month <= 12) {
    monthsIntoSeason = month - 8;
  } else if (month >= 1 && month <= 3) {
    monthsIntoSeason = month + 4;
  } else {
    return 0; // Hors saison
  }
  
  const daysInMonth = new Date(now.getFullYear(), month, 0).getDate();
  const dayProgress = day / daysInMonth;
  
  return Math.round(((monthsIntoSeason - 1 + dayProgress) / 7) * 100);
};

/**
 * Filtre les récoltes pour une saison donnée
 * @param {Array} recoltesData - Tableau des récoltes
 * @param {string} season - Saison au format "YYYY-YYYY"
 * @returns {Array} Récoltes filtrées
 */
export const filterRecoltesBySeason = (recoltesData, season) => {
  const [yearStart, yearEnd] = season.split('-').map(Number);
  
  return recoltesData.filter(recolte => {
    if (!recolte || !recolte.date_recolte) return false;
    
    const date = new Date(recolte.date_recolte);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    return (month >= 9 && month <= 12 && year === yearStart) ||
           (month >= 1 && month <= 3 && year === yearEnd);
  });
};

/**
 * Vérifie si une date est dans la période de récolte truffière
 * @param {Date} date - Date à vérifier
 * @returns {boolean} true si dans la saison
 */
export const isInTruffleSeason = (date) => {
  const month = date.getMonth() + 1;
  return (month >= 9 && month <= 12) || (month >= 1 && month <= 3);
};
```

### API Backend (optionnel)

Si besoin d'optimisation, ajouter un endpoint dédié :

```javascript
// backend/routes/stats.js

/**
 * GET /api/stats/production-saisonniere
 * Retourne la production agrégée par saison
 */
router.get('/production-saisonniere', async (req, res) => {
  try {
    const query = `
      SELECT 
        CASE 
          WHEN EXTRACT(MONTH FROM date_recolte) >= 9 
          THEN EXTRACT(YEAR FROM date_recolte) || '-' || (EXTRACT(YEAR FROM date_recolte) + 1)
          WHEN EXTRACT(MONTH FROM date_recolte) <= 3 
          THEN (EXTRACT(YEAR FROM date_recolte) - 1) || '-' || EXTRACT(YEAR FROM date_recolte)
        END as saison,
        EXTRACT(MONTH FROM date_recolte) as mois,
        COUNT(*) as nombre_recoltes,
        SUM(poids_grammes) as total_grammes,
        AVG(poids_grammes) as moyenne_grammes
      FROM recoltes
      WHERE EXTRACT(MONTH FROM date_recolte) IN (9,10,11,12,1,2,3)
      GROUP BY saison, mois
      ORDER BY saison DESC, mois
    `;
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur production saisonnière:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
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

## 📊 Cas d'usage

### Scénario 1 : Exploitant en pleine saison
**Date** : 15 janvier 2025  
**Saison actuelle** : 2024-2025  
**Progression** : 71% (5 mois sur 7)

**Actions** :
1. L'exploitant ouvre le Dashboard
2. Le widget "Saison en Cours" affiche immédiatement :
   - Production : 32.5 kg
   - Récoltes : 89
   - Progression : 71%
3. Le graphique de comparaison montre 2024-2025, 2023-2024, 2022-2023
4. Il constate que janvier 2025 est en avance sur janvier 2024

### Scénario 2 : Analyse des saisons passées
**Date** : 15 mai 2025 (hors saison)  
**Objectif** : Comparer les 5 dernières saisons

**Actions** :
1. L'exploitant va dans Statistiques > Onglet "Saisons"
2. Il sélectionne 2024-2025, 2023-2024, 2022-2023, 2021-2022, 2020-2021
3. Le graphique affiche les 5 courbes de production mensuelle
4. Le tableau récapitulatif montre :
   - Meilleure saison : 2023-2024 (48.2 kg)
   - Tendance globale : +5.3% par saison
   - Mois star : Décembre (historiquement le plus productif)

### Scénario 3 : Comparaison par parcelle
**Objectif** : Identifier quelle parcelle a été la plus productive sur 3 saisons

**Actions** :
1. Dashboard > Mode Saison
2. Sélectionner 2024-2025, 2023-2024, 2022-2023
3. Tableau "Production par Parcelle" affiche :
   ```
   Parcelle A | 2024-2025 | 15.2 kg
   Parcelle A | 2023-2024 | 18.5 kg
   Parcelle A | 2022-2023 | 16.8 kg
   → Parcelle A : 50.5 kg sur 3 saisons
   ```
4. Identification de la parcelle la plus constante

---

## ✅ Checklist d'implémentation

### Phase 1 : Fondations (Priorité haute)
- [ ] Créer `src/utils/seasonUtils.js` avec toutes les fonctions utilitaires
- [ ] Ajouter les states dans `Dashboard.js`
- [ ] Implémenter le toggle Mode Affichage
- [ ] Implémenter `getCurrentSeason()` et `getAvailableSeasons()`
- [ ] Tester la logique de calcul de saison

### Phase 2 : Dashboard (Priorité haute)
- [ ] Créer le composant `SeasonWidget`
- [ ] Implémenter `calculateSeasonKPIs()`
- [ ] Adapter le graphique de comparaison pour le mode saison
- [ ] Implémenter `formatSeasonComparisonData()`
- [ ] Ajouter la sélection/désélection des saisons
- [ ] Adapter le tableau "Production par Parcelle" pour les saisons

### Phase 3 : Statistiques (Priorité moyenne)
- [ ] Ajouter l'onglet "Saisons" dans la navigation
- [ ] Implémenter le graphique de comparaison multi-saisons
- [ ] Créer le tableau récapitulatif des saisons
- [ ] Calculer les statistiques agrégées (meilleure saison, moyenne, etc.)
- [ ] Implémenter la fonction `calculateSeasonsSummary()`

### Phase 4 : KPIs Saisonniers (Priorité moyenne)
- [ ] Créer les cartes KPI spécifiques saison
- [ ] Implémenter les comparaisons vs saison précédente
- [ ] Ajouter l'indicateur "Meilleur Mois de la Saison"

### Phase 5 : Optimisations (Priorité basse)
- [ ] Persistance du mode d'affichage dans localStorage
- [ ] Améliorer les performances de filtrage
- [ ] Ajouter des animations de transition
- [ ] Endpoint API `/production-saisonniere` (optionnel)

### Phase 6 : Tests & Documentation (Priorité haute)
- [ ] Tests unitaires pour `seasonUtils.js`
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

#### Test 3 : Filtrage des données
```javascript
// Saison 2024-2025 doit inclure :
// - Toutes les récoltes de Sep-Déc 2024
// - Toutes les récoltes de Jan-Mar 2025
// Et exclure :
// - Toutes les récoltes d'Avr-Aoû 2024
// - Toutes les récoltes d'Avr-Aoû 2025
```

### Tests d'interface

1. **Toggle mode** :
   - Cliquer sur "Année civile" → Graphiques changent
   - Cliquer sur "Saison truffière" → Graphiques changent
   - État persisté après rafraîchissement

2. **Widget Saison** :
   - Affiche la saison correcte
   - Production = somme des récoltes de la saison
   - Progression cohérente avec la date

3. **Graphique comparaison** :
   - Courbes affichées correctement
   - Sélection/désélection des saisons fonctionne
   - Tooltip affiche les bonnes valeurs

4. **Tableau parcelles** :
   - Filtre par saisons sélectionnées
   - Totaux corrects
   - Tri fonctionne

---

## 🚀 Déploiement

### Prérequis
- Branche `V7` à jour
- Tests passés
- Code review effectué

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
- [React Hooks](https://react.dev/reference/react)
- [Date manipulation JavaScript](https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Date)

### Références projet
- `ARCHITECTURE.md` : Architecture générale
- `API.md` : Documentation API
- `CHANGELOG.md` : Historique des modifications

---

## 🤝 Contributeurs

- **Auteur** : Perplexity AI
- **Date** : 2 février 2026
- **Version** : 1.0
- **Branche** : V7-Saison

---

## 📄 Licence

Ce document fait partie du projet Gestion Truffière et suit la même licence que le projet.
