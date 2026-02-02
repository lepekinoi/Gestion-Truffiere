# Branche V7-Saison - Vue Saisonnière Truffière

## 🎯 Objectif

Adaptation de l'application Gestion Truffière pour afficher les données selon le **cycle naturel de la truffe** (septembre à mars) plutôt que l'année civile (janvier à décembre).

## 📚 Documentation

- **[SPECIFICATIONS_SAISON.md](./SPECIFICATIONS_SAISON.md)** : Spécifications complètes et détaillées (Version 2.0)
  - 9 fonctionnalités principales
  - Implémentations techniques
  - Design & UX
  - Tests à effectuer
  - Checklist d'implémentation

## ✅ Travail Réalisé

### 📄 Documentation
- ✅ Spécifications détaillées v2.0 (SPECIFICATIONS_SAISON.md)
- ✅ Améliorations prioritaires documentées

### 🛠️ Code Implémenté
- ✅ **frontend/src/utils/seasonUtils.js** (7.6 KB)
  - Constantes (MOIS_SAISON, SEASON_COLORS)
  - Calcul de saison (getSeasonForDate, getCurrentSeason, getAvailableSeasons)
  - Progression et timing (calculateSeasonProgress, getDaysIntoSeason)
  - Gestion hors saison (isOffSeason, getDaysUntilNextSeason, getLastCompleteSeason)
  - Filtrage des données (filterRecoltesBySeason)
  - ⭐ Comparaison même période (compareSeasonsSamePeriod)
  - ⭐ Détection saisons incomplètes (detectIncompleteSeason, formatSeasonLabel)
  - Utilitaires UI (getSeasonColor, formatSeasonDate, getProgressLabel)

## 🚀 Améliorations Prioritaires Intégrées

### 1. ✅ Comparaison "Même Période" 
**Fonctionnalité** : Compare deux saisons jusqu'au même point d'avancement (ex: si on est à 71% de la saison 2024-2025, comparer avec 71% de la saison 2023-2024).

**Implémenté** :
```javascript
compareSeasonsSamePeriod(recoltesData, '2024-2025', '2023-2024')
// Retourne : { currentProduction, previousProduction, difference, percentChange, trend }
```

### 2. ✅ Optimisation Performance
**Fonctionnalité** : Utilisation de `useMemo` pour mémoïser les calculs coûteux.

**Documenté dans** : SPECIFICATIONS_SAISON.md (sections optimisées)

### 3. ✅ Gestion Période Hors Saison (Avril-Août)
**Fonctionnalité** : Affichage d'un widget spécifique avec compte à rebours jusqu'à la prochaine saison.

**Implémenté** :
```javascript
isOffSeason() // Vérifie si on est hors saison
getDaysUntilNextSeason() // Nombre de jours avant septembre
getLastCompleteSeason() // Dernière saison complète pour afficher les stats
```

### 4. ✅ Détection Saisons Incomplètes
**Fonctionnalité** : Identifie les saisons avec données manquantes et affiche un marquage visuel.

**Implémenté** :
```javascript
detectIncompleteSeason('2022-2023', recoltesData)
// Retourne : { isComplete, coverage, missingMonths, hasData, monthsPresent }

formatSeasonLabel('2022-2023', completenessInfo)
// Retourne : "2022-2023 ⚠️ (43% - Jan, Fév, Mar)"
```

## 📋 Prochaines Étapes

### Phase 1 : Fondations (🔴 En Cours)
- [x] Créer `seasonUtils.js` avec toutes les fonctions
- [ ] Ajouter les states dans `Dashboard.js`
- [ ] Implémenter le toggle Mode Affichage
- [ ] Tester toutes les fonctions de seasonUtils

### Phase 2 : Dashboard (Priorité Haute)
- [ ] Créer le composant `SeasonWidget` avec comparaison même période
- [ ] Créer le composant `OffSeasonWidget`
- [ ] Adapter le graphique de comparaison pour le mode saison
- [ ] Ajouter la sélection des saisons avec marquage des incomplètes

### Phase 3 : Statistiques (Priorité Moyenne)
- [ ] Ajouter l'onglet "Saisons" dans la navigation
- [ ] Implémenter le graphique de comparaison multi-saisons
- [ ] Créer le tableau récapitulatif des saisons

### Phase 4 : Tests & Documentation (Priorité Haute)
- [ ] Tests unitaires pour `seasonUtils.js`
- [ ] Tests d'intégration Dashboard
- [ ] Tests d'intégration Statistiques
- [ ] Mise à jour du README principal

## 🔧 Utilisation de seasonUtils.js

### Import
```javascript
import {
  getCurrentSeason,
  getAvailableSeasons,
  calculateSeasonProgress,
  filterRecoltesBySeason,
  compareSeasonsSamePeriod,
  detectIncompleteSeason,
  isOffSeason,
  MOIS_SAISON,
  SEASON_COLORS
} from './utils/seasonUtils';
```

### Exemples d'Utilisation

