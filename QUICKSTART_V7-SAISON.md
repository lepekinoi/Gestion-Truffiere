# 🚀 Guide de Démarrage Rapide - V7-Saison

**Pour les développeurs qui veulent commencer rapidement !**

---

## 📋 TL;DR (Too Long; Didn't Read)

```bash
# 1. Cloner et basculer sur la branche
git checkout V7-Saison

# 2. Le fichier principal est prêt
ls frontend/src/utils/seasonUtils.js

# 3. Importer et utiliser
import { getCurrentSeason, compareSeasonsSamePeriod } from './utils/seasonUtils';

const season = getCurrentSeason(); // "2025-2026"
```

**✅ TOUT EST PRÊT. Vous pouvez commencer à coder !**

---

## 👀 Ce Qui Est Déjà Fait

### 📄 Documentation (100%)
- ✅ [SPECIFICATIONS_SAISON.md](./SPECIFICATIONS_SAISON.md) - Spécs complètes v2.0
- ✅ [README_V7-SAISON.md](./README_V7-SAISON.md) - Documentation détaillée
- ✅ [STATUS_V7-SAISON.md](./STATUS_V7-SAISON.md) - Tableau de bord
- ✅ [QUICKSTART_V7-SAISON.md](./QUICKSTART_V7-SAISON.md) - Ce guide

### 🛠️ Code (25%)
- ✅ **frontend/src/utils/seasonUtils.js** - 20 fonctions implémentées
  - Calcul de saisons
  - Comparaison même période (⭐ NOUVEAU)
  - Gestion hors saison (⭐ NOUVEAU)
  - Détection saisons incomplètes (⭐ NOUVEAU)
  - Utilitaires UI

---

## 🎯 Votre Mission

### 🔴 Phase Actuelle : Intégration Dashboard

**Objectif** : Afficher la saison actuelle et permettre de comparer avec l'an dernier.

**Fichier à modifier** : `frontend/src/Dashboard.js`

**Durée estimée** : 2-4 heures

---

## 💻 Code Starter Pack

### 1️⃣ Imports à Ajouter dans Dashboard.js

```javascript
import { useMemo } from 'react'; // Si pas déjà importé
import {
  getCurrentSeason,
  getAvailableSeasons,
  calculateSeasonProgress,
  filterRecoltesBySeason,
  compareSeasonsSamePeriod,
  isOffSeason,
  getDaysUntilNextSeason,
  getLastCompleteSeason,
  MOIS_SAISON,
  SEASON_COLORS
} from './utils/seasonUtils';
```

### 2️⃣ States à Ajouter

```javascript
// Mode d'affichage (avec persistance)
const [displayMode, setDisplayMode] = useState(() => {
  return localStorage.getItem('displayMode') || 'saison';
});

// Saisons
const [currentSeason, setCurrentSeason] = useState('');
const [availableSeasons, setAvailableSeasons] = useState([]);
const [selectedSeasons, setSelectedSeasons] = useState([]);
const [offSeason, setOffSeason] = useState(false);

// Sauvegarder le choix dans localStorage
useEffect(() => {
  localStorage.setItem('displayMode', displayMode);
}, [displayMode]);
```

### 3️⃣ Initialisation des Saisons

```javascript
// Au chargement, détecter les saisons disponibles
useEffect(() => {
  if (!recoltesData || recoltesData.length === 0) return;
  
  const seasons = getAvailableSeasons(recoltesData);
  setAvailableSeasons(seasons);
  
  const current = getCurrentSeason();
  setCurrentSeason(current);
  
  // Sélectionner par défaut : saison actuelle + saison précédente
  const previous = `${parseInt(current.split('-')[0]) - 1}-${parseInt(current.split('-')[1]) - 1}`;
  setSelectedSeasons([current, previous]);
  
  // Vérifier si on est hors saison
  setOffSeason(isOffSeason());
}, [recoltesData]);
```

### 4️⃣ Composant Toggle Mode Affichage

