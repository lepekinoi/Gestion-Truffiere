# Feature: Récoltes 🍄

Suivi complet des récoltes de truffes avec filtres avancés, statistiques et exports.

## Structure du Dossier

```
recoltes/
├── pages/
│   └── RecoltesPage.jsx       # Page principale - interface complète
├── components/                # Composants liés aux récoltes
├── hooks/
│   └── useColumnSettings.js   # Gestion des colonnes affichées/exportées
├── services/                  # Appels API (si factorisés plus tard)
├── constants/                 # Constantes métier (qualités, expositions, etc.)
├── utils/
│   ├── pdfExport.js           # Export PDF
│   └── csvImport.js           # Validation/import CSV
└── README.md                  # Cette documentation
```

> Note: certains fichiers utilitaires (PDF/CSV) sont dans `frontend/src/utils`, mais utilisés principalement par cette feature.

## Fichier Principal

### `pages/RecoltesPage.jsx`
**Page très riche avec :**

- ✅ Chargement des données: récoltes, parcelles, arbres, caveurs, chiens
- ✅ Filtres avancés (année, parcelle, qualité, calibre, maturité, caveur, chien, exposition, dates)
- ✅ Recherche texte globale (parcelles, arbres, notes, caveurs, chiens)
- ✅ Pagination configurable (20 / 50 / 100 / tout)
- ✅ Statistiques par qualité (vendable vs non vendable)
- ✅ Sélection multiple + suppression groupée
- ✅ Modal de création/édition de récolte
- ✅ Panneau de recherche pour copier une récolte existante
- ✅ Export PDF avec colonnes configurables
- ✅ Import CSV avec validation

## API & Données

### URL de base
```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
```

### Endpoints utilisés

- `GET    /recoltes`   → Liste des récoltes
- `POST   /recoltes`   → Création d'une récolte
- `PUT    /recoltes/:id` → Modification
- `DELETE /recoltes/:id` → Suppression
- `GET    /parcelles`  → Liste des parcelles
- `GET    /arbres`     → Liste des arbres
- `GET    /caveurs`    → Liste des caveurs (optionnel)
- `GET    /chiens`     → Liste des chiens (optionnel)

Tous les appels passent par `axios` et bénéficient des headers d'authentification (token) définis globalement.

## États & Logique

### États principaux

- `recoltes`       → Tableau des récoltes
- `parcelles`      → Parcelles disponibles
- `arbres`         → Arbres disponibles
- `caveurs`, `chiens`
- `loading`        → Chargement initial
- `showModal`      → Modal création/édition
- `showImportModal`→ Modal import CSV
- `editingRecolte` → Récolte en cours d'édition
- `filterAnnee`    → Filtre d'année
- `filters`        → Filtres avancés
- `selectedRecoltes` → Set d'IDs sélectionnés
- `itemsPerPage`, `currentPage` → Pagination
- `message`        → Toast (succès/erreur)

### Formulaire

`formData` contient tous les champs de la récolte :

```javascript
{
  parcelle_id,
  arbre_id,
  date_recolte,
  poids_grammes,
  qualite,
  calibre,
  maturite,
  profondeur_cm,
  exposition,
  caveur,
  chien,
  conditions_meteo,
  temperature_sol,
  notes
}
```

### Validation côté UI

- Vérifie que `arbre_id` est renseigné
- Ne bloque pas sur les champs optionnels (envoyés à `null` s'ils sont vides)

## Filtres & Recherche

### Filtres avancés

- Parcelle
- Qualité
- Calibre
- Maturité
- Caveur
- Chien
- Exposition
- Date début / fin

Un bandeau récapitulatif indique le nombre de résultats filtrés vs total.

### Recherche texte

La recherche texte balaye :

- `arbre_numero`
- `parcelle_nom`
- `notes`
- `caveur`
- `chien`

## Sélection Multiple

- Checkbox pour chaque ligne
- Checkbox header pour sélectionner toute la page
- Bouton "Tout désélectionner"
- Bouton "Sélectionner toutes les récoltes filtrées"
- Suppression groupée avec confirmation

## Statistiques

### Globales

- Nombre total de récoltes filtrées
- Poids total (kg)
- Poids moyen par récolte (g)
- Nombre d'années différentes

### Par Qualité

- Vendable (Extra, 1ère, 2ème) vs Pourrie vs Non classée
- Poids et nombre par sous-catégorie

## Export & Import

### Export PDF

Utilise `exportRecoltesPDF(filteredRecoltes, annee, colonnesExport)` pour générer un PDF avec :

- Filtres appliqués
- Colonnes choisies par l'utilisateur

### Import CSV

Utilise `CSVImportModal` + `validateRecoltesCSV` :

- Validation des lignes
- Création de chaque récolte via `POST /recoltes`

## Intégration

Dans `App.js` :

```javascript
import RecoltesPage from './features/recoltes/pages/RecoltesPage';

// ...
case 'recoltes':
  return <RecoltesPage highlightId={searchHighlight?.category === 'recoltes' ? searchHighlight.id : null} />;
```

## Style & UX

- Layout cohérent avec le reste de l'app
- Icônes pour les qualités (⭐, 🥇, 🥈, 🗑️)
- Messages utilisateur clairs
- Modals centrés
- Grille adaptive

## Points Clés

- ✅ Toute la logique est dans `RecoltesPage.jsx` (pas encore factorisée en services/hooks)
- ✅ Utilise `axios` et l'URL d'API standard
- ✅ Cohérent avec la feature `arbres` (structure et patterns)

---

**Dernière mise à jour:** Janvier 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