```javascript
// Obtenir la saison actuelle
const currentSeason = getCurrentSeason();
// "2024-2025" si on est entre sep 2024 et mar 2025

// Lister toutes les saisons disponibles
const seasons = getAvailableSeasons(recoltesData);
// ["2024-2025", "2023-2024", "2022-2023"]

// Calculer la progression dans la saison
const progress = calculateSeasonProgress();
// 71 (si on est à 71% de la saison)

// Filtrer les récoltes d'une saison
const recoltes2024 = filterRecoltesBySeason(recoltesData, "2024-2025");

// Comparer avec la même période de l'an dernier
const comparison = compareSeasonsSamePeriod(
  recoltesData, 
  "2024-2025", 
  "2023-2024"
);
// {
//   currentProduction: "45.32",
//   previousProduction: "41.80",
//   difference: "3.52",
//   percentChange: "8.4",
//   trend: "up"
// }

// Détecter si une saison est incomplète
const completeness = detectIncompleteSeason("2022-2023", recoltesData);
// {
//   isComplete: false,
//   coverage: "43",
//   missingMonths: [9, 10, 11, 12],
//   hasData: true,
//   monthsPresent: [1, 2, 3]
// }

// Vérifier si on est hors saison
if (isOffSeason()) {
  const daysLeft = getDaysUntilNextSeason();
  console.log(`Prochaine saison dans ${daysLeft} jours`);
}
```

## 🎨 Design System

### Couleurs des Saisons
```javascript
SEASON_COLORS = [
  '#2c5f2d', // Vert foncé - Saison la plus récente
  '#4a8b4c', // Vert moyen
  '#8b5a2b', // Brun
  '#3498db', // Bleu
  '#e74c3c', // Rouge
  '#9b59b6', // Violet
  '#16a085', // Turquoise
  '#f39c12'  // Orange
];
```

### Ordre des Mois
```javascript
MOIS_SAISON = [
  { nom: 'Sep', index: 9, label: 'Septembre' },
  { nom: 'Oct', index: 10, label: 'Octobre' },
  { nom: 'Nov', index: 11, label: 'Novembre' },
  { nom: 'Déc', index: 12, label: 'Décembre' },
  { nom: 'Jan', index: 1, label: 'Janvier' },
  { nom: 'Fév', index: 2, label: 'Février' },
  { nom: 'Mar', index: 3, label: 'Mars' }
];
```

## 📊 Tests

### Exécution des Tests
```bash
# Tests unitaires seasonUtils
npm test seasonUtils

# Tests d'intégration
npm test Dashboard.season
npm test Statistiques.season
```

### Scénarios de Test Prioritaires

1. **Calcul de saison** : Vérifier que `getSeasonForDate()` retourne la bonne saison
2. **Progression** : Vérifier que `calculateSeasonProgress()` est cohérent
3. **Comparaison même période** : Vérifier que les récoltes sont filtrées correctement
4. **Saisons incomplètes** : Vérifier la détection des mois manquants
5. **Hors saison** : Vérifier le comportement en avril-août

## 🔗 Liens Utiles

- **Branche GitHub** : [V7-Saison](https://github.com/lepekinoi/Gestion-Truffiere/tree/V7-Saison)
- **Commits** :
  - [Spécifications initiales](https://github.com/lepekinoi/Gestion-Truffiere/commit/46eed180a325e42aa75af16291ff49c5dd627dc7)
  - [Améliorations prioritaires](https://github.com/lepekinoi/Gestion-Truffiere/commit/bc94ad64338bce0abf173087a5efa02ebcf1c03e)
  - [Utilitaires seasonUtils.js](https://github.com/lepekinoi/Gestion-Truffiere/commit/cb76796070b9a26847e04b4d8ac46c109c3b9385)

## 🤝 Contributeurs

- **Perplexity AI** - Spécifications et implémentation initiale
- **Date de création** : 2 février 2026

---

## 📝 Notes pour les Développeurs

### Principes de Design

1. **Saison = Sep → Mar** : 7 mois de production
2. **Hors saison = Avr → Aoû** : Pas de production, affichage spécifique
3. **Comparaison juste** : Toujours comparer à la même période (même % d'avancement)
4. **Transparence** : Marquer visuellement les saisons incomplètes
5. **Performance** : Utiliser `useMemo` pour les calculs répétés

### Conventions de Nommage

- **Saison** : Format `"YYYY-YYYY"` (ex: `"2024-2025"`)
- **Fonctions** : Verbe + nom (ex: `calculateSeasonProgress`, `filterRecoltesBySeason`)
- **Constantes** : UPPER_SNAKE_CASE (ex: `MOIS_SAISON`, `SEASON_COLORS`)

### Points d'Attention

- ⚠️ Les dates doivent être des objets `Date` JavaScript
- ⚠️ Le poids est en grammes dans la base, converti en kg dans l'UI
- ⚠️ Les mois JavaScript sont 0-indexés (janvier = 0, décembre = 11)
- ⚠️ Toujours vérifier la présence de `date_recolte` avant traitement

---

**Version** : 1.0  
**Dernière mise à jour** : 2 février 2026