```javascript
const ToggleModeAffichage = () => {
  return (
    <div className="toggle-mode" style={{
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
      padding: '10px',
      backgroundColor: 'var(--color-surface)',
      borderRadius: '8px'
    }}>
      <button
        onClick={() => setDisplayMode('annee')}
        style={{
          padding: '10px 20px',
          borderRadius: '6px',
          border: displayMode === 'annee' ? '2px solid var(--color-primary)' : '2px solid transparent',
          backgroundColor: displayMode === 'annee' ? 'var(--color-primary)' : 'var(--color-secondary)',
          color: displayMode === 'annee' ? 'white' : 'var(--color-text)',
          cursor: 'pointer',
          fontWeight: displayMode === 'annee' ? 'bold' : 'normal'
        }}
      >
        📅 Année Civile
      </button>
      <button
        onClick={() => setDisplayMode('saison')}
        style={{
          padding: '10px 20px',
          borderRadius: '6px',
          border: displayMode === 'saison' ? '2px solid var(--color-primary)' : '2px solid transparent',
          backgroundColor: displayMode === 'saison' ? 'var(--color-primary)' : 'var(--color-secondary)',
          color: displayMode === 'saison' ? 'white' : 'var(--color-text)',
          cursor: 'pointer',
          fontWeight: displayMode === 'saison' ? 'bold' : 'normal'
        }}
      >
        🍄 Saison Truffière
      </button>
    </div>
  );
};
```

### 5️⃣ Widget Saison Actuelle (Simple)

```javascript
const SeasonWidget = () => {
  // Calculer les stats de la saison actuelle avec useMemo
  const seasonStats = useMemo(() => {
    if (!recoltesData || !currentSeason) return null;
    
    const seasonRecoltes = filterRecoltesBySeason(recoltesData, currentSeason);
    const totalProduction = seasonRecoltes.reduce((sum, r) => 
      sum + parseFloat(r.poids_grammes || 0), 0
    ) / 1000; // kg
    
    const nbRecoltes = seasonRecoltes.length;
    const progress = calculateSeasonProgress();
    
    // Comparaison avec même période saison précédente
    const previousSeason = `${parseInt(currentSeason.split('-')[0]) - 1}-${parseInt(currentSeason.split('-')[1]) - 1}`;
    const comparison = compareSeasonsSamePeriod(recoltesData, currentSeason, previousSeason);
    
    return { totalProduction, nbRecoltes, progress, comparison };
  }, [recoltesData, currentSeason]);
  
  if (!seasonStats) return null;
  
  const { totalProduction, nbRecoltes, progress, comparison } = seasonStats;
  const trendIcon = comparison.trend === 'up' ? '↗️' : comparison.trend === 'down' ? '↘️' : '➡️';
  const trendColor = comparison.trend === 'up' ? '#2ecc71' : comparison.trend === 'down' ? '#e74c3c' : '#95a5a6';
  
  return (
    <div className="season-widget" style={{
      backgroundColor: 'var(--color-surface)',
      padding: '20px',
      borderRadius: '12px',
      marginBottom: '20px',
      border: '2px solid var(--color-card-border)'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: 'var(--color-text)' }}>
        🍄 Saison Truffière {currentSeason}
      </h3>
      
      <div style={{ display: 'flex', gap: '30px', marginBottom: '15px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Production</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text)' }}>
            {totalProduction.toFixed(2)} kg
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Récoltes</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text)' }}>
            {nbRecoltes}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Progression</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text)' }}>
            {progress}%
          </div>
        </div>
      </div>
      
      {/* Barre de progression */}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: 'var(--color-secondary)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '10px'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: 'var(--color-primary)',
          transition: 'width 0.5s ease'
        }} />
      </div>
      
      {/* Comparaison même période */}
      <div style={{
        padding: '10px',
        backgroundColor: 'var(--color-bg-1)',
        borderRadius: '6px',
        fontSize: '14px',
        color: trendColor
      }}>
        {trendIcon} {comparison.percentChange > 0 ? '+' : ''}{comparison.percentChange}% 
        vs même période saison dernière ({comparison.previousProduction} kg)
      </div>
    </div>
  );
};
```

### 6️⃣ Widget Hors Saison (Avril-Août)

```javascript
const OffSeasonWidget = () => {
  if (!offSeason) return null;
  
  const daysLeft = getDaysUntilNextSeason();
  const lastSeason = getLastCompleteSeason();
  
  const lastSeasonRecoltes = filterRecoltesBySeason(recoltesData, lastSeason);
  const lastSeasonProduction = lastSeasonRecoltes.reduce((sum, r) => 
    sum + parseFloat(r.poids_grammes || 0), 0
  ) / 1000;
  
  return (
    <div className="off-season-widget" style={{
      backgroundColor: '#fff8e1',
      padding: '20px',
      borderRadius: '12px',
      marginBottom: '20px',
      border: '2px dashed #f39c12'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#856404' }}>
        🌱 Période Hors Saison
      </h3>
      
      <p style={{ fontSize: '16px', color: '#856404', margin: '10px 0' }}>
        Prochaine saison : <strong>Septembre {new Date().getFullYear()}</strong>
      </p>
      
      <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#d68910' }}>
        Début dans {daysLeft} jours
      </p>
      
      <div style={{
        marginTop: '15px',
        padding: '15px',
        backgroundColor: 'white',
        borderRadius: '8px'
      }}>
        <div style={{ fontSize: '12px', color: '#856404', marginBottom: '5px' }}>
          📊 Dernière saison ({lastSeason})
        </div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#856404' }}>
          {lastSeasonProduction.toFixed(2)} kg | {lastSeasonRecoltes.length} récoltes
        </div>
      </div>
    </div>
  );
};
```

### 7️⃣ Insérer dans le Render

```javascript
return (
  <div className="dashboard">
    {/* Toggle Mode Affichage */}
    <ToggleModeAffichage />
    
    {/* Afficher selon le mode */}
    {displayMode === 'saison' ? (
      <>
        {/* Widget hors saison (si applicable) */}
        <OffSeasonWidget />
        
        {/* Widget saison actuelle (si en saison) */}
        {!offSeason && <SeasonWidget />}
        
        {/* Reste du dashboard... */}
      </>
    ) : (
      <>
        {/* Mode année civile (code existant) */}
      </>
    )}
  </div>
);
```

---

## ✅ Checklist de Vérification

Avant de commit, vérifiez :

- [ ] Le toggle fonctionne et persiste dans localStorage
- [ ] Le widget s'affiche en mode saison
- [ ] La progression de saison est correcte (71% le 15 janvier par exemple)
- [ ] La comparaison même période affiche les bons chiffres
- [ ] Le widget hors saison s'affiche en avril-août
- [ ] Pas d'erreurs dans la console
- [ ] Le code est commenté

---

## 📝 Exemple de Test Manuel

### Scénario 1 : En Saison (Janvier)
1. Ouvrir Dashboard
2. Vérifier que le widget saison s'affiche
3. Vérifier que la progression est ~64% (mi-janvier)
4. Vérifier que la comparaison affiche un % vs l'an dernier

### Scénario 2 : Hors Saison (Mai)
1. Changer la date système en mai 2026 (ou attendre mai 😅)
2. Vérifier que le widget hors saison s'affiche
3. Vérifier que le compte à rebours est correct
4. Vérifier que les stats de la dernière saison s'affichent

---

## 🎓 Ressources d'Aide

### Documentation
- **Spécs complètes** : [SPECIFICATIONS_SAISON.md](./SPECIFICATIONS_SAISON.md)
- **README détaillé** : [README_V7-SAISON.md](./README_V7-SAISON.md)
- **État d'avancement** : [STATUS_V7-SAISON.md](./STATUS_V7-SAISON.md)

### Code Source
- **Utilitaires** : [frontend/src/utils/seasonUtils.js](./frontend/src/utils/seasonUtils.js)

### API des Fonctions

Toutes les fonctions sont documentées dans `seasonUtils.js` avec JSDoc.

**Exemple** :
```javascript
/**
 * Compare deux saisons jusqu'à la même période
 * @param {Array} recoltesData - Toutes les récoltes
 * @param {string} currentSeason - Saison actuelle (ex: "2024-2025")
 * @param {string} previousSeason - Saison précédente (ex: "2023-2024")
 * @returns {Object} Comparaison avec production, différence, % changement, tendance
 */
compareSeasonsSamePeriod(recoltesData, currentSeason, previousSeason)
```

---

## ❓ Questions Fréquentes

### Q: Pourquoi utiliser useMemo ?
**R:** Les calculs sur les récoltes (filtrage, sommes) sont coûteux. `useMemo` les mémoïse pour éviter de recalculer à chaque render.

### Q: Comment tester la fonction hors saison ?
**R:** Vous pouvez temporairement modifier `isOffSeason()` pour retourner `true`, ou changer la date système.

### Q: Que faire si une saison est incomplète ?
**R:** Utilisez `detectIncompleteSeason()` et `formatSeasonLabel()` pour afficher un marquage visuel.

### Q: Comment ajouter une nouvelle couleur de saison ?
**R:** Modifiez `SEASON_COLORS` dans `seasonUtils.js`.

---

## 🚀 Prêt à Coder !

**Vous avez tout ce qu'il faut :**
- ✅ Documentation complète
- ✅ Fonctions utilitaires prêtes
- ✅ Code starter pack
- ✅ Exemples de composants
- ✅ Checklist de vérification

**Temps estimé pour cette étape** : 2-4 heures

**Bonne chance ! 🎉**

---

*Guide créé le 2 février 2026 par Perplexity AI*
